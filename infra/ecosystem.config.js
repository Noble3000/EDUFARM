// PM2 ecosystem — all EDUFARM services on this Windows device (production mode).
//
// Boot order (PM2 starts apps in array order; the API additionally gates
// itself): Postgres (Windows service, external) → edufarm-api (wait_ready +
// DB-readiness retries in src/main.ts) → web apps (stateless, retry /api
// calls) → portal-static. Webs do NOT depend on the API at boot.
// Recovery: `node node_modules/pm2/bin/pm2 resurrect` (dump saved via
// `pm2 save` after every deploy). Full drill in Docs/OPERATIONS.md.
//
// Memory policy (8GB device shared with desktop apps — these caps RESTART
// leaky processes, they do not raise usage; typical RSS is 55–90MB):
//   api 450M · webs 400M each · portal 200M.
// A restart at the cap is a symptom — read Docs/OPERATIONS.md ("no-mask" rule)
// instead of raising the number.
//
// Logs: per-service files under logs/ (gitignored). Rotate with:
//   node node_modules/pm2/bin/pm2 install pm2-logrotate
//   node node_modules/pm2/bin/pm2 set pm2-logrotate:max_size 10M
//   node node_modules/pm2/bin/pm2 set pm2-logrotate:retain 7
//
// Usage (from repo root):
//   node node_modules/pm2/bin/pm2 start infra/ecosystem.config.js
//   node node_modules/pm2/bin/pm2 save
// Dev mode (HMR) is still available via infra/run-api.ps1 + infra/run-web.ps1,
// but production uses ~4x less RAM — required on this 8GB device.
// NOTE: apps/api/.env (DATABASE_URL, secrets) is loaded by each app from its own
// directory; API_PORT/API_URL fall back to 4000/localhost below.
const ROOT = "C:\\Users\\HomePC\\Downloads\\EDUFARM";
const NODE = "C:\\Program Files\\nodejs\\node.exe";

const API_ENV = {
  DATABASE_URL: "postgresql://edufarm:edufarm-dev-local@localhost:5432/edufarm",
  API_PORT: 4000,
  PLATFORM_FEE_BPS: 3000,
  SETTLEMENT_HOLD_DAYS: 7,
  NODE_ENV: "production",
  // Payments (test-mode mock by default — no real money moves locally).
  PAYMENT_PROVIDER: "mock",
  PAYMENTS_TEST_MODE: "true",
  MOCK_WEBHOOK_SECRET: "dev-mock-secret-change-me",
  PAYMENT_CALLBACK_BASE: "http://localhost:3001",
  // Email (mock logs + records; configure a real provider to actually send).
  EMAIL_PROVIDER: "mock",
  EMAIL_FROM: "EDUFARM <noreply@edufarm.ng>",
  // Local demos only. NEVER enable on shared/public infrastructure:
  // demo endpoints skip passwords (FINAL_AUDIT P0).
  ALLOW_DEMO_LOGIN: "true",
};

const BASE = {
  autorestart: true,
  max_restarts: 15,
  min_uptime: "10s",
  exp_backoff_restart_delay: 100,
  kill_timeout: 8000, // let SIGTERM drain Fastify / disconnect Prisma (see src/main.ts)
  log_date_format: "YYYY-MM-DD HH:mm:ss",
  merge_logs: true,
};

module.exports = {
  apps: [
    {
      name: "edufarm-api",
      cwd: `${ROOT}\\apps\\api`,
      script: NODE,
      args: "dist\\src\\main.js",
      ...BASE,
      max_memory_restart: "450M",
      wait_ready: true, // src/main.ts sends "ready" after DB check + listen
      listen_timeout: 60000, // DB-readiness retries get up to 60s before PM2 judges
      error_file: `${ROOT}\\logs\\api.err.log`,
      out_file: `${ROOT}\\logs\\api.out.log`,
      env: API_ENV,
    },
    {
      name: "web-student",
      cwd: `${ROOT}\\apps\\web-student`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3001`,
      ...BASE,
      max_memory_restart: "400M",
      error_file: `${ROOT}\\logs\\web-student.err.log`,
      out_file: `${ROOT}\\logs\\web-student.out.log`,
    },
    {
      name: "web-lecturer",
      cwd: `${ROOT}\\apps\\web-lecturer`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3002`,
      ...BASE,
      max_memory_restart: "400M",
      error_file: `${ROOT}\\logs\\web-lecturer.err.log`,
      out_file: `${ROOT}\\logs\\web-lecturer.out.log`,
    },
    {
      name: "web-admin",
      cwd: `${ROOT}\\apps\\web-admin`,
      script: NODE,
      args: `${ROOT}\\node_modules\\.pnpm\\next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1\\node_modules\\next\\dist\\bin\\next start -p 3003`,
      ...BASE,
      max_memory_restart: "400M",
      error_file: `${ROOT}\\logs\\web-admin.err.log`,
      out_file: `${ROOT}\\logs\\web-admin.out.log`,
    },
    {
      name: "portal-static",
      cwd: `${ROOT}`,
      script: NODE,
      args: "infra\\static-server.js",
      ...BASE,
      max_memory_restart: "200M",
      error_file: `${ROOT}\\logs\\portal.err.log`,
      out_file: `${ROOT}\\logs\\portal.out.log`,
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
