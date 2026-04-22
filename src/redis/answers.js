import redisClient from '../db/redis.js';

export const answerKeys = {
    getKey: (quizId, studentId, questionId) => `answer:${quizId}:${studentId}:${questionId}`
};

/**
 * Attempts to set an answer for a specific question.
 * Uses Redis SET NX (Not eXists) to ensure the question can only be answered once.
 * This provides atomicity for spam prevention.
 * 
 * @returns {boolean} true if answer was successfully recorded, false if already answered
 */
export const lockAnswer = async (quizId, studentId, questionId) => {
    const key = answerKeys.getKey(quizId, studentId, questionId);
    
    // SET key "locked" NX
    // NX: Only set the key if it does not already exist.
    // Returns 'OK' if set, null if key already existed.
    const result = await redisClient.set(key, 'locked', { NX: true });
    
    return result === 'OK';
};

/**
 * Removes the lock, used primarily during cleanup when a quiz is submitted.
 */
export const unlockAnswer = async (quizId, studentId, questionId) => {
    const key = answerKeys.getKey(quizId, studentId, questionId);
    await redisClient.del(key);
};
