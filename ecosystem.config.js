// PM2 ecosystem config for AgroThrive
// Usage:
//   pm2 start ecosystem.config.js          # start
//   pm2 reload agrothrive         # zero-downtime reload
//   pm2 restart agrothrive        # full restart
//   pm2 stop agrothrive           # stop
//   pm2 logs agrothrive           # tail logs
//
// After first start, run:
//   pm2 startup    (follow the printed command)
//   pm2 save

'use strict';

module.exports = {
  apps: [
    {
      // ----------------------------------------------------------------
      // Backend — Express API server (port 4000)
      // ----------------------------------------------------------------
      name: 'agrothrive',
      script: 'src/index.js',
      cwd: './backend',

      instances: 1,          // Set to 'max' to use all CPU cores (cluster mode)
      exec_mode: 'fork',     // Switch to 'cluster' when instances > 1

      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      // Log output
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart policy
      watch: false,           // Never use PM2 watch in production
      autorestart: true,
      max_restarts: 10,       // Stop auto-restarting after 10 consecutive crashes
      min_uptime: '5s',       // Process must stay up 5s to count as a successful start
      restart_delay: 1000,    // Wait 1s between restart attempts

      // Graceful shutdown — Express will finish in-flight requests
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
