/**
 * Deterministic test for the flagship World Cup proof-of-decision chain.
 *
 * This is the judge-walkthrough contract: given the committed replay fixture
 * 18175981 (France 3-0 Sweden) and its bound pre-event decision receipt (a
 * genuine Person 1 buildDecisionReceipt() output), the full chain must produce
 * a stable, correct reconciliation without any live network dependency.
 *
 * What this locks down:
 *   1. Receipt integrity — Person 1's verifyDecisionReceipt validates the
 *      committed contentHash and detects tampering.
 *   2. Proof parsing — winner is derived correctly from statToProve/statToProve2.
 *   3. Reconciliation state machine — status reaches RECONCILED on proof-present.
 *   4. Decision-vs-outcome — the agent's home_win position is resolved in favor.
 *   5. Policy adherence — every Person 1 risk gate passed and adherence is true.
 *   6. Calibration — |predicted winProbability − actual 1| is computed.
 *   7. Degradation — missing receipt, missing proof, and onchain-mismatch each
 *      land in their correct non-RECONCILED state.
 *
 * If this test passes, the demo works offline. If it regresses, the flagship
 * scenario is broken and must be fixed before judging.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { accept, verifyIntegrity, verifyDecisionReceipt, canonicalizeReceipt } from '@/services/txline/receiptAdapter';
import {
  reconcile,
  winnerFromProof,
  positionDirectionFromReceipt,
  policyAdhered,
  RECONCILE_STATUS,
} from '@/services/txline/reconciliationService';
import {
  buildCommitmentMemo,
  parseCommitmentMemo,
  MEMO_PROGRAM_ID,
  COMMITMENT_PREFIX,
} from '@/services/txline/receiptCommitment';

const REPLAY_DIR = path.join(process.cwd(), 'data', 'txline-replays');
const FIXTURE_ID = '18175981';

function loadFixture() {
  const raw = fs.readFileSync(path.join(REPLAY_DIR, `${FIXTURE_ID}.json`), 'utf8');
  return JSON.parse(raw);
}

function loadReceipt(variant = 'allocate') {
  const file = variant === 'pass' ? `${FIXTURE_ID}.pass.receipt.json` : `${FIXTURE_ID}.receipt.json`;
  const raw = fs.readFileSync(path.join(REPLAY_DIR, file), 'utf8');
  return JSON.parse(raw);
}

describe('World Cup proof-of-decision chain (fixture 18175981)', () => {
  const replay = loadFixture();
  const rawReceipt = loadReceipt();
  const receipt = accept(rawReceipt);

  describe('receipt integrity (Person 1 canonical)', () => {
    it('verifies its committed contentHash via Person 1 verifyDecisionReceipt', () => {
      const v = verifyDecisionReceipt(rawReceipt);
      expect(v.valid).toBe(true);
      expect(v.expectedHash).toBe(rawReceipt.proof.integrity.contentHash);
      expect(v.actualHash).toBe(rawReceipt.proof.integrity.contentHash);
    });

    it('verifies via the adapter verifyIntegrity mapping', () => {
      const v = verifyIntegrity(rawReceipt);
      expect(v.ok).toBe(true);
      expect(v.expected).toBe(rawReceipt.proof.integrity.contentHash);
    });

    it('detects tampering: changing the verdict flips the hash', () => {
      const tampered = structuredClone(rawReceipt);
      tampered.proof.decisions[0].decision.verdict = 'PASS';
      const v = verifyDecisionReceipt(tampered);
      expect(v.valid).toBe(false);
      expect(v.actualHash).not.toBe(v.expectedHash);
    });

    it('canonical form is sorted (Person 1 canonical JSON)', () => {
      expect(canonicalizeReceipt({ b: 2, a: 1 })).toBe(canonicalizeReceipt({ a: 1, b: 2 }));
    });

    it('is a genuine buildDecisionReceipt output (has proof.integrity.contentHash)', () => {
      expect(rawReceipt.proof.integrity.algorithm).toBe('sha256');
      expect(rawReceipt.proof.integrity.canonicalization).toBe('fourcast-canonical-json/v1');
      expect(rawReceipt.proof.integrity.contentHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('proof parsing', () => {
    it('derives home winner from statToProve (home 3, away 0)', () => {
      expect(winnerFromProof(replay.proof)).toBe('home');
    });

    it('returns null for a missing proof', () => {
      expect(winnerFromProof(null)).toBeNull();
    });
  });

  describe('receipt → decision extraction (adapter mapping)', () => {
    it('extracts the ALLOCATE verdict', () => {
      expect(receipt.decision.verdict).toBe('ALLOCATE');
    });

    it('extracts the home_win market side and BUY YES direction', () => {
      expect(receipt.decision.marketSide).toBe('home_win');
      expect(receipt.decision.direction).toBe('BUY YES');
    });

    it('maps to the home position direction', () => {
      expect(positionDirectionFromReceipt(receipt)).toBe('home');
    });

    it('reports policy adherence (all Person 1 gates passed)', () => {
      expect(policyAdhered(receipt)).toBe(true);
    });

    it('reports non-adherence when a Person 1 gate fails', () => {
      const bad = accept({
        ...rawReceipt,
        proof: {
          ...rawReceipt.proof,
          decisions: [
            {
              ...rawReceipt.proof.decisions[0],
              decision: {
                ...rawReceipt.proof.decisions[0].decision,
                verdict: 'ALLOCATE',
                riskChecks: rawReceipt.proof.decisions[0].decision.riskChecks.map((c) =>
                  c.id === 'minimum-edge' ? { ...c, passed: false } : c
                ),
              },
            },
          ],
        },
      });
      expect(policyAdhered(bad)).toBe(false);
    });
  });

  describe('reconciliation state machine', () => {
    it('reaches RECONCILED on proof-present verdict', () => {
      const r = reconcile({
        receipt: rawReceipt,
        proof: replay.proof,
        verification: { verdict: 'proof-present' },
        fixtureId: FIXTURE_ID,
      });
      expect(r.status).toBe(RECONCILE_STATUS.RECONCILED);
    });

    it('reaches RECONCILED on verified verdict (on-chain anchor present)', () => {
      const r = reconcile({
        receipt: rawReceipt,
        proof: replay.proof,
        verification: { verdict: 'verified', dailyRootPda: 'FakePda11111111111111111111111111111111' },
        fixtureId: FIXTURE_ID,
      });
      expect(r.status).toBe(RECONCILE_STATUS.RECONCILED);
      expect(r.outcome.verifiedVia).toBe('verified');
    });

    it('records the settlement tx and reaches RECONCILED when settlement is provided', () => {
      const r = reconcile({
        receipt: rawReceipt,
        proof: replay.proof,
        verification: { verdict: 'verified' },
        settlementTx: '5Kj8...settlementsig',
        fixtureId: FIXTURE_ID,
      });
      expect(r.status).toBe(RECONCILE_STATUS.RECONCILED);
      expect(r.chain.settlementTx).toBe('5Kj8...settlementsig');
      expect(r.outcome.settlementTx).toBe('5Kj8...settlementsig');
    });

    it('reports ONCHAIN_MISMATCH when the on-chain root differs', () => {
      const r = reconcile({
        receipt: rawReceipt,
        proof: replay.proof,
        verification: { verdict: 'onchain-mismatch' },
        fixtureId: FIXTURE_ID,
      });
      expect(r.status).toBe(RECONCILE_STATUS.ONCHAIN_MISMATCH);
    });

    it('reports PENDING when a receipt exists but no proof is cached', () => {
      const r = reconcile({ receipt: rawReceipt, proof: null, fixtureId: FIXTURE_ID });
      expect(r.status).toBe(RECONCILE_STATUS.PENDING);
    });

    it('reports PROOF_MISSING when no receipt is bound', () => {
      const r = reconcile({ receipt: null, proof: replay.proof, fixtureId: FIXTURE_ID });
      expect(r.status).toBe(RECONCILE_STATUS.PROOF_MISSING);
      expect(r.decisionVsOutcome).toBeNull();
    });
  });

  describe('decision vs verified outcome (the commercial signal)', () => {
    const r = reconcile({
      receipt: rawReceipt,
      proof: replay.proof,
      verification: { verdict: 'proof-present' },
      fixtureId: FIXTURE_ID,
    });

    it('resolved the home_win position in favor (France won 3-0)', () => {
      expect(r.decisionVsOutcome.positionDirection).toBe('home');
      expect(r.decisionVsOutcome.resolvedFavor).toBe(true);
    });

    it('reports policy adherence', () => {
      expect(r.decisionVsOutcome.policyAdhered).toBe(true);
      expect(r.adherence.policyAdherenceRate).toBe(1);
    });

    it('computes calibration error |winProbability − 1|', () => {
      const winProb = rawReceipt.proof.decisions[0].simulation.winProbability;
      expect(r.adherence.calibrationError).toBeCloseTo(Math.abs(winProb - 1), 6);
    });

    it('carries the receipt contentHash through the chain', () => {
      expect(r.integrity.receiptIntact).toBe(true);
      expect(r.integrity.receiptHash).toBe(rawReceipt.proof.integrity.contentHash);
      expect(r.chain.receiptHash).toBe(rawReceipt.proof.integrity.contentHash);
    });

    it('records the verified outcome scores', () => {
      expect(r.outcome.homeScore).toBe(3);
      expect(r.outcome.awayScore).toBe(0);
      expect(r.outcome.winner).toBe('home');
    });

    it('carries the allocation from the receipt', () => {
      expect(r.decisionVsOutcome.allocationPct).toBe(0.021);
    });
  });

  describe('PASS decision (policy gate fires, no position)', () => {
    it('is adherent and resolves to no-position', () => {
      const passReceipt = structuredClone(rawReceipt);
      passReceipt.proof.decisions[0].decision.verdict = 'PASS';
      passReceipt.proof.decisions[0].decision.rationale = 'Edge below 5% threshold.';
      const r = reconcile({
        receipt: passReceipt,
        proof: replay.proof,
        verification: { verdict: 'proof-present' },
        fixtureId: FIXTURE_ID,
      });
      expect(r.decisionVsOutcome.decisionType).toBe('PASS');
      expect(r.decisionVsOutcome.positionDirection).toBe('none');
      expect(r.decisionVsOutcome.resolvedFavor).toBeNull();
      expect(r.decisionVsOutcome.policyAdhered).toBe(true);
      expect(r.adherence.calibrationError).toBeNull();
    });
  });

  describe('PASS receipt fixture (18175981.pass.receipt.json)', () => {
    const passRaw = loadReceipt('pass');
    const passReceipt = accept(passRaw);

    it('is a genuine buildDecisionReceipt output with a valid contentHash', () => {
      expect(passRaw.proof.integrity.algorithm).toBe('sha256');
      expect(passRaw.proof.integrity.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyDecisionReceipt(passRaw).valid).toBe(true);
    });

    it('has a PASS verdict from the minimum-edge gate firing', () => {
      expect(passReceipt.decision.verdict).toBe('PASS');
      expect(passReceipt.decision.executionEligible).toBe(false);
      const edgeGate = passReceipt.decision.riskChecks.find((c) => c.id === 'minimum-edge');
      expect(edgeGate.passed).toBe(false);
    });

    it('is policy-adherent (a successful refusal to act)', () => {
      expect(policyAdhered(passReceipt)).toBe(true);
    });

    it('reconciles to RECONCILED with no position and no calibration error', () => {
      const r = reconcile({
        receipt: passRaw,
        proof: replay.proof,
        verification: { verdict: 'proof-present' },
        fixtureId: FIXTURE_ID,
      });
      expect(r.status).toBe(RECONCILE_STATUS.RECONCILED);
      expect(r.decisionVsOutcome.decisionType).toBe('PASS');
      expect(r.decisionVsOutcome.positionDirection).toBe('none');
      expect(r.decisionVsOutcome.resolvedFavor).toBeNull();
      expect(r.decisionVsOutcome.policyAdhered).toBe(true);
      expect(r.adherence.calibrationError).toBeNull();
      expect(r.integrity.receiptIntact).toBe(true);
    });

    it('has a different contentHash from the ALLOCATE receipt', () => {
      expect(passRaw.proof.integrity.contentHash).not.toBe(rawReceipt.proof.integrity.contentHash);
    });
  });

  describe('on-chain receipt commitment (Memo program)', () => {
    const contentHash = rawReceipt.proof.integrity.contentHash;

    it('builds a structured memo with the Fourcast prefix and receipt contentHash', () => {
      const memo = buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash });
      expect(memo).toBe(`${COMMITMENT_PREFIX}:${FIXTURE_ID}:${contentHash}`);
      expect(memo.length).toBeLessThan(200); // well within memo program limits
    });

    it('round-trips through parseCommitmentMemo', () => {
      const memo = buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash });
      const parsed = parseCommitmentMemo(memo);
      expect(parsed).toEqual({
        prefix: 'fourcast',
        version: 'receipt-v1',
        fixtureId: FIXTURE_ID,
        contentHash,
      });
    });

    it('rejects malformed memos', () => {
      expect(parseCommitmentMemo('not a memo')).toBeNull();
      expect(parseCommitmentMemo('fourcast:receipt-v1:18175981:deadbeef')).toBeNull(); // too short
      expect(parseCommitmentMemo('fourcast:other-v1:18175981:abc')).toBeNull();
      expect(parseCommitmentMemo(null)).toBeNull();
    });

    it('rejects an invalid contentHash at build time', () => {
      expect(() => buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash: 'not-a-hash' })).toThrow();
      expect(() => buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash: null })).toThrow();
    });

    it('uses the canonical Solana Memo program id', () => {
      expect(MEMO_PROGRAM_ID.toBase58()).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    });

    it('produces a different memo for the PASS receipt than the ALLOCATE receipt', () => {
      const passHash = loadReceipt('pass').proof.integrity.contentHash;
      const allocMemo = buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash });
      const passMemo = buildCommitmentMemo({ fixtureId: FIXTURE_ID, contentHash: passHash });
      expect(allocMemo).not.toBe(passMemo);
      expect(parseCommitmentMemo(allocMemo).contentHash).toBe(contentHash);
      expect(parseCommitmentMemo(passMemo).contentHash).toBe(passHash);
    });
  });
});
