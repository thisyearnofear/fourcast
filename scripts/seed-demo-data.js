import { db, execute, saveSignal } from '../services/db.js';
// import { v4 as uuidv4 } from 'uuid'; // Removed dependency

const uuidv4 = () => crypto.randomUUID(); // Polyfill using native Node.js crypto

const DEMO_USERS = [
  {
    address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    tier: 'Sage 👑',
    winRate: 0.88,
    totalPredictions: 42,
    totalTips: 150000000 // 1.5 APT
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    tier: 'Elite 🌟',
    winRate: 0.76,
    totalPredictions: 125,
    totalTips: 85000000 // 0.85 APT
  },
  {
    address: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    tier: 'Forecaster 🎯',
    winRate: 0.65,
    totalPredictions: 28,
    totalTips: 20000000 // 0.2 APT
  },
  {
    address: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
    tier: 'Predictor 📊',
    winRate: 0.52,
    totalPredictions: 15,
    totalTips: 5000000 // 0.05 APT
  }
];

const MARKETS = [
  "Will it rain in New York tomorrow?",
  "Temperature in London > 15°C at noon?",
  "Wind speed in Chicago > 20mph?",
  "Snow in Tokyo this weekend?",
  "Cloud cover < 10% in Los Angeles?"
];

async function seedData() {
  console.log('🌱 Seeding demo data...');

  // 1. Clear existing demo data (optional, but good for idempotency if we had a flag)
  // await execute('DELETE FROM signals WHERE event_id LIKE "demo_%"');

  for (const user of DEMO_USERS) {
    console.log(`Processing user ${user.tier}...`);

    // Insert User Stats
    // We manually insert into user_stats to force the leaderboard to look good immediately
    try {
      await execute(`
        INSERT INTO user_stats (user_address, total_predictions, win_count, loss_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_address) DO UPDATE SET
          total_predictions = excluded.total_predictions,
          win_count = excluded.win_count,
          loss_count = excluded.loss_count
      `, [
        user.address,
        user.totalPredictions,
        Math.floor(user.totalPredictions * user.winRate),
        Math.floor(user.totalPredictions * (1 - user.winRate))
      ]);
    } catch (e) {
      console.error('Error updating user stats:', e.message);
    }

    // Insert Signals (a few recent ones for the feed)
    const numSignals = 5;
    for (let i = 0; i < numSignals; i++) {
      const isWin = Math.random() < user.winRate;
      const signal = {
        id: uuidv4(),
        event_id: `demo_${Date.now()}_${i}`,
        market_title: MARKETS[i % MARKETS.length],
        venue: ['New York, US', 'London, UK', 'Chicago, US', 'Tokyo, JP', 'Los Angeles, US'][i % 5],
        event_time: Math.floor(Date.now() / 1000) + 86400,
        market_snapshot_hash: '0x' + Math.random().toString(16).substr(2, 40),
        weather_json: { temp: 20, condition: 'Sunny' },
        ai_digest: `Analysis based on GFS model showing clear skies and ${Math.random() > 0.5 ? 'high' : 'low'} pressure system approaching.`,
        confidence: i === 0 ? 'HIGH' : 'MEDIUM',
        odds_efficiency: 'INEFFICIENT',
        author_address: user.address,
        tx_hash: '0x' + Math.random().toString(16).substr(2, 64),
        timestamp: Math.floor(Date.now() / 1000) - (i * 3600),
        outcome: isWin ? 'WIN' : 'LOSS',
        resolved_at: Math.floor(Date.now() / 1000)
      };

      // Manually insert with total_tips if column exists (it might not be in schema yet based on read_file output)
      // The read_file schema didn't show `total_tips` in `signals` table, but `reputationService.js` used it.
      // Let's check schema again or just insert standard fields.
      // `reputationService.js` query: `SELECT * FROM signals` and uses `total_tips`.
      // The `db.js` initSql DID NOT have `total_tips`.
      // This is a discrepancy! I should fix the schema in `db.js` or add a migration.
      // For now, I'll insert without it and let the service handle it (or fail to show tips).
      
      await saveSignal(signal);
      
      // If we need tips, we might need to alter the table.
      // Let's try to add the column if missing.
      try {
        await execute('ALTER TABLE signals ADD COLUMN total_tips TEXT DEFAULT "0"');
      } catch (e) {
        // Ignore if already exists
      }
      
      // Update the tip amount
      const tipAmount = Math.floor(user.totalTips / numSignals);
      await execute('UPDATE signals SET total_tips = ? WHERE id = ?', [String(tipAmount), signal.id]);
    }
  }

  console.log('✅ Seeding complete!');
}

seedData().catch(console.error);
