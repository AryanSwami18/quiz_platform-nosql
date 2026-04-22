import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
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

// 1. Create a draft quiz
router.post('/quiz', async (req, res) => {
    try {
        const db = await getDb();
        const { title, description, duration_minutes, passing_score, facultyId } = req.body;

        if (!title || !duration_minutes) {
            return res.status(400).json({ error: 'title and duration_minutes are required' });
        }

        const newQuiz = {
            title,
            description: description || '',
            duration_minutes: parseInt(duration_minutes),
            passing_score: parseInt(passing_score) || 50,
            total_points: 0, // Will update as questions are added
            created_by: facultyId || 'anonymous_faculty',
            status: 'draft',
            created_at: new Date(),
            updated_at: new Date(),
            question_ids: []
        };

        const result = await db.collection('quizzes').insertOne(newQuiz);
        res.json({ message: 'Quiz draft created', quizId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Add a question to a quiz
router.post('/quiz/:id/question', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = new ObjectId(req.params.id);
        const { question_text, type, difficulty, subject, options, correct_option, is_true, test_cases, language } = req.body;

        if (!question_text || !type || !difficulty || !subject) {
            return res.status(400).json({ error: 'question_text, type, difficulty, subject are required' });
        }

        const question = {
            quiz_id: quizId,
            question_text,
            type,
            difficulty,
            subject,
            created_at: new Date(),
            updated_at: new Date()
        };

        // Attribute Pattern Enforcement
        if (type === 'MCQ') {
            if (!options || !Array.isArray(options) || correct_option === undefined) {
                return res.status(400).json({ error: 'MCQ requires options array and correct_option index' });
            }
            question.options = options;
            question.correct_option = parseInt(correct_option);
        } else if (type === 'TRUE_FALSE') {
            if (is_true === undefined) {
                return res.status(400).json({ error: 'TRUE_FALSE requires is_true boolean' });
            }
            question.is_true = Boolean(is_true);
        } else if (type === 'CODING') {
            if (!test_cases || !Array.isArray(test_cases) || !language) {
                return res.status(400).json({ error: 'CODING requires test_cases array and language' });
            }
            question.test_cases = test_cases;
            question.language = language;
        } else {
            return res.status(400).json({ error: 'Invalid question type' });
        }

        const result = await db.collection('questions').insertOne(question);

        // Add question to quiz array and increase points
        await db.collection('quizzes').updateOne(
            { _id: quizId },
            { 
                $push: { question_ids: result.insertedId },
                $inc: { total_points: 10 } // Hardcoded 10 pts per question for simplicity
            }
        );

        res.json({ message: 'Question added', questionId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Publish Quiz
router.post('/quiz/:id/publish', async (req, res) => {
    try {
        const db = await getDb();
        const quizId = new ObjectId(req.params.id);

        // Optional: archive all other published quizzes to make this the active one
        await db.collection('quizzes').updateMany(
            { status: 'published' },
            { $set: { status: 'archived', updated_at: new Date() } }
        );

        // Publish this one
        const result = await db.collection('quizzes').updateOne(
            { _id: quizId },
            { $set: { status: 'published', updated_at: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json({ message: 'Quiz published and is now the active quiz!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
