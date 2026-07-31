// pm2 部署配置：后端在 server/ 独立包内以 node index.mjs 启动。
// 用法：npm run pm2:start   （或 pm2 start ecosystem.config.cjs）
// 环境变量由 server/.env 自行加载（loadEnvFile），无需在此重复注入。
module.exports = {
  apps: [
    {
      name: 'ai-campus-server',
      cwd: './server',
      script: 'index.mjs',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
