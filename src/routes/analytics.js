import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const uri = process.env.MONGO_URI || 'mongodb://root:rootpassword@localhost:27017/quiz_platform?authSource=admin';
const client = new MongoClient(uri);

// Connect once for the router (or you could reuse the index.js connection)
// For simplicity and decoupling here, we ensure it's connected
async function getDb() {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db('quiz_platform');
}

// 1. Average Score per Quiz
router.get('/avg-score/:quizId', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = new ObjectId(req.params.quizId);
        
        const pipeline = [
            { $match: { quiz_id: quizId } },
            { 
                $group: { 
                    _id: "$quiz_id", 
                    averageScore: { $avg: "$score" },
                    totalAttempts: { $sum: 1 }
                } 
            }
        ];

        const explain = await db.collection('quiz_attempts').aggregate(pipeline).explain();
        const results = await db.collection('quiz_attempts').aggregate(pipeline).toArray();
        
        res.json({ results, explain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Top 5 Students Overall (across all quizzes)
router.get('/top-students', async (req, res) => {
    try {
        const db = await getDb();
        
        const pipeline = [
            { 
                $group: {
                    _id: "$student_id",
                    studentName: { $first: "$student_name" },
                    totalScore: { $sum: "$score" },
                    quizzesTaken: { $addToSet: "$quiz_id" }
                }
            },
            { $sort: { totalScore: -1 } },
            { $limit: 5 }
        ];

        const explain = await db.collection('quiz_attempts').aggregate(pipeline).explain();
        const results = await db.collection('quiz_attempts').aggregate(pipeline).toArray();
        
        res.json({ results, explain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Question Difficulty Analysis (<30% correct rate)
router.get('/difficulty-analysis', async (req, res) => {
    try {
        const db = await getDb();
        
        const pipeline = [
            { $unwind: "$answers" },
            { 
                $group: {
                    _id: "$answers.question_id",
                    totalAttempts: { $sum: 1 },
                    correctAttempts: { 
                        $sum: { $cond: ["$answers.is_correct", 1, 0] } 
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalAttempts: 1,
                    correctAttempts: 1,
                    correctRate: { $divide: ["$correctAttempts", "$totalAttempts"] }
                }
            },
            { $match: { correctRate: { $lt: 0.3 } } }, // < 30% correct rate
            {
                $lookup: {
                    from: "questions",
                    localField: "_id",
                    foreignField: "_id",
                    as: "questionDetails"
                }
            },
            { $unwind: "$questionDetails" }
        ];

        const explain = await db.collection('quiz_attempts').aggregate(pipeline).explain();
        const results = await db.collection('quiz_attempts').aggregate(pipeline).toArray();
        
        res.json({ results, explain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Subject-wise Comparison
router.get('/subject-comparison', async (req, res) => {
    try {
        const db = await getDb();
        
        const pipeline = [
            { $unwind: "$answers" },
            {
                $lookup: {
                    from: "questions",
                    localField: "answers.question_id",
                    foreignField: "_id",
                    as: "questionDetails"
                }
            },
            { $unwind: "$questionDetails" },
            {
                $group: {
                    _id: "$questionDetails.subject",
                    totalAttempts: { $sum: 1 },
                    correctAttempts: { 
                        $sum: { $cond: ["$answers.is_correct", 1, 0] } 
                    },
                    totalPointsEarned: { $sum: "$answers.points_earned" }
                }
            },
            {
                $project: {
                    _id: 1,
                    subject: "$_id",
                    totalAttempts: 1,
                    correctRate: { $divide: ["$correctAttempts", "$totalAttempts"] },
                    averagePoints: { $divide: ["$totalPointsEarned", "$totalAttempts"] }
                }
            },
            { $sort: { correctRate: -1 } }
        ];

        const explain = await db.collection('quiz_attempts').aggregate(pipeline).explain();
        const results = await db.collection('quiz_attempts').aggregate(pipeline).toArray();
        
        res.json({ results, explain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
