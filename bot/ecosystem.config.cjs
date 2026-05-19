module.exports = {
  apps: [
    {
      name: 'fourcast-bot',
      script: './bot/index.js',
      cwd: '/home/deploy/fourcast-bot',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '100M',
    },
    {
      name: 'fourcast-spectrum',
      script: './bot/spectrum.js',
      cwd: '/home/deploy/fourcast-bot',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 5,
      restart_delay: 10000,
      max_memory_restart: '150M',
    },
  ],
};
