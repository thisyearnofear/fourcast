/**
 * PM2 ecosystem config for the Delphi competition agent.
 *
 * Usage:
 *   pm2 start deploy/delphi-agent.ecosystem.config.cjs
 *   pm2 logs delphi-agent --lines 50
 *   pm2 restart delphi-agent
 */
module.exports = {
  apps: [
    {
      name: 'delphi-agent',
      script: 'scripts/delphi-agent-worker.mjs',
      cwd: process.env.DELPHI_AGENT_CWD || '.',
      interpreter: 'node',
      interpreter_args: '--experimental-vm-modules --env-file=.env.local',
      node_args: '--experimental-vm-modules --env-file=.env.local',
      env: {
        NODE_ENV: 'production',
        DELPHI_NETWORK: 'competition-testnet',
        DELPHI_AGENT_DRY_RUN: 'true', // Safety: start in dry-run, flip to false when ready
        DELPHI_AGENT_INTERVAL_MS: '300000', // 5 minutes
      },
      // Restart on crash, max 10 restarts within 60s window
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Log rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '.delphi-agent/pm2-error.log',
      out_file: '.delphi-agent/pm2-out.log',
      merge_logs: true,
      // Don't watch files (this is a worker, not a dev server)
      watch: false,
    },
  ],
};
