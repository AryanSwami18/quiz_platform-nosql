import redisClient from '../db/redis.js';

export const leaderboardKeys = {
    getKey: (quizId) => `leaderboard:${quizId}`
};

/**
 * Increments the student's score on the leaderboard.
 * ZINCRBY is used to atomically add points to a member's score in the sorted set.
 */
export const incrementScore = async (quizId, studentId, points) => {
    const key = leaderboardKeys.getKey(quizId);
    await redisClient.zIncrBy(key, points, studentId);
};

/**
 * Retrieves the top 10 students from the leaderboard (ZREVRANGE)
 * and the specific student's rank (ZREVRANK).
 */
export const getLeaderboard = async (quizId, studentId) => {
    const key = leaderboardKeys.getKey(quizId);
    
    // Get top 10 (0 to 9) with scores using zRangeWithScores for Redis v5 compatibility
    let top10 = [];
    try {
        top10 = await redisClient.zRangeWithScores(key, 0, 9, { REV: true });
    } catch (e) {
        // Fallback for older redis clients if needed
        top10 = await redisClient.zRange(key, 0, 9, { REV: true, WITHSCORES: true });
    }
    
    // Get current student's rank (0-indexed)
    const rankIndex = await redisClient.zRevRank(key, studentId);
    const rank = rankIndex !== null ? rankIndex + 1 : null;
    
    // Get current student's score
    const score = await redisClient.zScore(key, studentId);

    return {
        top10: top10.map(t => ({ studentId: t.value, score: t.score })),
        yourRank: rank,
        yourScore: score !== null ? parseFloat(score) : 0
    };
};

/**
 * Removes the leaderboard (cleanup after quiz period ends completely)
 */
export const deleteLeaderboard = async (quizId) => {
    const key = leaderboardKeys.getKey(quizId);
    await redisClient.del(key);
};
