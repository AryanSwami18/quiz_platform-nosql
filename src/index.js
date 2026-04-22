import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { connectRedis } from './db/redis.js';
import dotenv from 'dotenv';
import analyticsRouter from './routes/analytics.js';
import quizRouter from './routes/quiz.js';
import streamRouter from './routes/stream.js';
import facultyRouter from './routes/faculty.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
let mongoClient;
let db;

async function connectMongo() {
  try {
    mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db('quiz_platform');
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// Redis connection is handled in src/db/redis.js

// ============================================
// PLACEHOLDER ROUTES
// ============================================

app.use('/analytics', analyticsRouter);
app.use('/quiz', quizRouter);
app.use('/stream', streamRouter);
app.use('/faculty', facultyRouter);

app.get('/', (req, res) => {
  res.send('API is working');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'connected',
      redis: redisClient.isReady ? 'connected' : 'disconnected',
    },
  });
});

app.use('/quiz', quizRouter);

// ============================================
// START SERVER
// ============================================

async function start() {
  await connectMongo();
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║     Quiz Platform API - Ready                ║
╠══════════════════════════════════════════════╣
║ 🚀 Server: http://localhost:${PORT}
║ 🗄️  MongoDB: Connected (${process.env.MONGO_DB || 'quiz_platform'})
║ 🔴 Redis: Connected (${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379})
║ 📚 API: http://localhost:${PORT}/health
╚══════════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (mongoClient) await mongoClient.close();
  if (redisClient) await redisClient.quit();
  process.exit(0);
});

start();

