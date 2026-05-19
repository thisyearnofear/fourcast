/**
 * CCTP / Gateway Cross-Chain USDC Transfer API
 *
 * Initiates USDC transfers between Arc and Polygon via Circle's
 * Cross-Chain Transfer Protocol and Gateway API.
 *
 * Requires env vars:
 *   CIRCLE_API_KEY — Circle developer API key
 *   CCTP_ARC_CONTRACT — CCTP contract address on Arc
 *   CCTP_POLYGON_CONTRACT — CCTP contract address on Polygon
 *
 * See: https://developers.circle.com/cctp
 */

export async function POST(request) {
  try {
    const body = await request.json();
    const { amount, fromChain, toChain, fromAddress, toAddress } = body;

    if (!amount || !fromChain || !toChain || !fromAddress || !toAddress) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.CIRCLE_API_KEY;
    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'CCTP not configured — CIRCLE_API_KEY not set',
        docs: 'https://developers.circle.com/cctp',
      }, { status: 501 });
    }

    // Circle Gateway / CCTP API endpoint
    // This is a stub — replace with actual Circle API call
    const response = await fetch('https://api.circle.com/v1/cctp/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        amount,
        from: fromChain,
        to: toChain,
        fromAddress,
        toAddress,
        // Optional: fee quote / priority
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        success: false,
        error: data.message || 'Circle CCTP API error',
        statusCode: response.status,
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      messageId: data.messageId,
      txHash: data.txHash,
      status: data.status,
    });
  } catch (error) {
    console.error('CCTP transfer error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
