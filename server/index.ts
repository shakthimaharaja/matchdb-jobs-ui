import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import dotenv from 'dotenv';

const ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, '../env', `.env.${ENV}`) });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = parseInt(process.env.NODE_SERVER_PORT || '4001', 10);
const JOBS_SERVICES_URL = process.env.JOBS_SERVICES_URL || 'http://localhost:8001';

// Proxy /api/jobs/* -> jobs-services
// Express strips the mount path in req.url, so we re-prepend /api/jobs.
app.use(
  '/api/jobs',
  createProxyMiddleware({
    target: JOBS_SERVICES_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/jobs${path}`,
    on: {
      error: (_err: Error, _req: express.Request, res: express.Response) => {
        (res as express.Response).status(502).json({ error: 'Jobs service unavailable' });
      },
    },
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'matchdb-jobs-ui-server', port: PORT, jobsService: JOBS_SERVICES_URL });
});

app.listen(PORT, () => {
  console.log(`[matchdb-jobs-ui] Node server running on port ${PORT} (${ENV})`);
  console.log(`[matchdb-jobs-ui] Proxying /api/jobs → ${JOBS_SERVICES_URL}`);
});
