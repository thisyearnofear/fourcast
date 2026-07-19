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
      name: 'fourcast-agent',
      cwd: '/home/linuxuser/fourcast',
      script: 'scripts/fourcast-agent-worker.mjs',
      interpreter: '/usr/bin/node',
      args: 'live',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: 10000,
      watch: false,
      env: {
        ...readEnvFile('/home/linuxuser/fourcast/.env.agent'),
        NODE_ENV: 'production',
        TXLINE_MODE: 'auto',
        FOURCAST_AGENT_STATE_DIR: '/home/linuxuser/fourcast/.fourcast-agent',
        FOURCAST_AGENT_INTERVAL_MS: '300000',
        FOURCAST_AGENT_DRY_RUN: 'true',
      },
    },
  ],
};
