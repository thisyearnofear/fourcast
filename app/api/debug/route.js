/**
 * Debug endpoint to check environment and database configuration
 */

export async function GET() {
  try {
    const hasUrl = !!process.env.TURSO_CONNECTION_URL;
    const hasToken = !!process.env.TURSO_AUTH_TOKEN;
    const nodeEnv = process.env.NODE_ENV;

    const debug = {
      environment: nodeEnv,
      turso: {
        has_url: hasUrl,
        url: hasUrl ? process.env.TURSO_CONNECTION_URL.split('?')[0] : 'NOT SET',
        has_token: hasToken,
        token_length: hasToken ? process.env.TURSO_AUTH_TOKEN.length : 0,
      },
      other_env_vars: Object.keys(process.env)
        .filter(k => k.includes('TURSO') || k.includes('DATABASE'))
        .reduce((acc, k) => {
          acc[k] = process.env[k] ? '***SET***' : 'NOT SET';
          return acc;
        }, {})
    };

    // Try to connect to database
    let dbTest = { status: 'unknown', error: null };
    try {
      if (hasUrl && hasToken) {
        const { createClient } = await import('@libsql/client');
        const db = createClient({
          url: process.env.TURSO_CONNECTION_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        const result = await db.execute('SELECT 1 as test');
        dbTest = { status: 'connected', result: 'OK' };
      } else {
        dbTest = { status: 'skipped', error: 'Missing credentials' };
      }
    } catch (err) {
      dbTest = { status: 'failed', error: err.message };
    }

    return Response.json({
      success: true,
      debug,
      database_test: dbTest,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
}
