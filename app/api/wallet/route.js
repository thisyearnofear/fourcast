import { ethers } from 'ethers';

// USDC contract on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A928C4bc8b36c3d969E5';
const POLYMARKET_EXCHANGE = '0x4d97DCd97eB9c5A19a78a33d12fD5eff48730B91'; // CLOB address on Polygon

// USDC ABI - minimal interface for balance and allowance
const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

/**
 * Get ethers provider for Polygon
 */
function getProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
    'https://polygon-rpc.com/';

  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Check USDC balance for a wallet
 */
async function checkBalance(walletAddress) {
  try {
    const provider = getProvider();
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      provider
    );

    const balance = await usdcContract.balanceOf(walletAddress);
    const decimals = await usdcContract.decimals();
    const balanceFormatted = ethers.formatUnits(balance, decimals);

    return {
      raw: balance.toString(),
      formatted: parseFloat(balanceFormatted).toFixed(2),
      decimals
    };
  } catch (error) {
    console.error(`Error checking balance for ${walletAddress}:`, error.message);
    return null;
  }
}

/**
 * Check USDC allowance for Polymarket CLOB
 */
async function checkAllowance(walletAddress) {
  try {
    const provider = getProvider();
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      provider
    );

    const allowance = await usdcContract.allowance(walletAddress, POLYMARKET_EXCHANGE);
    const decimals = await usdcContract.decimals();
    const allowanceFormatted = ethers.formatUnits(allowance, decimals);

    return {
      raw: allowance.toString(),
      formatted: parseFloat(allowanceFormatted).toFixed(2),
      decimals,
      spender: POLYMARKET_EXCHANGE
    };
  } catch (error) {
    console.error(`Error checking allowance for ${walletAddress}:`, error.message);
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
    const { walletAddress } = body;

    if (!walletAddress) {
      return Response.json(
        {
          success: false,
          error: 'Wallet address is required'
        },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!ethers.isAddress(walletAddress)) {
      return Response.json(
        {
          success: false,
          error: 'Invalid wallet address'
        },
        { status: 400 }
      );
    }

    // Check balance and allowance in parallel
    const [balanceData, allowanceData] = await Promise.all([
      checkBalance(walletAddress),
      checkAllowance(walletAddress)
    ]);

    if (!balanceData || !allowanceData) {
      return Response.json(
        {
          success: false,
          error: 'Unable to check wallet status. Network error.'
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        wallet: {
          address: walletAddress,
          balance: {
            raw: balanceData.raw,
            formatted: balanceData.formatted,
            symbol: 'USDC'
          },
          allowance: {
            raw: allowanceData.raw,
            formatted: allowanceData.formatted,
            symbol: 'USDC',
            spender: allowanceData.spender
          },
          canTrade: parseFloat(allowanceData.formatted) > 0 && parseFloat(balanceData.formatted) > 0,
          needsApproval: parseFloat(allowanceData.formatted) === 0
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

    if (!address) {
      return Response.json({
        service: 'Wallet Status Service',
        status: 'available',
        capabilities: {
          checkBalance: true,
          checkAllowance: true,
          getApprovalData: true
        },
        usageExample: 'POST /api/wallet with { walletAddress: "0x..." }',
        networks: ['Polygon'],
        contracts: {
          usdc: USDC_ADDRESS,
          polymarketClob: POLYMARKET_EXCHANGE
        }
      });
    }

    // Optional: Quick balance check with address param
    if (!ethers.isAddress(address)) {
      return Response.json(
        {
          success: false,
          error: 'Invalid wallet address'
        },
        { status: 400 }
      );
    }

    const balance = await checkBalance(address);
    return Response.json({
      success: true,
      wallet: address,
      balance: balance?.formatted || '0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Wallet GET error:', error);
    return Response.json(
      {
        success: false,
        error: 'Status check failed'
      },
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
