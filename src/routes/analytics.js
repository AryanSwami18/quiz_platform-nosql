import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

const router = express.Router();

async function runAggregateWithExplain(collection, pipeline) {
  const results = await collection.aggregate(pipeline).toArray();
  const explain = await collection.aggregate(pipeline).explain('executionStats');
  return { results, explain };
}

router.get('/avg-score/:quizId', async (req, res) => {
  try {
    const db = await getDb();
    const quizId = new ObjectId(req.params.quizId);
    const pipeline = [
      { $match: { quiz_id: quizId } },
      {
        $group: {
          _id: '$quiz_id',
          averageScore: { $avg: '$score' },
          averagePercentage: { $avg: '$percentage' },
          bestScore: { $max: '$score' },
          totalAttempts: { $sum: 1 },
        },
      },
    ];

    res.json(await runAggregateWithExplain(db.collection('quiz_attempts'), pipeline));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-students', async (_req, res) => {
  try {
    const db = await getDb();
    const pipeline = [
      {
        $group: {
          _id: '$student_id',
          studentName: { $first: '$student_name' },
          totalScore: { $sum: '$score' },
          averagePercentage: { $avg: '$percentage' },
          quizzesTaken: { $addToSet: '$quiz_id' },
        },
      },
      {
        $project: {
          _id: 1,
          studentName: 1,
          totalScore: 1,
          averagePercentage: 1,
          quizzesTaken: { $size: '$quizzesTaken' },
        },
      },
      { $sort: { totalScore: -1, averagePercentage: -1 } },
      { $limit: 5 },
    ];

    res.json(await runAggregateWithExplain(db.collection('quiz_attempts'), pipeline));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/difficulty-analysis', async (_req, res) => {
  try {
    const db = await getDb();
    const pipeline = [
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.question_id',
          totalAttempts: { $sum: 1 },
          correctAttempts: {
            $sum: { $cond: ['$answers.is_correct', 1, 0] },
          },
        },
      },
      {
        $project: {
          totalAttempts: 1,
          correctAttempts: 1,
          correctRate: { $divide: ['$correctAttempts', '$totalAttempts'] },
        },
      },
      { $match: { correctRate: { $lt: 0.3 } } },
      {
        $lookup: {
          from: 'questions',
          localField: '_id',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      {
        $project: {
          question_id: '$_id',
          question_text: '$question.question_text',
          subject: '$question.subject',
          difficulty: '$question.difficulty',
          totalAttempts: 1,
          correctAttempts: 1,
          correctRate: 1,
        },
      },
      { $sort: { correctRate: 1, totalAttempts: -1 } },
    ];

    res.json(await runAggregateWithExplain(db.collection('quiz_attempts'), pipeline));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/subject-comparison', async (_req, res) => {
  try {
    const db = await getDb();
    const pipeline = [
      { $unwind: '$answers' },
      {
        $lookup: {
          from: 'questions',
          localField: 'answers.question_id',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      {
        $group: {
          _id: '$question.subject',
          totalAttempts: { $sum: 1 },
          correctAttempts: {
            $sum: { $cond: ['$answers.is_correct', 1, 0] },
          },
          averagePoints: { $avg: '$answers.points_earned' },
        },
      },
      {
        $project: {
          subject: '$_id',
          totalAttempts: 1,
          correctRate: { $divide: ['$correctAttempts', '$totalAttempts'] },
          averagePoints: 1,
        },
      },
      { $sort: { correctRate: -1, totalAttempts: -1 } },
    ];

    res.json(await runAggregateWithExplain(db.collection('quiz_attempts'), pipeline));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/index-proof/:quizId', async (req, res) => {
  try {
    const db = await getDb();
    const quizId = new ObjectId(req.params.quizId);
    const explain = await db
      .collection('quiz_attempts')
      .find({ quiz_id: quizId })
      .sort({ score: -1 })
      .limit(5)
      .explain('executionStats');

    res.json(explain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
