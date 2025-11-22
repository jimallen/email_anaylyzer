/**
 * PM2 Ecosystem Configuration
 * Manages email-analyzer service with auto-restart and log rotation
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 reload email-analyzer
 *   pm2 stop email-analyzer
 *   pm2 logs email-analyzer
 */

module.exports = {
  apps: [{
    name: 'email-analyzer',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Log rotation configuration
    // PM2 has built-in log rotation via pm2-logrotate module
    // Install: pm2 install pm2-logrotate
    // Configure:
    //   pm2 set pm2-logrotate:max_size 10M
    //   pm2 set pm2-logrotate:retain 30
    //   pm2 set pm2-logrotate:rotateInterval '0 0 * * *' (daily at midnight)
  }]
};
