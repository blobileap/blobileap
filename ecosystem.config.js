module.exports = {
  apps: [{
    name: 'blobi-leap',
    script: 'server/app.js',
    cwd: '/var/www/blobileap',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: { NODE_ENV: 'production', PORT: 3000 },
    error_file: '/var/log/blobi-leap/error.log',
    out_file: '/var/log/blobi-leap/out.log'
  }, {
    name: 'blobi-bot',
    script: 'server/bot.js',
    cwd: '/var/www/blobileap',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '128M',
    error_file: '/var/log/blobi-leap/bot-error.log',
    out_file: '/var/log/blobi-leap/bot-out.log'
  }]
};
