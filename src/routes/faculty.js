import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';

const router = express.Router();

function normalizeQuestionPayload(body, quizId, order) {
  const {
    question_text,
    type,
    difficulty,
    subject,
    options,
    correct_option,
    is_true,
    test_cases,
    language,
    points,
  } = body;

  if (!question_text || !type || !difficulty || !subject) {
    throw new Error('question_text, type, difficulty and subject are required');
  }

  const question = {
    quiz_id: quizId,
    order,
    question_text,
    type,
    difficulty,
    subject,
    points: Number(points || 10),
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (type === 'MCQ') {
    if (!Array.isArray(options) || options.length < 2 || correct_option === undefined) {
      throw new Error('MCQ requires options and correct_option');
    }

    question.options = options;
    question.option_count = options.length;
    question.correct_option = Number(correct_option);
  } else if (type === 'TRUE_FALSE') {
    if (is_true === undefined) {
      throw new Error('TRUE_FALSE requires is_true');
    }

    question.is_true = Boolean(is_true);
  } else if (type === 'CODING') {
    if (!Array.isArray(test_cases) || !test_cases.length || !language) {
      throw new Error('CODING requires test_cases and language');
    }

    question.language = language;
    question.test_cases = test_cases;
  } else {
    throw new Error('Invalid question type');
  }

  return question;
}

router.get('/quizzes', async (req, res) => {
  try {
    const db = await getDb();
    const createdBy = req.query.facultyId;
    const query = createdBy ? { created_by: createdBy } : {};
    const quizzes = await db.collection('quizzes').find(query).sort({ created_at: -1 }).toArray();

    res.json(
      quizzes.map((quiz) => ({
        ...quiz,
        question_count: quiz.question_ids?.length || 0,
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quiz/:id', async (req, res) => {
  try {
    const db = await getDb();
    const quizId = new ObjectId(req.params.id);
    const quiz = await db.collection('quizzes').findOne({ _id: quizId });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await db
      .collection('questions')
      .find({ quiz_id: quizId })
      .sort({ order: 1, created_at: 1 })
      .toArray();

    res.json({
      ...quiz,
      question_count: questions.length,
      questions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/quiz', async (req, res) => {
  try {
    const db = await getDb();
    const {
      title,
      description,
      duration_minutes,
      passing_score,
      facultyId,
      subject,
    } = req.body;

    if (!title || !duration_minutes) {
      return res.status(400).json({ error: 'title and duration_minutes are required' });
    }

    const quiz = {
      title,
      description: description || '',
      duration_minutes: Number(duration_minutes),
      passing_score: Number(passing_score || 0),
      total_points: 0,
      created_by: facultyId || 'faculty_demo',
      status: 'draft',
      subjects: subject ? [subject] : [],
      created_at: new Date(),
      updated_at: new Date(),
      question_ids: [],
    };

    const result = await db.collection('quizzes').insertOne(quiz);
    res.json({ message: 'Quiz created', quizId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/quiz/:id/question', async (req, res) => {
  try {
    const db = await getDb();
    const quizId = new ObjectId(req.params.id);
    const quiz = await db.collection('quizzes').findOne({ _id: quizId });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const order = (quiz.question_ids?.length || 0) + 1;
    const question = normalizeQuestionPayload(req.body, quizId, order);
    const result = await db.collection('questions').insertOne(question);

    const nextSubjects = new Set([...(quiz.subjects || []), question.subject]);
    const nextTotalPoints = (quiz.total_points || 0) + (question.points || 10);
    const questionCount = (quiz.question_ids?.length || 0) + 1;
    const fallbackPassingScore =
      req.body.recalculate_passing_score === false
        ? quiz.passing_score || 0
        : Math.ceil(nextTotalPoints * 0.6);

    await db.collection('quizzes').updateOne(
      { _id: quizId },
      {
        $push: { question_ids: result.insertedId },
        $set: {
          total_points: nextTotalPoints,
          passing_score: Math.max(Number(quiz.passing_score || 0), fallbackPassingScore),
          subjects: [...nextSubjects],
          updated_at: new Date(),
          question_count: questionCount,
        },
      },
    );

    res.json({ message: 'Question added', questionId: result.insertedId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/quiz/:id/publish', async (req, res) => {
  try {
    const db = await getDb();
    const quizId = new ObjectId(req.params.id);
    const quiz = await db.collection('quizzes').findOne({ _id: quizId });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.question_ids?.length) {
      return res.status(400).json({ error: 'Add at least one question before publishing' });
    }

    await db.collection('quizzes').updateOne(
      { _id: quizId },
      {
        $set: {
          status: 'published',
          updated_at: new Date(),
          total_points: quiz.total_points || quiz.question_ids.length * 10,
          passing_score: quiz.passing_score || Math.ceil((quiz.total_points || quiz.question_ids.length * 10) * 0.6),
        },
      },
    );

    res.json({ message: 'Quiz published successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
