import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import analyticsRouter from './routes/analytics.js';
import facultyRouter from './routes/faculty.js';
import quizRouter from './routes/quiz.js';
import streamRouter from './routes/stream.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import redisClient, { connectRedis } from './db/redis.js';
import { startSessionExpiryWorker } from './services/attempts.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
let expiryWorker;

app.use(cors());
app.use(express.json());

app.use('/analytics', analyticsRouter);
app.use('/quiz', quizRouter);
app.use('/stream', streamRouter);
app.use('/faculty', facultyRouter);

app.get('/', (_req, res) => {
  res.json({
    name: 'Quiz Platform API',
    status: 'ready',
  });
});

app.get('/health', async (_req, res) => {
  try {
    await connectMongo();
    await connectRedis();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: 'connected',
        redis: redisClient.isReady ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  if (expiryWorker) {
    clearInterval(expiryWorker);
  }
  await closeMongo();
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
}

async function start() {
  await connectMongo();
  await connectRedis();
  expiryWorker = startSessionExpiryWorker();

  app.listen(port, () => {
    console.log(`Quiz Platform API running on http://localhost:${port}`);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
