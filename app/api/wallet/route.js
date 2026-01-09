import { ethers } from 'ethers';
import { getChainConfig, getProvider } from '@/services/chainConfig';

// ERC20 ABI for Balance Checking
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

/**
 * Check balance for a wallet (Native + USDC if applicable)
 */
async function checkBalance(walletAddress, chainId) {
  try {
    const config = getChainConfig(chainId);
    const provider = getProvider(chainId);
    
    // 1. Check Native Balance (BNB, MATIC, ETH)
    const nativeBalance = await provider.getBalance(walletAddress);
    const nativeFormatted = ethers.formatEther(nativeBalance);
    
    // 2. Check USDC Balance (if configured)
    let usdcFormatted = '0';
    let usdcRaw = '0';
    
    if (config.usdcAddress) {
      try {
        const usdcContract = new ethers.Contract(config.usdcAddress, ERC20_ABI, provider);
        const decimals = await usdcContract.decimals();
        const balance = await usdcContract.balanceOf(walletAddress);
        usdcRaw = balance.toString();
        usdcFormatted = ethers.formatUnits(balance, decimals);
      } catch (err) {
        console.warn(`Failed to fetch USDC balance for ${walletAddress} on chain ${chainId}:`, err.message);
      }
    }

    return {
      native: {
        raw: nativeBalance.toString(),
        formatted: parseFloat(nativeFormatted).toFixed(6),
        symbol: chainId === 137 || chainId === 80001 ? 'MATIC' : chainId === 42161 ? 'ETH' : 'BNB'
      },
      usdc: {
        raw: usdcRaw,
        formatted: parseFloat(usdcFormatted).toFixed(2), // USDC usually 2 decimals for display
        symbol: 'USDC'
      },
      // For backward compatibility, default to Native (unless on Polygon/Arb where USDC is primary for trading)
      raw: nativeBalance.toString(),
      formatted: parseFloat(nativeFormatted).toFixed(6),
      decimals: 18
    };
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error.message);
    return null;
  }
}

/**
 * POST /api/wallet
 * Check balance and allowance for connected wallet
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress, chainId } = body;

    if (!walletAddress) {
      return Response.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!ethers.isAddress(walletAddress)) {
      return Response.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Check balance
    const balanceData = await checkBalance(walletAddress, chainId);

    if (!balanceData) {
      return Response.json(
        { success: false, error: 'Unable to check wallet status. Network error.' },
        { status: 500 }
      );
    }

    // Determine trading ability (Polygon needs USDC, others might use Native)
    const isPolygon = Number(chainId) === 137 || Number(chainId) === 80001;
    const canTrade = isPolygon 
      ? parseFloat(balanceData.usdc.formatted) > 0 
      : parseFloat(balanceData.native.formatted) > 0;

    return Response.json(
      {
        success: true,
        wallet: {
          address: walletAddress,
          balance: balanceData, // Return full balance object
          // For backward compat
          formattedBalance: isPolygon ? balanceData.usdc.formatted : balanceData.native.formatted,
          currency: isPolygon ? 'USDC' : balanceData.native.symbol,
          canTrade: canTrade,
          needsApproval: false // Future: check allowance
        },
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Wallet API Error:', error);

    return Response.json(
      {
        success: false,
        error: 'Wallet status check failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wallet
 * Return service status
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainId = Number(searchParams.get('chainId') || 56);

    if (!address) {
      return Response.json({
        service: 'Wallet Status Service',
        status: 'available',
        capabilities: {
          checkBalance: true
        },
        usageExample: 'POST /api/wallet with { walletAddress: "0x..." }',
        networks: ['BNBChain', 'Polygon', 'Arbitrum']
      });
    }

    if (!ethers.isAddress(address)) {
      return Response.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const balance = await checkBalance(address, chainId);
    return Response.json({
      success: true,
      wallet: address,
      balance: balance,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Wallet GET error:', error);
    return Response.json(
      { success: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
