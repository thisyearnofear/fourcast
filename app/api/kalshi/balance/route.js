import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/trade-api/v2';

/**
 * GET - Fetch user balance
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Authentication token required' },
                { status: 401 }
            );
        }

        const response = await fetch(`${KALSHI_BASE_URL}/portfolio/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to fetch balance';

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
        console.error('Kalshi balance fetch error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch balance' },
            { status: 500 }
        );
    }
}
