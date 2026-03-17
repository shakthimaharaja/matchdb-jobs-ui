import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import path from "node:path";
import dotenv from "dotenv";
import http from "node:http";
import https from "node:https";

// ─── Load env file before importing config ─────────────────────────────────────
const ENV = process.env.NODE_ENV || "local";
dotenv.config({ path: path.resolve(__dirname, "../env", `.env.${ENV}`) });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import config from "../db/config";

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────────
// CSP disabled — Module Federation injects inline scripts; handled per-env by nginx.
// crossOriginEmbedderPolicy disabled to allow MFE embedding from shell host.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and whitelisted origins
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ─── Proxy: /api/jobs/* → jobs-services ───────────────────────────────────────
app.use(
  "/api/jobs",
  createProxyMiddleware({
    target: config.jobsServicesUrl,
    changeOrigin: true,
    pathRewrite: (reqPath) => `/api/jobs${reqPath}`,
    on: {
      error: (_err: Error, _req: express.Request, res: express.Response) => {
        (res as express.Response)
          .status(502)
          .json({ error: "Jobs service unavailable" });
      },
    },
  }),
);

app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "matchdb-jobs-ui-server",
    port: config.port,
    protocol: config.useHttps ? "https" : "http",
    env: config.env,
    jobsService: config.jobsServicesUrl,
  });
});

// ─── Static files (webpack build) ─────────────────────────────────────────────
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ─── Start server ──────────────────────────────────────────────────────────────
function logStartup() {
  const proto = config.useHttps ? "https" : "http";
  console.log(
    `[matchdb-jobs-ui] ${proto.toUpperCase()} server on port ${config.port} (${
      config.env
    })`,
  );
  console.log(`[matchdb-jobs-ui] /api/jobs → ${config.jobsServicesUrl}`);
  console.log(`[matchdb-jobs-ui] Static: ${distPath}`);
  console.log(
    `[matchdb-jobs-ui] CORS origins: ${config.corsOrigins.join(", ")}`,
  );
}

if (config.useHttps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSSLOptions } = require("./ssl");
  const sslOptions = getSSLOptions();
  https.createServer(sslOptions, app).listen(config.port, logStartup);
} else {
  http.createServer(app).listen(config.port, logStartup);
}
