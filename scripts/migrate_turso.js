import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    const url = process.env.TURSO_CONNECTION_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error('❌ Missing TURSO credentials in .env.local');
        process.exit(1);
    }

    const db = createClient({ url, authToken });

    console.log('🔌 Connected to Turso DB');

    try {
        console.log('🔄 Adding chain_origin column...');
        await db.execute("ALTER TABLE signals ADD COLUMN chain_origin TEXT DEFAULT 'APTOS'");
        console.log('✅ Migration successful!');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('ℹ️ Column already exists');
        } else {
            console.error('❌ Migration failed:', err);
        }
    }
}

migrate();
