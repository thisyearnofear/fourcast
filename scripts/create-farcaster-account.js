#!/usr/bin/env node

/**
 * Script to create a @fourcast Farcaster account
 * 
 * This script will:
 * 1. Generate a mnemonic for the new account
 * 2. Output instructions for Neynar signer creation
 */

import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Function to generate a mnemonic for the account
function generateMnemonic() {
  console.log('Generating mnemonic for the new account...');
  
  // Generate a random mnemonic (in practice, you'd want to securely store this)
  const mnemonic = ethers.Mnemonic.fromEntropy(ethers.randomBytes(16));
  return mnemonic.phrase;
}

// Main function
async function main() {
  try {
    console.log('Starting @fourcast Farcaster account creation...\n');
    
    // Step 1: Generate mnemonic for the account
    const mnemonic = generateMnemonic();
    console.log('Account mnemonic (SAVE THIS SECURELY):');
    console.log(mnemonic);
    console.log('');
    
    // Step 2: Output instructions for next steps
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Save the mnemonic above - you\'ll need it for Neynar signer creation');
    console.log('2. Go to Neynar Dashboard → "Agents and Bots" → "Create bot/agent"');
    console.log('3. Paste the mnemonic to create a signer');
    console.log('4. Approve the signer onchain via Optimism KeyGateway (~$2 OP ETH)');
    console.log('5. Copy the generated SIGNER_UUID');
    console.log('6. Set environment variables in Vercel:');
    console.log('   - NEYNAR_API_KEY=your_api_key');
    console.log('   - FARCASTER_SIGNER_UUID=your_signer_uuid');
    console.log('7. Configure webhook in Neynar Dashboard');
    console.log('8. Test by mentioning @fourcast in Warpcast');
    
    console.log('\nAccount creation process completed!');
    
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the script
main();