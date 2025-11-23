
const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

async function discoverAllSeries() {
    console.log('Discovering all Kalshi series via events endpoint...\n');

    try {
        // Try to get all events
        const eventsRes = await fetch(`${BASE_URL}/events?status=open&limit=100`);
        const eventsData = await eventsRes.json();

        if (eventsData.events) {
            console.log(`Found ${eventsData.events.length} events\n`);

            // Extract unique series
            const seriesMap = new Map();

            for (const event of eventsData.events) {
                if (event.series_ticker) {
                    if (!seriesMap.has(event.series_ticker)) {
                        seriesMap.set(event.series_ticker, {
                            ticker: event.series_ticker,
                            category: event.category,
                            title: event.title
                        });
                    }
                }
            }

            console.log(`\n📊 Unique Series Found: ${seriesMap.size}\n`);

            // Group by category
            const byCategory = {};
            for (const [ticker, info] of seriesMap) {
                const cat = info.category || 'Other';
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(info);
            }

            // Display by category
            for (const [category, series] of Object.entries(byCategory)) {
                console.log(`\n${category}:`);
                series.forEach(s => {
                    console.log(`  - ${s.ticker}: ${s.title}`);
                });
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

discoverAllSeries();
