// EDUFARM API entry: build + listen (local-first).
// All wiring lives in app.ts so matrix tests can import buildApp() directly.
import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
