import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';
import {
  getSession,
  getSessionTtl,
  initSession,
  updateSessionAnswer,
} from '../redis/session.js';
import { getLeaderboard, incrementScore } from '../redis/leaderboard.js';
import { lockAnswer } from '../redis/answers.js';
import { quizEmitter, EVENTS } from '../utils/emitter.js';
import {
  persistQuizAttempt,
  scheduleSessionExpiration,
} from '../services/attempts.js';

const router = express.Router();

function stripQuestionForClient(question) {
  const sanitized = { ...question };
  delete sanitized.correct_option;
  delete sanitized.is_true;
  delete sanitized.test_cases;
  return sanitized;
}

function evaluateAnswer(question, answer) {
  if (question.type === 'MCQ') {
    return Number(answer) === Number(question.correct_option);
  }

  if (question.type === 'TRUE_FALSE') {
    return String(answer) === String(question.is_true);
  }

  if (question.type === 'CODING') {
    const normalized = String(answer || '').trim().toLowerCase();
    const keywords = ['function', 'return', '=>', 'def ', 'public static'];
    return normalized.length > 0 && keywords.some((keyword) => normalized.includes(keyword));
  }

  return false;
}

async function getQuizWithQuestions(db, quizId) {
  const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quizId) });
  if (!quiz) {
    return null;
  }

  const questions = quiz.question_ids?.length
    ? await db
        .collection('questions')
        .find({ _id: { $in: quiz.question_ids } })
        .sort({ order: 1, created_at: 1 })
        .toArray()
    : [];

  return { quiz, questions };
}

router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const status = req.query.status || 'published';
    const quizzes = await db
      .collection('quizzes')
      .find({ status })
      .project({
        title: 1,
        description: 1,
        duration_minutes: 1,
        total_points: 1,
        passing_score: 1,
        created_by: 1,
        status: 1,
        question_ids: 1,
        subjects: 1,
        created_at: 1,
      })
      .sort({ created_at: -1 })
      .toArray();

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

router.get('/active', async (req, res) => {
  try {
    const db = await getDb();
    const quiz = await db
      .collection('quizzes')
      .find({ status: 'published' })
      .sort({ created_at: -1 })
      .limit(1)
      .next();

    if (!quiz) {
      return res.status(404).json({ error: 'No published quiz found' });
    }

    res.json({
      id: quiz._id,
      title: quiz.title,
      duration_minutes: quiz.duration_minutes,
      question_count: quiz.question_ids?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const payload = await getQuizWithQuestions(db, req.params.id);

    if (!payload) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const { quiz, questions } = payload;
    res.json({
      ...quiz,
      question_count: questions.length,
      questions: questions.map(stripQuestionForClient),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const db = await getDb();
    const { id: quizId } = req.params;
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.status(400).json({ error: 'studentId and studentName are required' });
    }

    const payload = await getQuizWithQuestions(db, quizId);
    if (!payload) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const { quiz, questions } = payload;
    if (quiz.status !== 'published') {
      return res.status(400).json({ error: 'Quiz is not currently published' });
    }

    const existingAttempt = await db.collection('quiz_attempts').findOne(
      { quiz_id: quiz._id, student_id: studentId },
      { sort: { submitted_at: -1 } },
    );

    if (existingAttempt) {
      return res.status(400).json({ error: 'This student has already submitted this quiz' });
    }

    const sessionCreated = await initSession(quizId, studentId, quiz.duration_minutes);
    if (!sessionCreated) {
      return res.status(400).json({ error: 'Session already active for this student' });
    }

    await scheduleSessionExpiration(quizId, studentId, sessionCreated.expiresAt);
    quizEmitter.emit(EVENTS.LEADERBOARD_UPDATE, quizId);

    res.json({
      message: 'Quiz started successfully',
      sessionId: `${quizId}:${studentId}`,
      duration_minutes: quiz.duration_minutes,
      ttl_seconds: sessionCreated.expiresInSeconds,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        total_points: quiz.total_points,
      },
      questions: questions.map(stripQuestionForClient),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/session', async (req, res) => {
  try {
    const { id: quizId } = req.params;
    const studentId = req.query.student_id;

    if (!studentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const session = await getSession(quizId, studentId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const ttlSeconds = await getSessionTtl(quizId, studentId);
    res.json({
      startedAt: session.startedAt,
      score: session.score,
      answers: session.answers,
      ttl_seconds: Math.max(ttlSeconds, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/answer', async (req, res) => {
  try {
    const db = await getDb();
    const { id: quizId } = req.params;
    const { studentId, questionId, answer } = req.body;

    if (!studentId || !questionId || answer === undefined) {
      return res.status(400).json({ error: 'studentId, questionId and answer are required' });
    }

    const session = await getSession(quizId, studentId);
    if (!session) {
      const { attempt } =
        (await persistQuizAttempt({
          quizId,
          studentId,
          studentName: studentId,
          submissionSource: 'ttl-expiry',
        }).catch(() => ({ attempt: null }))) || {};

      return res.status(400).json({
        error: 'Quiz session expired or not started',
        attempt_id: attempt?._id || null,
      });
    }

    const ttlSeconds = Math.max(session.ttlSeconds || 0, 1);
    const locked = await lockAnswer(quizId, studentId, questionId, ttlSeconds);
    if (!locked) {
      return res.status(400).json({ error: 'Answer already submitted for this question' });
    }

    const question = await db.collection('questions').findOne({ _id: new ObjectId(questionId) });
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isCorrect = evaluateAnswer(question, answer);
    const pointsEarned = isCorrect ? Number(question.points || 10) : 0;
    await updateSessionAnswer(
      quizId,
      studentId,
      questionId,
      {
        answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
      },
      pointsEarned,
    );

    if (pointsEarned > 0) {
      await incrementScore(quizId, studentId, pointsEarned);
      quizEmitter.emit(EVENTS.LEADERBOARD_UPDATE, quizId);
    }

    const currentLeaderboard = await getLeaderboard(quizId, studentId);
    res.json({
      message: 'Answer recorded',
      correct: isCorrect,
      points_earned: pointsEarned,
      your_rank: currentLeaderboard.yourRank,
      your_score: currentLeaderboard.yourScore,
      ttl_seconds: session.ttlSeconds,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard(req.params.id, req.query.student_id || 'anonymous');
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const { id: quizId } = req.params;
    const { studentId, studentName } = req.body;

    if (!studentId || !studentName) {
      return res.status(400).json({ error: 'studentId and studentName are required' });
    }

    const { attempt, alreadySubmitted } = await persistQuizAttempt({
      quizId,
      studentId,
      studentName,
      submissionSource: 'manual',
    });

    res.json({
      message: alreadySubmitted ? 'Quiz already submitted' : 'Quiz submitted successfully',
      attempt_id: attempt._id,
      final_score: attempt.score,
      rank: attempt.rank,
      already_submitted: alreadySubmitted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/results', async (req, res) => {
  try {
    const db = await getDb();
    const { attempt_id: attemptId } = req.query;

    if (!attemptId) {
      return res.status(400).json({ error: 'attempt_id is required' });
    }

    const attempt = await db.collection('quiz_attempts').findOne({ _id: new ObjectId(attemptId) });
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const betterAttempts = await db.collection('quiz_attempts').countDocuments({
      quiz_id: attempt.quiz_id,
      score: { $gt: attempt.score },
    });
    const totalAttempts = await db.collection('quiz_attempts').countDocuments({
      quiz_id: attempt.quiz_id,
    });

    res.json({
      ...attempt,
      rank: betterAttempts + 1,
      total_attempts: totalAttempts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
