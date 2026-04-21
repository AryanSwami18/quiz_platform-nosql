import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import redis from 'redis';
import dotenv from 'dotenv';

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

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected');
});

redisClient.on('error', (err) => {
  console.error('✗ Redis connection failed:', err);
  process.exit(1);
});

redisClient.connect();

// ============================================
// PLACEHOLDER ROUTES
// ============================================

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

// Quiz start (stub)
app.post('/quiz/:id/start', async (req, res) => {
  // TODO: Implement Quiz Start
  // - Create Redis session with TTL
  // - Return sessionId and duration
  res.json({ message: 'POST /quiz/:id/start - Not implemented yet' });
});

// Submit answer (stub)
app.post('/quiz/:id/answer', async (req, res) => {
  // TODO: Implement Answer Submission
  // - Validate answer via Redis SET NX (spam prevention)
  // - Store in Redis session
  // - Calculate score
  // - Update leaderboard
  res.json({ message: 'POST /quiz/:id/answer - Not implemented yet' });
});

// Get live leaderboard (stub)
app.get('/quiz/:id/leaderboard', async (req, res) => {
  // TODO: Implement Leaderboard
  // - Read Redis Sorted Set
  // - Return top 10 with current user rank
  res.json({ message: 'GET /quiz/:id/leaderboard - Not implemented yet' });
});

// Submit quiz (stub)
app.post('/quiz/:id/submit', async (req, res) => {
  // TODO: Implement Quiz Submit
  // - Read Redis answers
  // - Persist to MongoDB
  // - Clean up Redis keys
  res.json({ message: 'POST /quiz/:id/submit - Not implemented yet' });
});

// Get results (stub)
app.get('/quiz/:id/results', async (req, res) => {
  // TODO: Implement Results
  // - Query MongoDB quiz_attempts
  // - Return score breakdown, correct answers, rank
  res.json({ message: 'GET /quiz/:id/results - Not implemented yet' });
});

// Get questions (stub)
app.get('/quiz/:id/questions', async (req, res) => {
  // TODO: Implement Questions Fetch
  // - Query MongoDB questions collection
  // - Filter by quiz_id
  res.json({ message: 'GET /quiz/:id/questions - Not implemented yet' });
});

// ============================================
// START SERVER
// ============================================

async function start() {
  await connectMongo();

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

