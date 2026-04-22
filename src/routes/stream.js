import express from 'express';
import { quizEmitter, EVENTS } from '../utils/emitter.js';
import { getLeaderboard } from '../redis/leaderboard.js';

const router = express.Router();

// 1. SSE Stream for Leaderboard Updates
router.get('/:quizId/leaderboard', async (req, res) => {
    const { quizId } = req.params;
    const { student_id } = req.query;

    // Headers necessary for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send an initial connected message (optional, helps client know connection is established)
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

    // Send the current initial leaderboard state
    try {
        const initialLeaderboard = await getLeaderboard(quizId, student_id || 'anonymous');
        res.write(`data: ${JSON.stringify({ type: 'UPDATE', payload: initialLeaderboard })}\n\n`);
    } catch (err) {
        console.error('Error fetching initial leaderboard for stream:', err);
    }

    // Function to handle the broadcast event
    const handleLeaderboardUpdate = async (updatedQuizId) => {
        if (quizId === updatedQuizId) {
            try {
                // When an update occurs, fetch the latest top 10 and this specific user's rank
                const latestLeaderboard = await getLeaderboard(quizId, student_id || 'anonymous');
                res.write(`data: ${JSON.stringify({ type: 'UPDATE', payload: latestLeaderboard })}\n\n`);
            } catch (err) {
                console.error('Error fetching updated leaderboard for stream:', err);
            }
        }
    };

    // Attach the listener
    quizEmitter.on(EVENTS.LEADERBOARD_UPDATE, handleLeaderboardUpdate);

    // Clean up when the client closes the connection
    req.on('close', () => {
        quizEmitter.off(EVENTS.LEADERBOARD_UPDATE, handleLeaderboardUpdate);
    });
});

export default router;
