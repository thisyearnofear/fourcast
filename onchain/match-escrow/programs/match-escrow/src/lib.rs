use anchor_lang::prelude::*;

declare_id!("AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ");

/// The TxLINE txoracle program on Solana devnet.
/// Source: https://txline.txodds.com/documentation/programs/devnet
/// Bytes for 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
const TXORACLE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    86, 117, 159, 44, 144, 95, 120, 96, 200, 99, 119, 20, 191, 36, 145, 48,
    157, 192, 113, 129, 81, 63, 122, 36, 191, 62, 218, 248, 127, 119, 80, 3,
]);

/// On-chain types mirroring the TxLINE txoracle IDL so we can CPI into
/// `validate_stat`. These must match the layout in idl/txline/txoracle.devnet.json
/// exactly — Anchor serialises them with Borsh the same way the txoracle program
/// deserialises them.

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

/// The CPI instruction data for txoracle::validate_stat.
/// Discriminator (8 bytes) + ts (i64) + fixture_summary + fixture_proof +
/// main_tree_proof + predicate + stat_a + stat_b (option) + op (option).
/// We build this manually so we don't need to import txoracle as a crate.
fn validate_stat_discriminator() -> [u8; 8] {
    // anchor discriminator = first 8 bytes of sha256("global:validate_stat")
    [107, 197, 232, 90, 191, 136, 105, 185]
}

#[program]
pub mod match_escrow {
    use super::*;

    /// Create a parametric sports insurance policy.
    ///
    /// The `locker` locks `amount` lamports into a PDA. If the TxLINE-verified
    /// match outcome matches `pays_recipient_on_home_win`, the `recipient`
    /// receives the escrowed SOL. Otherwise the `locker` is refunded.
    ///
    /// `min_ts` is the TxLINE scores-batch minTimestamp — the same value used
    /// to derive the `daily_scores_roots` PDA inside txoracle. It MUST match
    /// the `ts` passed to `settle_policy` and the `summary.updateStats.minTimestamp`
    /// in the proof fetched from `/api/scores/stat-validation`.
    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        fixture_id: i64,
        min_ts: i64,
        pays_recipient_on_home_win: bool,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        // Capture account infos before the mutable borrow of policy.
        let locker_info = ctx.accounts.locker.to_account_info();
        let policy_info = ctx.accounts.policy.to_account_info();
        let system_info = ctx.accounts.system_program.to_account_info();
        let locker_key = ctx.accounts.locker.key();
        let recipient_key = ctx.accounts.recipient.key();
        let policy_key = ctx.accounts.policy.key();
        let bump = ctx.bumps.policy;

        // Fund the policy PDA with the escrowed lamports first (before mutable borrow).
        anchor_lang::system_program::transfer(
            CpiContext::new(
                system_info,
                anchor_lang::system_program::Transfer {
                    from: locker_info,
                    to: policy_info,
                },
            ),
            amount,
        )?;

        let policy = &mut ctx.accounts.policy;
        policy.locker = locker_key;
        policy.recipient = recipient_key;
        policy.fixture_id = fixture_id;
        policy.min_ts = min_ts;
        policy.pays_recipient_on_home_win = pays_recipient_on_home_win;
        policy.amount = amount;
        policy.settled = false;
        policy.bump = bump;

        emit!(PolicyCreated {
            policy: policy_key,
            locker: locker_key,
            recipient: recipient_key,
            fixture_id,
            min_ts,
            pays_recipient_on_home_win,
            amount,
        });
        Ok(())
    }

    /// Settle a policy by CPI-calling txoracle::validate_stat with a TxLINE
    /// Merkle proof. Anyone can call this (keeper bot, recipient, locker, or
    /// a decentralised oracle bot) — the proof is self-validating.
    ///
    /// The CPI verifies on-chain that `stat_a [op] stat_b [comparison] threshold`
    /// is true against the Merkle root anchored in the daily_scores_roots PDA.
    /// We pass: stat_a = home goals (key=1), stat_b = away goals (key=2),
    /// op = Subtract, comparison = GreaterThan, threshold = 0.
    /// So the CPI returns `true` iff the home team won.
    ///
    /// If the CPI result equals `pays_recipient_on_home_win`, the escrowed
    /// SOL transfers to the recipient. Otherwise it refunds the locker.
    /// The policy account is then closed.
    pub fn settle_policy(
        ctx: Context<SettlePolicy>,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        predicate: TraderPredicate,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
        op: Option<BinaryExpression>,
    ) -> Result<()> {
        // Snapshot immutable fields before any mutable borrow.
        let settled = ctx.accounts.policy.settled;
        let policy_fixture_id = ctx.accounts.policy.fixture_id;
        let policy_min_ts = ctx.accounts.policy.min_ts;
        let pays_recipient_on_home_win = ctx.accounts.policy.pays_recipient_on_home_win;
        let policy_amount = ctx.accounts.policy.amount;
        let settle_policy_key = ctx.accounts.policy.key();
        let caller_key = ctx.accounts.caller.key();

        require!(!settled, ErrorCode::AlreadySettled);
        require!(
            fixture_summary.fixture_id == policy_fixture_id,
            ErrorCode::FixtureMismatch
        );
        require!(ts == policy_min_ts, ErrorCode::TimestampMismatch);

        // ---- CPI into txoracle::validate_stat ----
        let txoracle_program_id = TXORACLE_PROGRAM_ID;

        // Derive the daily_scores_roots PDA the same way txoracle does:
        //   [b"daily_scores_roots", epoch_day as u16 LE]
        let epoch_day = (ts / 86_400_000) as u16;
        let (daily_scores_pda, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &epoch_day.to_le_bytes()],
            &txoracle_program_id,
        );
        // Verify the passed-in account matches the expected PDA.
        require!(
            ctx.accounts.daily_scores_roots.key() == daily_scores_pda,
            ErrorCode::WrongDailyScoresPda
        );
        // Verify the txoracle program account matches the expected program ID.
        require!(
            ctx.accounts.txoracle_program.key() == txoracle_program_id,
            ErrorCode::WrongTxoracleProgram
        );

        // Build the validate_stat instruction data manually (Borsh).
        let mut data = Vec::with_capacity(2048);
        data.extend_from_slice(&validate_stat_discriminator());
        data.extend_from_slice(&ts.to_le_bytes());
        // fixture_summary
        data.extend_from_slice(&fixture_summary.fixture_id.to_le_bytes());
        data.extend_from_slice(
            &fixture_summary.update_stats.update_count.to_le_bytes(),
        );
        data.extend_from_slice(
            &fixture_summary.update_stats.min_timestamp.to_le_bytes(),
        );
        data.extend_from_slice(
            &fixture_summary.update_stats.max_timestamp.to_le_bytes(),
        );
        data.extend_from_slice(&fixture_summary.events_sub_tree_root);
        // fixture_proof: Vec<ProofNode>
        write_proof_vec(&mut data, &fixture_proof);
        // main_tree_proof: Vec<ProofNode>
        write_proof_vec(&mut data, &main_tree_proof);
        // predicate
        data.extend_from_slice(&predicate.threshold.to_le_bytes());
        write_comparison(&mut data, &predicate.comparison);
        // stat_a
        write_stat_term(&mut data, &stat_a);
        // stat_b: Option<StatTerm>
        match &stat_b {
            Some(b) => {
                data.push(1);
                write_stat_term(&mut data, b);
            }
            None => data.push(0),
        }
        // op: Option<BinaryExpression>
        match &op {
            Some(BinaryExpression::Add) => {
                data.push(1);
                data.push(0);
            }
            Some(BinaryExpression::Subtract) => {
                data.push(1);
                data.push(1);
            }
            None => data.push(0),
        }

        let validate_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: txoracle_program_id,
            accounts: vec![anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                daily_scores_pda,
                false,
            )],
            data,
        };

        // Invoke the CPI. The daily_scores_roots account and txoracle program
        // must be in the transaction's account list.
        let caller_info = ctx.accounts.caller.to_account_info();
        let daily_scores_info = ctx.accounts.daily_scores_roots.to_account_info();
        let txoracle_info = ctx.accounts.txoracle_program.to_account_info();
        anchor_lang::solana_program::program::invoke(
            &validate_ix,
            &[caller_info, daily_scores_info, txoracle_info],
        )?;

        // Read the bool return value from txoracle.
        let return_data =
            anchor_lang::solana_program::program::get_return_data()
                .ok_or(ErrorCode::NoReturnData)?;
        // The return data is written by the program whose instruction just
        // executed. Anchor encodes a `bool` return as a single byte (0 or 1).
        let returned_by = return_data.0;
        let bytes = return_data.1;
        require!(!bytes.is_empty(), ErrorCode::EmptyReturnData);
        // Anchor return-data for a `bool` is 1 byte. But the program_id prefix
        // is already stripped by get_return_data — `bytes` is the raw payload.
        // Defensive: accept the first byte.
        let home_won = bytes[0] != 0;
        // Sanity: the return data should have come from txoracle.
        require!(
            returned_by == txoracle_program_id,
            ErrorCode::WrongReturnProgram
        );

        // Decide payout direction.
        let pay_recipient = home_won == pays_recipient_on_home_win;
        let dest = if pay_recipient {
            ctx.accounts.recipient.to_account_info()
        } else {
            ctx.accounts.locker.to_account_info()
        };

        // Drain the policy PDA to the winner and close the account.
        let policy_info = ctx.accounts.policy.to_account_info();
        let policy_lamports = **policy_info.lamports.borrow();
        **policy_info.lamports.borrow_mut() = 0;
        **dest.lamports.borrow_mut() += policy_lamports;

        emit!(PolicySettled {
            policy: settle_policy_key,
            caller: caller_key,
            home_won,
            pay_recipient,
            amount: policy_amount,
        });
        Ok(())
    }
}

// ---- Borsh helpers for building the CPI instruction data ----

fn write_proof_vec(buf: &mut Vec<u8>, proof: &[ProofNode]) {
    let len = proof.len() as u32;
    buf.extend_from_slice(&len.to_le_bytes());
    for node in proof {
        buf.extend_from_slice(&node.hash);
        buf.push(node.is_right_sibling as u8);
    }
}

fn write_comparison(buf: &mut Vec<u8>, c: &Comparison) {
    match c {
        Comparison::GreaterThan => buf.push(0),
        Comparison::LessThan => buf.push(1),
        Comparison::EqualTo => buf.push(2),
    }
}

fn write_stat_term(buf: &mut Vec<u8>, term: &StatTerm) {
    buf.extend_from_slice(&term.stat_to_prove.key.to_le_bytes());
    buf.extend_from_slice(&term.stat_to_prove.value.to_le_bytes());
    buf.extend_from_slice(&term.stat_to_prove.period.to_le_bytes());
    buf.extend_from_slice(&term.event_stat_root);
    write_proof_vec(buf, &term.stat_proof);
}

// ---- Accounts ----

#[account]
pub struct Policy {
    pub locker: Pubkey,
    pub recipient: Pubkey,
    pub fixture_id: i64,
    pub min_ts: i64,
    pub pays_recipient_on_home_win: bool,
    pub amount: u64,
    pub settled: bool,
    pub bump: u8,
}

impl Policy {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1 + 1;
}

#[derive(Accounts)]
#[instruction(fixture_id: i64, min_ts: i64, pays_recipient_on_home_win: bool)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub locker: Signer<'info>,
    /// CHECK: recipient can be any address; verified at settle time.
    pub recipient: AccountInfo<'info>,
    #[account(
        init,
        payer = locker,
        space = Policy::SPACE,
        seeds = [
            b"policy",
            locker.key().as_ref(),
            &fixture_id.to_le_bytes(),
            &min_ts.to_le_bytes(),
            &[pays_recipient_on_home_win as u8],
        ],
        bump,
    )]
    pub policy: Account<'info, Policy>,
    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePolicy<'info> {
    /// Anyone can call settle — the proof is self-validating.
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"policy",
            policy.locker.as_ref(),
            &policy.fixture_id.to_le_bytes(),
            &policy.min_ts.to_le_bytes(),
            &[policy.pays_recipient_on_home_win as u8],
        ],
        bump = policy.bump,
        has_one = locker,
        has_one = recipient,
    )]
    pub policy: Account<'info, Policy>,
    /// CHECK: recipient of the payout if the condition is met.
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    /// CHECK: locker gets refunded if the condition is NOT met.
    #[account(mut)]
    pub locker: AccountInfo<'info>,
    /// CHECK: The TxLINE daily_scores_roots PDA — passed through to the
    /// validate_stat CPI. Its address is verified inside settle_policy by
    /// re-deriving it from the `ts` arg + txoracle program ID.
    #[account()]
    pub daily_scores_roots: AccountInfo<'info>,
    /// CHECK: The TxLINE txoracle program — needed for the CPI invoke.
    /// Verified to equal TXORACLE_PROGRAM_ID inside settle_policy.
    #[account()]
    pub txoracle_program: AccountInfo<'info>,
}

// ---- Events ----

#[event]
pub struct PolicyCreated {
    pub policy: Pubkey,
    pub locker: Pubkey,
    pub recipient: Pubkey,
    pub fixture_id: i64,
    pub min_ts: i64,
    pub pays_recipient_on_home_win: bool,
    pub amount: u64,
}

#[event]
pub struct PolicySettled {
    pub policy: Pubkey,
    pub caller: Pubkey,
    pub home_won: bool,
    pub pay_recipient: bool,
    pub amount: u64,
}

// ---- Errors ----

#[error_code]
pub enum ErrorCode {
    #[msg("Escrow amount must be > 0")]
    ZeroAmount,
    #[msg("Policy already settled")]
    AlreadySettled,
    #[msg("Fixture ID in proof does not match the policy")]
    FixtureMismatch,
    #[msg("Timestamp in proof does not match the policy's min_ts")]
    TimestampMismatch,
    #[msg("txoracle::validate_stat returned no data")]
    NoReturnData,
    #[msg("txoracle::validate_stat returned an empty bool")]
    EmptyReturnData,
    #[msg("Return data did not come from the txoracle program")]
    WrongReturnProgram,
    #[msg("The daily_scores_roots account does not match the expected PDA")]
    WrongDailyScoresPda,
    #[msg("The txoracle_program account does not match the expected program ID")]
    WrongTxoracleProgram,
}
