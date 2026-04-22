import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected');
});

redisClient.on('error', (err) => {
  console.error('✗ Redis connection failed:', err);
});

// We connect manually where we need, or once on startup
export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
};

export default redisClient;
