/**
 * PM2 ecosystem config for the Telegraph Protocol miner.
 *
 * Serves SPORTS_SCORE and GAME_RESULT intents via TxLINE data.
 * Unlike the other workers (headless, no port), this one exposes port 8402
 * for Telegraph network requests. Nginx/Caddy reverse-proxies to this port.
 *
 * Usage:
 *   pm2 start deploy/telegraph-miner.ecosystem.config.cjs
 *   pm2 logs telegraph-miner --lines 50
 *   pm2 restart telegraph-miner
 */
const fs = require('fs');

function readEnvFile(file) {
  const env = {};
  try {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index <= 0) return;
      env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
    });
  } catch {
    // Optional on first boot.
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: 'telegraph-miner',
      cwd: '/home/linuxuser/fourcast/telegraph-miner',
      script: 'src/server.js',
      interpreter: '/usr/bin/node',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: '10s',
      watch: false,
      env: {
        ...readEnvFile('/home/linuxuser/fourcast/.env.agent'),
        NODE_ENV: 'production',
        PORT: '8402',
        HOST: '0.0.0.0',
        TXLINE_API_ORIGIN: 'https://txline.txodds.com',
      },
      // Log rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/linuxuser/fourcast/telegraph-miner/logs/pm2-error.log',
      out_file: '/home/linuxuser/fourcast/telegraph-miner/logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
