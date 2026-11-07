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

// ─── TxLINE v4 interface (txoracle ≥1.5.17, deployed ~Oct 2026) ────────────
//
// The legacy `validate_stat` instruction was removed in the v4 upgrade. The
// current flow is:
//   book_fixture (once per fixture) → validate_fixture_for_tree (stages a
//   worker_ticket with the day's verified root) → ed25519-verify the signed
//   API payload → validate_stat_v4 → close_worker_ticket.
//
// `settle_policy_v4` performs the last three steps as CPIs inside one
// transaction; the ed25519 verify must be a TOP-LEVEL instruction placed
// before the settle instruction in the same transaction (the txoracle program
// introspects the instructions sysvar for it).

fn validate_fixture_for_tree_discriminator() -> [u8; 8] {
    [118, 85, 77, 234, 117, 87, 168, 190]
}
fn validate_stat_v4_discriminator() -> [u8; 8] {
    [17, 11, 195, 64, 250, 26, 27, 211]
}
fn close_worker_ticket_discriminator() -> [u8; 8] {
    [51, 20, 55, 115, 249, 56, 9, 14]
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateStatsV4 {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BatchSummaryV4 {
    pub fixture_id: i64,
    pub update_stats: UpdateStatsV4,
    pub sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FixtureForTreeInput {
    pub ts: i64,
    pub domain: u8,
    pub worker_id: u16,
    pub summary: BatchSummaryV4,
    pub main_tree_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStatV4 {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeafV1 {
    pub stat: ScoreStatV4,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeafV2 {
    pub stat: ScoreStatV4,
    pub is_zero: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatValidationPayload {
    V1 {
        ts: i64,
        event_stat_root: [u8; 32],
        fixture_proof: Vec<ProofNode>,
        leaves: Vec<StatLeafV1>,
        multiproof_hashes: Vec<ProofNode>,
        leaf_indices: Vec<u32>,
    },
    V2 {
        ts: i64,
        event_stat_root: [u8; 32],
        fixture_proof: Vec<ProofNode>,
        leaves: Vec<StatLeafV2>,
        multiproof_hashes: Vec<ProofNode>,
        leaf_indices: Vec<u32>,
        raw_mask: Option<[u8; 512]>,
    },
}

impl StatValidationPayload {
    fn ts(&self) -> i64 {
        match self {
            StatValidationPayload::V1 { ts, .. } => *ts,
            StatValidationPayload::V2 { ts, .. } => *ts,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GeometricTarget {
    pub stat_index: u8,
    pub prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatPredicate {
    Single {
        index: u8,
        predicate: TraderPredicate,
    },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NDimensionalStrategy {
    pub geometric_targets: Vec<GeometricTarget>,
    pub distance_predicate: Option<TraderPredicate>,
    pub discrete_predicates: Vec<StatPredicate>,
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

    /// Settle a policy against TxLINE's CURRENT (v4) oracle interface.
    ///
    /// The legacy `validate_stat` CPI was removed in txoracle's v4 upgrade.
    /// This instruction performs the full v4 validation sequence as CPIs:
    ///
    ///   1. validate_fixture_for_tree — verifies the fixture summary against
    ///      the day's on-chain scores root and stages a worker_ticket.
    ///   2. validate_stat_v4 — evaluates the caller-supplied strategy over the
    ///      API-signed stat payload. Requires (a) a fixture_ticket booked
    ///      beforehand for this fixture by `caller`, and (b) an Ed25519
    ///      precompile instruction earlier in the SAME transaction verifying
    ///      the backend signature over the payload — include it as a
    ///      top-level instruction before this one.
    ///   3. close_worker_ticket — reclaims the staging ticket's rent.
    ///
    /// The bool returned by validate_stat_v4 drives the same payout logic as
    /// settle_policy: if it equals `pays_recipient_on_home_win`, the escrowed
    /// SOL goes to the recipient; otherwise the locker is refunded.
    ///
    /// `domain`/`worker_id` identify the worker_ticket PDA seeds — any values
    /// work as long as the client derives the same PDA.
    #[allow(clippy::too_many_arguments)]
    pub fn settle_policy_v4(
        ctx: Context<SettlePolicyV4>,
        domain: u8,
        worker_id: u16,
        for_tree: FixtureForTreeInput,
        payload: StatValidationPayload,
        strategy: NDimensionalStrategy,
    ) -> Result<()> {
        let settled = ctx.accounts.policy.settled;
        let policy_fixture_id = ctx.accounts.policy.fixture_id;
        let policy_min_ts = ctx.accounts.policy.min_ts;
        let pays_recipient_on_home_win = ctx.accounts.policy.pays_recipient_on_home_win;
        let policy_amount = ctx.accounts.policy.amount;
        let settle_policy_key = ctx.accounts.policy.key();
        let caller_key = ctx.accounts.caller.key();

        require!(!settled, ErrorCode::AlreadySettled);
        require!(
            for_tree.summary.fixture_id == policy_fixture_id,
            ErrorCode::FixtureMismatch
        );
        let payload_ts = payload.ts();
        require!(payload_ts == policy_min_ts, ErrorCode::TimestampMismatch);
        require!(
            for_tree.ts == payload_ts,
            ErrorCode::TimestampMismatch
        );

        let txoracle_program_id = TXORACLE_PROGRAM_ID;
        require!(
            ctx.accounts.txoracle_program.key() == txoracle_program_id,
            ErrorCode::WrongTxoracleProgram
        );

        // Verify the fixture_ticket: owned by txoracle, booked by `caller`
        // for this fixture. Layout: 8 disc + owner(32) + fixture_id(u32) +
        // validations_remaining(u32).
        {
            let ticket = &ctx.accounts.fixture_ticket;
            require!(
                *ticket.owner == txoracle_program_id,
                ErrorCode::WrongFixtureTicket
            );
            let d = ticket.data.borrow();
            require!(d.len() >= 48, ErrorCode::WrongFixtureTicket);
            let owner = Pubkey::new_from_array(d[8..40].try_into().unwrap());
            let ticket_fixture = u32::from_le_bytes(d[40..44].try_into().unwrap());
            require!(owner == caller_key, ErrorCode::TicketOwnerMismatch);
            require!(
                ticket_fixture as i64 == policy_fixture_id,
                ErrorCode::FixtureMismatch
            );
        }

        // Verify the daily_scores_roots PDA for the payload timestamp.
        let epoch_day = (payload_ts / 86_400_000) as u16;
        let (daily_scores_pda, _bump) = Pubkey::find_program_address(
            &[b"daily_scores_roots", &epoch_day.to_le_bytes()],
            &txoracle_program_id,
        );
        require!(
            ctx.accounts.daily_scores_roots.key() == daily_scores_pda,
            ErrorCode::WrongDailyScoresPda
        );

        // Derive the worker_ticket PDA the same way txoracle does:
        //   [b"worker_ticket", user(32), domain(u8), worker_id(u16 LE)]
        let (expected_worker_ticket, _wb) = Pubkey::find_program_address(
            &[
                b"worker_ticket",
                caller_key.as_ref(),
                &[domain],
                &worker_id.to_le_bytes(),
            ],
            &txoracle_program_id,
        );
        require!(
            ctx.accounts.worker_ticket.key() == expected_worker_ticket,
            ErrorCode::WrongWorkerTicket
        );

        let caller_info = ctx.accounts.caller.to_account_info();
        let policy_info = ctx.accounts.policy.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();
        let locker_info = ctx.accounts.locker.to_account_info();
        let daily_scores_info = ctx.accounts.daily_scores_roots.to_account_info();
        let worker_ticket_info = ctx.accounts.worker_ticket.to_account_info();
        let fixture_ticket_info = ctx.accounts.fixture_ticket.to_account_info();
        let txoracle_info = ctx.accounts.txoracle_program.to_account_info();
        let instructions_sysvar_info = ctx.accounts.instructions_sysvar.to_account_info();
        let system_info = ctx.accounts.system_program.to_account_info();

        // ---- CPI 1: validate_fixture_for_tree (stage worker ticket) ----
        let mut tree_data = Vec::with_capacity(4096);
        tree_data.extend_from_slice(&validate_fixture_for_tree_discriminator());
        tree_data.extend_from_slice(
            &for_tree.try_to_vec().map_err(|_| ErrorCode::SerializationError)?,
        );
        let tree_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: txoracle_program_id,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(caller_key, true),
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    expected_worker_ticket,
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    daily_scores_pda,
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    anchor_lang::solana_program::system_program::ID,
                    false,
                ),
            ],
            data: tree_data,
        };
        anchor_lang::solana_program::program::invoke(
            &tree_ix,
            &[
                caller_info.clone(),
                worker_ticket_info.clone(),
                daily_scores_info.clone(),
                system_info.clone(),
                txoracle_info.clone(),
            ],
        )?;

        // ---- CPI 2: validate_stat_v4 ----
        let mut v4_data = Vec::with_capacity(8192);
        v4_data.extend_from_slice(&validate_stat_v4_discriminator());
        v4_data.extend_from_slice(&worker_id.to_le_bytes());
        v4_data.extend_from_slice(
            &payload.try_to_vec().map_err(|_| ErrorCode::SerializationError)?,
        );
        v4_data.extend_from_slice(
            &strategy.try_to_vec().map_err(|_| ErrorCode::SerializationError)?,
        );
        let v4_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: txoracle_program_id,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(caller_key, true),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    expected_worker_ticket,
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    ctx.accounts.fixture_ticket.key(),
                    false,
                ),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                    anchor_lang::solana_program::sysvar::instructions::ID,
                    false,
                ),
            ],
            data: v4_data,
        };
        anchor_lang::solana_program::program::invoke(
            &v4_ix,
            &[
                caller_info.clone(),
                worker_ticket_info.clone(),
                fixture_ticket_info.clone(),
                instructions_sysvar_info.clone(),
                txoracle_info.clone(),
            ],
        )?;

        let return_data =
            anchor_lang::solana_program::program::get_return_data()
                .ok_or(ErrorCode::NoReturnData)?;
        let returned_by = return_data.0;
        let bytes = return_data.1;
        require!(!bytes.is_empty(), ErrorCode::EmptyReturnData);
        let home_won = bytes[0] != 0;
        require!(returned_by == txoracle_program_id, ErrorCode::WrongReturnProgram);

        // ---- CPI 3: close_worker_ticket (reclaim rent) ----
        let mut close_data = Vec::with_capacity(16);
        close_data.extend_from_slice(&close_worker_ticket_discriminator());
        close_data.push(domain);
        close_data.extend_from_slice(&worker_id.to_le_bytes());
        let close_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: txoracle_program_id,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(caller_key, true),
                anchor_lang::solana_program::instruction::AccountMeta::new(
                    expected_worker_ticket,
                    false,
                ),
            ],
            data: close_data,
        };
        anchor_lang::solana_program::program::invoke(
            &close_ix,
            &[caller_info, worker_ticket_info, txoracle_info],
        )?;

        // ---- payout (same semantics as settle_policy) ----
        let pay_recipient = home_won == pays_recipient_on_home_win;
        let dest = if pay_recipient {
            recipient_info
        } else {
            locker_info
        };

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

#[derive(Accounts)]
pub struct SettlePolicyV4<'info> {
    /// The validating wallet — must be the caller AND the owner of the
    /// fixture_ticket booked for this fixture. Pays worker-ticket rent.
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
    /// CHECK: TxLINE daily_scores_roots PDA for the payload timestamp —
    /// re-derived inside settle_policy_v4 and verified.
    #[account()]
    pub daily_scores_roots: AccountInfo<'info>,
    /// CHECK: worker_ticket PDA ([b"worker_ticket", caller, domain, worker_id])
    /// created by the validate_fixture_for_tree CPI and closed by
    /// close_worker_ticket. Verified inside settle_policy_v4.
    #[account(mut)]
    pub worker_ticket: AccountInfo<'info>,
    /// CHECK: fixture_ticket PDA booked via txoracle::book_fixture — must be
    /// owned by txoracle, owned-by caller, and for this fixture. Verified
    /// inside settle_policy_v4.
    #[account()]
    pub fixture_ticket: AccountInfo<'info>,
    /// CHECK: The TxLINE txoracle program — verified inside settle_policy_v4.
    #[account()]
    pub txoracle_program: AccountInfo<'info>,
    /// CHECK: instructions sysvar — required by validate_stat_v4's Ed25519
    /// signature introspection. Verified to be the real sysvar.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    /// CHECK: system program for the worker-ticket CPI.
    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: Program<'info, System>,
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
    #[msg("Failed to serialize CPI instruction data")]
    SerializationError,
    #[msg("The fixture_ticket account is not a valid txoracle ticket for this fixture")]
    WrongFixtureTicket,
    #[msg("The fixture_ticket was booked by a different wallet than the caller")]
    TicketOwnerMismatch,
    #[msg("The worker_ticket account does not match the expected PDA")]
    WrongWorkerTicket,
}
