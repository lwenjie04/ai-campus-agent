# Release Handoff: 2026-06-22

## Release Identity

- Deployed application commit: `4588b4a60ae8b4c5259c93cddf2b59c2345d3fed`
- Deployment time: `2026-06-22 21:40:16 Asia/Shanghai`
- Production URL: `https://maila.club`
- Frontend root: `/www/wwwroot/ai-campus-agent-web`
- Backend root: `/www/ai-campus-agent`
- PM2 process: `ai-campus-agent-backend`

## Verified Checks

- Production build and Vue type checking passed.
- `/`, `/health`, `/chat`, `/community/posts`, and `/tts` returned successful responses.
- `greeting.mp4`, `idle.mp4`, and `teaching.mp4` returned valid ranged `video/mp4` responses.
- The deployed `index.html` SHA-256 matched the local release build.
- PM2 reported the backend online and Nginx configuration validation passed.
- The backend listened on `127.0.0.1:3000`; no public `0.0.0.0:3000` listener existed.
- HSTS, CSP, nosniff, frame, referrer, permissions, and opener policies were present.
- Local LightRAG health and hybrid retrieval passed; production currently uses the tested keyword fallback because no LightRAG process listens on production port `9621`.

## Rollback Points

- Frontend: `/www/wwwroot/ai-campus-agent-web.rollback-20260622-214016`
- Backend: `/www/ai-campus-agent/backups/release-4588b4a-20260622-213336`
- Nginx security headers: `/www/server/panel/vhost/nginx/extension/maila.club/security.conf.backup-20260622-214705`

## Frontend Rollback

```bash
sudo mv /www/wwwroot/ai-campus-agent-web /www/wwwroot/ai-campus-agent-web.failed
sudo mv /www/wwwroot/ai-campus-agent-web.rollback-20260622-214016 /www/wwwroot/ai-campus-agent-web
sudo nginx -t && sudo systemctl reload nginx
```

## Backend Rollback

```bash
sudo cp /www/ai-campus-agent/backups/release-4588b4a-20260622-213336/server/index.mjs /www/ai-campus-agent/server/index.mjs
sudo cp /www/ai-campus-agent/backups/release-4588b4a-20260622-213336/server/auth.mjs /www/ai-campus-agent/server/auth.mjs
sudo pm2 reload ai-campus-agent-backend --update-env
curl -fsS http://127.0.0.1:3000/health
```

## Security Header Rollback

```bash
sudo cp /www/server/panel/vhost/nginx/extension/maila.club/security.conf.backup-20260622-214705 /www/server/panel/vhost/nginx/extension/maila.club/security.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Remaining Operational Work

- Run LightRAG on production only after confirming memory headroom on the 2 GB host; keep keyword fallback enabled.
- Restrict the UFW `888/tcp` management port to a trusted fixed IP when one is available.
- Capture the four target viewport screenshots when the in-app browser automation surface is available.
