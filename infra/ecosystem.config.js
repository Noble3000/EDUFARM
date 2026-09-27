// PM2 ecosystem — all EDUFARM services on this Windows device.
// Usage: pm2 start infra/ecosystem.config.js ; pm2 save ; pm2 startup
module.exports = {
  apps: [
    { name: "edufarm-api", cwd: "apps/api", script: "node", args: "dist/main.js", env: { PORT: 4000 } },
    { name: "web-student", cwd: "apps/web-student", script: "npx", args: "next start -p 3001" },
    { name: "web-lecturer", cwd: "apps/web-lecturer", script: "npx", args: "next start -p 3002" },
    { name: "web-admin", cwd: "apps/web-admin", script: "npx", args: "next start -p 3003" },
    { name: "ai-worker", cwd: "services/ai-worker", script: "python", args: "main.py" },
  ],
};
