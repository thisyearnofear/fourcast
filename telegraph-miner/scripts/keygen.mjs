#!/usr/bin/env node
/**
 * Generate a persistent Ed25519 signing seed for the miner.
 *
 *   node scripts/keygen.mjs
 *
 * Put the printed MINER_SIGNING_KEY into the VPS env file (.env.agent), never
 * into git. The public key is what /.well-known/fourcast-miner.json will serve.
 */
import nacl from 'tweetnacl';

const seed = nacl.randomBytes(32);
const pair = nacl.sign.keyPair.fromSeed(seed);
console.log(`MINER_SIGNING_KEY=${Buffer.from(seed).toString('base64')}`);
console.error(`public key: ${Buffer.from(pair.publicKey).toString('base64')}`);
