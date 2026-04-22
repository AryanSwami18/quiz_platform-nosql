import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { initSession, getSession, updateSessionAnswer, deleteSession } from '../redis/session.js';
import { incrementScore, getLeaderboard } from '../redis/leaderboard.js';
import { lockAnswer, unlockAnswer } from '../redis/answers.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const uri = process.env.MONGO_URI || 'mongodb://root:rootpassword@localhost:27017/quiz_platform?authSource=admin';
const client = new MongoClient(uri);

async function getDb() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('quiz_platform');
}

// Helper to remove correct answers from question payload
const stripAnswers = (question) => {
    const q = { ...question };
    delete q.correct_option;
    delete q.is_true;
    // For coding questions, we might want to hide test cases or at least expected outputs, but we'll keep it simple for now
    return q;
};

// 0. Get Active Quiz
router.get('/active', async (req, res) => {
    try {
        const db = await getDb();
        const quiz = await db.collection('quizzes').findOne({ status: 'published' });
        if (!quiz) return res.status(404).json({ error: 'No active quiz found' });
        res.json({ id: quiz._id, title: quiz.title, duration_minutes: quiz.duration_minutes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Start Quiz
router.post('/:id/start', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = req.params.id;
        const { studentId, studentName } = req.body;

        if (!studentId || !studentName) {
            return res.status(400).json({ error: 'studentId and studentName required' });
        }

        const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quizId) });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        const sessionCreated = await initSession(quizId, studentId, quiz.duration_minutes);
        if (!sessionCreated) {
            return res.status(400).json({ error: 'Session already active for this student' });
        }

        const questions = await db.collection('questions').find({ quiz_id: new ObjectId(quizId) }).toArray();

        res.json({
            message: 'Quiz started successfully',
            sessionId: `${quizId}:${studentId}`,
            duration_minutes: quiz.duration_minutes,
            questions: questions.map(stripAnswers)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Submit Answer
router.post('/:id/answer', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = req.params.id;
        const { studentId, questionId, answer } = req.body;

        if (!studentId || !questionId || answer === undefined) {
            return res.status(400).json({ error: 'studentId, questionId, answer required' });
        }

        // Check if session exists (TTL hasn't expired)
        const session = await getSession(quizId, studentId);
        if (!session) {
            return res.status(400).json({ error: 'Quiz session expired or not started' });
        }

        // Spam prevention: atomic lock
        const locked = await lockAnswer(quizId, studentId, questionId);
        if (!locked) {
            return res.status(400).json({ error: 'Answer already submitted for this question' });
        }

        // Validate answer
        const question = await db.collection('questions').findOne({ _id: new ObjectId(questionId) });
        if (!question) {
            // Revert lock since question is invalid
            await unlockAnswer(quizId, studentId, questionId);
            return res.status(404).json({ error: 'Question not found' });
        }

        let isCorrect = false;
        let pointsEarned = 0;

        if (question.type === 'MCQ') {
            isCorrect = parseInt(answer) === question.correct_option;
        } else if (question.type === 'TRUE_FALSE') {
            isCorrect = Boolean(answer) === question.is_true;
        } else if (question.type === 'CODING') {
            // Mocking execution: simply say it's correct for now
            isCorrect = true; 
        }

        if (isCorrect) {
            pointsEarned = 10; // Fixed 10 points for simplicity, or use question.points
            // Update leaderboard
            await incrementScore(quizId, studentId, pointsEarned);
        }

        // Update session
        const answerData = { answer, is_correct: isCorrect, points_earned: pointsEarned };
        await updateSessionAnswer(quizId, studentId, questionId, answerData, pointsEarned);

        const currentLeaderboard = await getLeaderboard(quizId, studentId);

        res.json({
            message: 'Answer recorded',
            correct: isCorrect,
            points_earned: pointsEarned,
            your_rank: currentLeaderboard.yourRank
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Get Leaderboard
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const quizId = req.params.id;
        const studentId = req.query.student_id;

        const leaderboard = await getLeaderboard(quizId, studentId || 'anonymous');
        
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Submit Quiz (Manual or Auto on TTL)
router.post('/:id/submit', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = req.params.id;
        const { studentId, studentName } = req.body;

        if (!studentId || !studentName) {
            return res.status(400).json({ error: 'studentId and studentName required' });
        }

        const session = await getSession(quizId, studentId);
        let score = 0;
        let answersObj = {};

        if (session) {
            score = session.score;
            answersObj = session.answers;
            await deleteSession(quizId, studentId);
            // Optionally: cleanup locks for this student, but Redis expires them eventually if we set TTL on locks
        } else {
            // Session expired (TTL triggered auto-submit equivalent, meaning we might not have the session state easily if we don't catch expired events).
            // For a robust system, we would listen to Redis Keyspace Notifications for expirations.
            // But since this endpoint might be called by the frontend on TTL expiry, we can just say session is closed.
            // If they answered questions, the score is already in the leaderboard.
            const lb = await getLeaderboard(quizId, studentId);
            score = lb.yourScore || 0;
        }

        const answersArray = Object.keys(answersObj).map(qId => ({
            question_id: new ObjectId(qId),
            answer: answersObj[qId].answer,
            is_correct: answersObj[qId].is_correct,
            points_earned: answersObj[qId].points_earned
        }));

        const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quizId) });

        const attempt = {
            quiz_id: new ObjectId(quizId),
            student_id: studentId,
            student_name: studentName,
            started_at: session ? new Date(session.startedAt) : new Date(),
            submitted_at: new Date(),
            answers: answersArray,
            score: score,
            percentage: quiz ? (score / quiz.total_points) * 100 : 0,
            passed: quiz ? score >= quiz.passing_score : false
        };

        const result = await db.collection('quiz_attempts').insertOne(attempt);

        const lbInfo = await getLeaderboard(quizId, studentId);

        res.json({
            message: 'Quiz submitted and saved to history successfully',
            attempt_id: result.insertedId,
            final_score: score,
            rank: lbInfo.yourRank
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Results
router.get('/:id/results', async (req, res) => {
    try {
        const db = await getDb();
        const { attempt_id } = req.query;

        if (!attempt_id) {
            return res.status(400).json({ error: 'attempt_id required' });
        }

        const attempt = await db.collection('quiz_attempts').findOne({ _id: new ObjectId(attempt_id) });
        if (!attempt) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        res.json(attempt);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
