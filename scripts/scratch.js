import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

async function run() {
  await client.connect();
  await client.zAdd('test:leaderboard2', [
    { score: 100, value: 'student1' }, // Note: v4 uses 'value', not 'member'
    { score: 90, value: 'student2' }
  ]);
  
  const res1 = await client.zRangeWithScores('test:leaderboard2', 0, -1, { REV: true });
  console.log('zRangeWithScores:', res1);

  try {
    const res2 = await client.zRevRange('test:leaderboard2', 0, 2, { WITHSCORES: true });
    console.log('zRevRange:', res2);
  } catch (e) {
    console.log('zRevRange failed:', e.message);
  }
  
  process.exit(0);
}

run();
