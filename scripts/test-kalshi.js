

const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

async function testKalshi() {
    console.log('Testing Kalshi API...');

    // Test 1: Fetch Series Info for NYC High Temp
    console.log('\n1. Fetching Series: KXHIGHNY');
    try {
        const seriesRes = await fetch(`${BASE_URL}/series/KXHIGHNY`);
        const seriesData = await seriesRes.json();
        console.log('Series Title:', seriesData.series?.title);
    } catch (e) {
        console.error('Failed to fetch series:', e.message);
    }

    // Test 2: Fetch Markets for the Series
    console.log('\n2. Fetching Markets for KXHIGHNY');
    try {
        const marketsRes = await fetch(`${BASE_URL}/markets?series_ticker=KXHIGHNY&status=open`);
        const marketsData = await marketsRes.json();

        if (marketsData.markets && marketsData.markets.length > 0) {
            const m = marketsData.markets[0];
            console.log('Full Market Object:', m);
        } else {
            console.log('No open markets found for KXHIGHNY');
        }
    } catch (e) {
        console.error('Failed to fetch markets:', e.message);
    }

    // Test 3: Check other series
    const otherSeries = ['KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHAUS'];
    for (const s of otherSeries) {
        console.log(`\nChecking ${s}...`);
        try {
            const res = await fetch(`${BASE_URL}/markets?series_ticker=${s}&status=open`);
            const data = await res.json();
            console.log(`Found ${data.markets?.length || 0} markets`);
        } catch (e) {
            console.log(`Failed: ${e.message}`);
        }
    }
}

testKalshi();
