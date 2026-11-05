use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};

/// Cross-contract call to the MPC signer (chain signatures).
/// v1.signer (mainnet) / v1.signer-prod.testnet (testnet) exposes `sign`.
const MPC_GAS: Gas = Gas::from_tgas(60);
const MPC_DEPOSIT: NearToken = NearToken::from_yoctonear(50_000_000_000_000_000_000_000); // 0.05 NEAR

/// The operator's policy, enforced on-chain. Mirrors lib/gates/* — slippage,
/// mandate scope, risk cap, liquidity floor, cooldown — but the contract is
/// the source of truth: an out-of-policy signature request is REFUSED, so no
/// signed payload exists even if the worker runtime is compromised.
#[near_sdk::near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentMandate {
    /// Operator account — the only account allowed to update the mandate and
    /// request signatures. The agent's identity, not a raw key.
    pub owner: AccountId,
    /// Venues the agent may trade (e.g. "polymarket", "delphi", "canton").
    pub allowed_venues: Vec<String>,
    /// Max notional per single trade, in venue collateral units (u128 yocto).
    pub max_notional: U128,
    /// Min market liquidity a trade may be routed through.
    pub min_liquidity: U128,
    /// Max slippage, basis points (e.g. 300 = 3%).
    pub max_slippage_bps: u32,
    /// Min seconds between trades.
    pub cooldown_secs: u64,
    /// Unix timestamp (ns) of the last executed trade.
    pub last_trade_ns: u64,
    /// MPC contract account id (chain signatures signer).
    pub mpc_contract: AccountId,
    /// Derivation path for the agent's external-chain account.
    pub derivation_path: String,
    /// Approved worker code hash — set when a Shade TEE worker registers.
    /// Signature requests carry the running hash; mismatch = refuse.
    pub approved_code_hash: Option<String>,
}

/// A trade the worker wants signed. Fields are exactly what the gates check —
/// nothing more passes the contract boundary.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TradeRequest {
    pub venue: String,
    pub market_id: String,
    pub outcome: String,
    /// Notional in venue collateral units (yocto).
    pub notional: U128,
    /// Market liquidity at decision time.
    pub liquidity: U128,
    /// Expected slippage, basis points.
    pub slippage_bps: u32,
    /// The unsigned payload to sign (chain-specific bytes, hex).
    pub payload: Vec<u8>,
    /// Worker code hash — required iff approved_code_hash is set.
    pub code_hash: Option<String>,
}

/// Serializable view of the mandate for off-chain readers (proof surface).
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct MandateView {
    pub owner: AccountId,
    pub allowed_venues: Vec<String>,
    pub max_notional: U128,
    pub min_liquidity: U128,
    pub max_slippage_bps: u32,
    pub cooldown_secs: u64,
    pub last_trade_ns: u64,
    pub mpc_contract: AccountId,
    pub derivation_path: String,
    pub approved_code_hash: Option<String>,
}

#[near_bindgen]
impl AgentMandate {
    #[init]
    pub fn new(
        owner: AccountId,
        mpc_contract: AccountId,
        derivation_path: String,
        allowed_venues: Vec<String>,
        max_notional: U128,
        min_liquidity: U128,
        max_slippage_bps: u32,
        cooldown_secs: u64,
    ) -> Self {
        Self {
            owner,
            allowed_venues,
            max_notional,
            min_liquidity,
            max_slippage_bps,
            cooldown_secs,
            last_trade_ns: 0,
            mpc_contract,
            derivation_path,
            approved_code_hash: None,
        }
    }

    /// Owner-only: update policy. Every mutation is on-chain and auditable.
    pub fn set_mandate(
        &mut self,
        allowed_venues: Vec<String>,
        max_notional: U128,
        min_liquidity: U128,
        max_slippage_bps: u32,
        cooldown_secs: u64,
    ) {
        self.assert_owner();
        self.allowed_venues = allowed_venues;
        self.max_notional = max_notional;
        self.min_liquidity = min_liquidity;
        self.max_slippage_bps = max_slippage_bps;
        self.cooldown_secs = cooldown_secs;
    }

    /// Owner-only: register the approved worker code hash (Shade attestation).
    pub fn set_approved_code_hash(&mut self, code_hash: String) {
        self.assert_owner();
        self.approved_code_hash = Some(code_hash);
    }

    /// THE gate: validate a trade against the on-chain mandate, then request
    /// an MPC signature for the agent's derived account. Rejects out-of-policy
    /// trades — the signature simply never gets produced.
    pub fn request_signature(&mut self, request: TradeRequest) -> Promise {
        self.assert_owner();

        // Gate 1 — venue scope
        require!(
            self.allowed_venues.iter().any(|v| v == &request.venue),
            "mandate: venue not allowed"
        );
        // Gate 2 — risk cap
        require!(
            request.notional.0 <= self.max_notional.0,
            "mandate: notional exceeds cap"
        );
        // Gate 3 — liquidity floor
        require!(
            request.liquidity.0 >= self.min_liquidity.0,
            "mandate: insufficient liquidity"
        );
        // Gate 4 — slippage
        require!(
            request.slippage_bps <= self.max_slippage_bps,
            "mandate: slippage too high"
        );
        // Gate 5 — cooldown
        let now = env::block_timestamp();
        require!(
            now.saturating_sub(self.last_trade_ns) >= self.cooldown_secs * 1_000_000_000,
            "mandate: cooldown active"
        );
        // Gate 6 — code hash attestation (when a hash is registered)
        if let Some(expected) = &self.approved_code_hash {
            require!(
                request.code_hash.as_deref() == Some(expected.as_str()),
                "mandate: unapproved worker code"
            );
        }

        self.last_trade_ns = now;

        // Chain signatures: ask the MPC contract to sign the payload for our
        // derived path. The signature goes to OUR account's derived address.
        Promise::new(self.mpc_contract.clone()).function_call(
            "sign".to_string(),
            near_sdk::serde_json::json!({
                "request": {
                    "payload": request.payload,
                    "path": self.derivation_path,
                    "key_version": 0,
                }
            })
            .to_string()
            .into_bytes(),
            MPC_DEPOSIT,
            MPC_GAS,
        )
    }

    /// Read view — the proof surface renders this.
    pub fn get_mandate(&self) -> MandateView {
        MandateView {
            owner: self.owner.clone(),
            allowed_venues: self.allowed_venues.clone(),
            max_notional: self.max_notional,
            min_liquidity: self.min_liquidity,
            max_slippage_bps: self.max_slippage_bps,
            cooldown_secs: self.cooldown_secs,
            last_trade_ns: self.last_trade_ns,
            mpc_contract: self.mpc_contract.clone(),
            derivation_path: self.derivation_path.clone(),
            approved_code_hash: self.approved_code_hash.clone(),
        }
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "mandate: caller is not the owner"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(signer: &AccountId) -> VMContextBuilder {
        let mut c = VMContextBuilder::new();
        c.predecessor_account_id(signer.clone());
        c.block_timestamp(1_000_000_000 * 1_000_000);
        c
    }

    fn contract() -> AgentMandate {
        AgentMandate::new(
            accounts(0),
            accounts(1),
            "arena/v1".to_string(),
            vec!["polymarket".to_string()],
            U128(1_000_000),
            U128(500_000),
            300,
            60,
        )
    }

    fn good_trade() -> TradeRequest {
        TradeRequest {
            venue: "polymarket".to_string(),
            market_id: "m1".to_string(),
            outcome: "YES".to_string(),
            notional: U128(500_000),
            liquidity: U128(600_000),
            slippage_bps: 100,
            payload: vec![1, 2, 3],
            code_hash: None,
        }
    }

    #[test]
    #[should_panic(expected = "venue not allowed")]
    fn rejects_unlisted_venue() {
        let mut c = contract();
        testing_env!(ctx(&accounts(0)).build());
        let mut t = good_trade();
        t.venue = "rogue".to_string();
        let _ = c.request_signature(t);
    }

    #[test]
    #[should_panic(expected = "notional exceeds cap")]
    fn rejects_oversized_trade() {
        let mut c = contract();
        testing_env!(ctx(&accounts(0)).build());
        let mut t = good_trade();
        t.notional = U128(2_000_000);
        let _ = c.request_signature(t);
    }

    #[test]
    #[should_panic(expected = "cooldown active")]
    fn rejects_trade_within_cooldown() {
        let mut c = contract();
        let mut cx = ctx(&accounts(0));
        testing_env!(cx.build());
        // First trade passes at t; second trade 1s later must fail (cooldown 60s)
        testing_env!(cx.block_timestamp(2_000_000_000).build());
        c.last_trade_ns = 2_000_000_000;
        testing_env!(cx.block_timestamp(3_000_000_000).build());
        let _ = c.request_signature(good_trade());
    }

    #[test]
    #[should_panic(expected = "unapproved worker code")]
    fn rejects_wrong_code_hash() {
        let mut c = contract();
        testing_env!(ctx(&accounts(0)).build());
        c.set_approved_code_hash("sha256:good".to_string());
        let mut t = good_trade();
        t.code_hash = Some("sha256:evil".to_string());
        let _ = c.request_signature(t);
    }
}
