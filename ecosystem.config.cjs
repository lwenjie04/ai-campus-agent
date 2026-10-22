const appDirectory = process.env.CAMPUS_APP_DIR || __dirname
const appPort = process.env.CAMPUS_APP_PORT || '3000'
const releaseId = process.env.CAMPUS_RELEASE_ID || 'local'

module.exports = {
  apps: [
    {
      name: 'ai-campus-agent-backend',
      script: 'server/index.mjs',
      cwd: appDirectory,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: appPort,
        DEPLOY_RELEASE_ID: releaseId,
      },
    },
  ],
}
