import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/trade-api/v2';

/**
 * POST - Place a new order
 */
export async function POST(request) {
    try {
        const { token, order } = await request.json();

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Authentication token required' },
                { status: 401 }
            );
        }

        if (!order || !order.ticker || !order.side || !order.count || !order.type) {
            return NextResponse.json(
                { success: false, error: 'Invalid order parameters' },
                { status: 400 }
            );
        }

        // Generate unique client_order_id for deduplication
        const clientOrderId = `fourcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const orderPayload = {
            ticker: order.ticker,
            action: order.action || 'buy',
            side: order.side, // 'yes' or 'no'
            count: parseInt(order.count),
            type: order.type, // 'limit' or 'market'
            client_order_id: clientOrderId
        };

        // Add limit price if it's a limit order
        if (order.type === 'limit' && order.yes_price) {
            orderPayload.yes_price = Math.round(order.yes_price);
        }

        const response = await fetch(`${KALSHI_BASE_URL}/portfolio/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Order placement failed';

            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // Keep default error message
            }

            return NextResponse.json(
                { success: false, error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Kalshi order placement error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to place order' },
            { status: 500 }
        );
    }
}

/**
 * GET - Fetch user orders
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const ticker = searchParams.get('ticker');
        const status = searchParams.get('status');
        const limit = searchParams.get('limit');

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Authentication token required' },
                { status: 401 }
            );
        }

        const queryParams = new URLSearchParams();
        if (ticker) queryParams.append('ticker', ticker);
        if (status) queryParams.append('status', status);
        if (limit) queryParams.append('limit', limit);

        const url = `${KALSHI_BASE_URL}/portfolio/orders${queryParams.toString() ? `?${queryParams}` : ''}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to fetch orders';

            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // Keep default error message
            }

            return NextResponse.json(
                { success: false, error: errorMessage },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Kalshi orders fetch error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}
