import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDatabase } from './src/db.js';
import contactsRouter from './src/routes/contacts.js';
import authRouter from './src/routes/auth.js';
import statsRouter from './src/routes/stats.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins === '*' ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(publicDir));

// API Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/auth', authRouter);
app.use('/api/stats', statsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'viezai-admin-dashboard',
    timestamp: new Date().toISOString()
  });
});

// Fallback to SPA index.html for client-side navigation
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint không tồn tại.' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Initialize database and start listening
async function bootstrap() {
  try {
    await initDatabase();
    console.log('[Database] SQLite initialized successfully.');

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 ViezAI Admin Dashboard is running at:`);
      console.log(`👉 Web UI:  http://localhost:${PORT}`);
      console.log(`👉 API:     http://localhost:${PORT}/api/contacts`);
      console.log(`👉 Health:  http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });

    return server;
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

// Auto start if called directly
if (process.argv[1] === __filename) {
  bootstrap();
}

export { app, bootstrap };
