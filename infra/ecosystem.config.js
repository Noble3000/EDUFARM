// PM2 ecosystem — all EDUFARM services on this Windows device (production mode).
// Usage (from repo root):
//   node node_modules/pm2/bin/pm2 start infra/ecosystem.config.js
//   node node_modules/pm2/bin/pm2 save
// Dev mode (HMR) is still available via infra/run-api.ps1 + infra/run-web.ps1,
// but production uses ~4x less RAM — required on this 8GB device.
// NOTE: apps/api/.env (DATABASE_URL, secrets) is loaded by each app from its own
// directory; API_PORT/API_URL fall back to 4000/localhost below.
const ROOT = "C:\\Users\\HomePC\\Downloads\\EDUFARM";
const NODE = "C:\\Program Files\\nodejs\\node.exe";

module.exports = {
  apps: [
    {
      name: "edufarm-api",
      cwd: `${ROOT}\\apps\\api`,
      script: NODE,
      args: "dist\\src\\main.js",
      env: {
        DATABASE_URL: "postgresql://edufarm:edufarm-dev-local@localhost:5432/edufarm",
        API_PORT: 4000,
        PLATFORM_FEE_BPS: 3000,
        SETTLEMENT_HOLD_DAYS: 7,
        NODE_ENV: "production",
      },
    },
    {
      name: "web-student",
      cwd: `${ROOT}\\apps\\web-student`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3001`,
    },
    {
      name: "web-lecturer",
      cwd: `${ROOT}\\apps\\web-lecturer`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3002`,
    },
    {
      name: "web-admin",
      cwd: `${ROOT}\\apps\\web-admin`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3003`,
    },
    {
      name: "portal-static",
      cwd: `${ROOT}`,
      script: NODE,
      args: "infra\\static-server.js",
      env: { PORTAL_PORT: 8080 },
    },
  ],
};

// Phone/mobile access: expose local ports with Cloudflare quick tunnels
// (URLs change on every restart — read them from logs/tunnel-<port>.err.log):
//   cloudflared tunnel --url http://localhost:8080  (portal index.html + design.html)
//   cloudflared tunnel --url http://localhost:3001  (student app)
//   cloudflared tunnel --url http://localhost:3002  (lecturer console)
//   cloudflared tunnel --url http://localhost:3003  (admin)
//   cloudflared tunnel --url http://localhost:4000  (api)
// Remote clients set the API URL via ?api=https://<api-tunnel>/api/v1,
// the ⚙️ button on index.html, or the API URL field on each login page.
