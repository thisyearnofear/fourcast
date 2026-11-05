#!/usr/bin/env node
/**
 * Print the agent's chain-signature-derived external account for the
 * mandate contract. Read-only — works with zero NEAR keys configured.
 *
 * Usage: node scripts/near-derive-address.mjs [path]
 *   NEAR_MANDATE_CONTRACT, NEAR_NETWORK env vars respected.
 */
import {
  derivedEvmAddress,
  derivedPublicKey,
  getMandate,
  getMandateContractId,
  getDerivationPath,
} from '../services/near/nearMandateClient.js';

const path = process.argv[2] || getDerivationPath();
const mandate = await getMandate();
const pubkey = await derivedPublicKey({ path });
const address = await derivedEvmAddress({ path });

console.log(
  JSON.stringify(
    {
      contract: getMandateContractId(),
      mpc: mandate.mpc_contract,
      path,
      publicKey: pubkey,
      evmAddress: address,
      venues: mandate.allowed_venues,
      maxNotional: mandate.max_notional,
      cooldownSecs: mandate.cooldown_secs,
      approvedCodeHash: mandate.approved_code_hash,
    },
    null,
    2
  )
);
