import redisClient from '../db/redis.js';

export const sessionKeys = {
    getKey: (quizId, studentId) => `session:${quizId}:${studentId}`,
    getSnapshotKey: (quizId, studentId) => `session_state:${quizId}:${studentId}`
};

/**
 * Initializes a quiz session for a student
 * @param {string} quizId 
 * @param {string} studentId 
 * @param {number} durationMinutes 
 */
export const initSession = async (quizId, studentId, durationMinutes) => {
    const key = sessionKeys.getKey(quizId, studentId);
    const snapshotKey = sessionKeys.getSnapshotKey(quizId, studentId);
    
    // Check if already exists
    const exists = await redisClient.exists(key);
    if (exists) {
        return false; // Session already active
    }

    const durationSeconds = durationMinutes * 60;
    
    const startedAt = new Date().toISOString();

    await redisClient.hSet(key, {
        startedAt,
        score: 0,
        // Answers will be stored as JSON string in 'answers' field
        answers: JSON.stringify({})
    });
    await redisClient.hSet(snapshotKey, {
        startedAt,
        score: 0,
        answers: JSON.stringify({})
    });
    
    // Set TTL for auto-expire / auto-submit
    await redisClient.expire(key, durationSeconds);
    
    // Initialize student on leaderboard with 0 points so they show up immediately
    const leaderboardKey = `leaderboard:${quizId}`;
    await redisClient.zAdd(leaderboardKey, [{ score: 0, value: studentId }]);
    
    return {
        expiresInSeconds: durationSeconds,
        expiresAt: Date.now() + durationSeconds * 1000
    };
};

/**
 * Gets current session details
 */
export const getSession = async (quizId, studentId) => {
    const key = sessionKeys.getKey(quizId, studentId);
    const session = await redisClient.hGetAll(key);
    
    if (!session || Object.keys(session).length === 0) {
        return null;
    }

    const ttlSeconds = await redisClient.ttl(key);

    return {
        ...session,
        answers: JSON.parse(session.answers || '{}'),
        score: parseInt(session.score || '0', 10),
        ttlSeconds
    };
};

export const getSessionSnapshot = async (quizId, studentId) => {
    const key = sessionKeys.getSnapshotKey(quizId, studentId);
    const session = await redisClient.hGetAll(key);

    if (!session || Object.keys(session).length === 0) {
        return null;
    }

    return {
        ...session,
        answers: JSON.parse(session.answers || '{}'),
        score: parseInt(session.score || '0', 10)
    };
};

/**
 * Updates answers in the session
 */
export const updateSessionAnswer = async (quizId, studentId, questionId, answerData, pointsEarned) => {
    const key = sessionKeys.getKey(quizId, studentId);
    const snapshotKey = sessionKeys.getSnapshotKey(quizId, studentId);
    
    // Get existing session to modify answers
    const session = await getSession(quizId, studentId);
    if (!session) return null;

    session.answers[questionId] = answerData;
    session.score += pointsEarned;

    await redisClient.hSet(key, {
        answers: JSON.stringify(session.answers),
        score: session.score
    });
    await redisClient.hSet(snapshotKey, {
        answers: JSON.stringify(session.answers),
        score: session.score
    });

    return session;
};

/**
 * Deletes the session (after submission)
 */
export const deleteSession = async (quizId, studentId) => {
    const key = sessionKeys.getKey(quizId, studentId);
    const snapshotKey = sessionKeys.getSnapshotKey(quizId, studentId);
    await redisClient.del(key, snapshotKey);
};

export const getSessionTtl = async (quizId, studentId) => {
    const key = sessionKeys.getKey(quizId, studentId);
    return redisClient.ttl(key);
};
