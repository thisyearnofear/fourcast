import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/trade-api/v2';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const response = await fetch(`${KALSHI_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Invalid credentials';

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
            data: {
                token: data.token,
                memberId: data.member_id,
                expiry: Date.now() + (30 * 60 * 1000) // 30 minutes from now
            }
        });
    } catch (error) {
        console.error('Kalshi login error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Login failed' },
            { status: 500 }
        );
    }
}
