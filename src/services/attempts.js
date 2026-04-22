import { ObjectId } from 'mongodb';
import redisClient from '../db/redis.js';
import { getDb } from '../db/mongo.js';
import { deleteLeaderboard, getLeaderboard } from '../redis/leaderboard.js';
import {
  deleteSession,
  getSession,
  getSessionSnapshot,
  sessionKeys,
} from '../redis/session.js';
import { clearStudentAnswerLocks } from '../redis/answers.js';
import { quizEmitter, EVENTS } from '../utils/emitter.js';

const submissionRecordKey = (quizId, studentId) =>
  `submission:${quizId}:${studentId}`;
const expirationScheduleKey = 'quiz_session_expirations';
const expirationMember = (quizId, studentId) => `${quizId}:${studentId}`;

export async function scheduleSessionExpiration(quizId, studentId, expiresAtMs) {
  await redisClient.zAdd(expirationScheduleKey, [
    { score: expiresAtMs, value: expirationMember(quizId, studentId) },
  ]);
}

export async function unscheduleSessionExpiration(quizId, studentId) {
  await redisClient.zRem(expirationScheduleKey, expirationMember(quizId, studentId));
}

export async function getExistingSubmission(quizId, studentId) {
  const attemptId = await redisClient.get(submissionRecordKey(quizId, studentId));
  if (!attemptId) {
    return null;
  }

  const db = await getDb();
  return db.collection('quiz_attempts').findOne({ _id: new ObjectId(attemptId) });
}

function normalizeAnswerValue(answer) {
  if (typeof answer === 'string') {
    return answer;
  }

  return JSON.stringify(answer);
}

export async function persistQuizAttempt({
  quizId,
  studentId,
  studentName,
  submissionSource = 'manual',
}) {
  const existingAttempt = await getExistingSubmission(quizId, studentId);
  if (existingAttempt) {
    return { attempt: existingAttempt, alreadySubmitted: true };
  }

  const db = await getDb();
  const session =
    (await getSession(quizId, studentId)) || (await getSessionSnapshot(quizId, studentId));
  const quizObjectId = new ObjectId(quizId);
  const quiz = await db.collection('quizzes').findOne({ _id: quizObjectId });

  if (!quiz) {
    throw new Error('Quiz not found');
  }

  if (!session) {
    const mongoAttempt = await db.collection('quiz_attempts').findOne(
      { quiz_id: quizObjectId, student_id: studentId },
      { sort: { submitted_at: -1 } },
    );

    if (mongoAttempt) {
      return { attempt: mongoAttempt, alreadySubmitted: true };
    }
  }

  const answersMap = session?.answers || {};
  const answerQuestionIds = Object.keys(answersMap).map((id) => new ObjectId(id));
  const questionDocs = answerQuestionIds.length
    ? await db
        .collection('questions')
        .find({ _id: { $in: answerQuestionIds } })
        .toArray()
    : [];

  const questionLookup = new Map(
    questionDocs.map((question) => [question._id.toString(), question]),
  );

  const answers = Object.entries(answersMap).map(([questionId, answerData]) => {
    const question = questionLookup.get(questionId);
    let correctAnswer = null;

    if (question?.type === 'MCQ') {
      correctAnswer = question.options?.[question.correct_option] ?? null;
    } else if (question?.type === 'TRUE_FALSE') {
      correctAnswer = question.is_true;
    } else if (question?.type === 'CODING') {
      correctAnswer =
        question.test_cases?.map((testCase) => testCase.expected_output).join(', ') ?? null;
    }

    return {
      question_id: new ObjectId(questionId),
      question_text: question?.question_text ?? 'Unknown question',
      subject: question?.subject ?? 'General',
      type: question?.type ?? 'MCQ',
      answer: normalizeAnswerValue(answerData.answer),
      is_correct: Boolean(answerData.is_correct),
      points_earned: Number(answerData.points_earned || 0),
      correct_answer: normalizeAnswerValue(correctAnswer),
    };
  });

  const score = session?.score ?? 0;
  const leaderboard = await getLeaderboard(quizId, studentId);
  const startedAt = session?.startedAt ? new Date(session.startedAt) : new Date();
  const submittedAt = new Date();
  const timeTakenSeconds = Math.max(
    0,
    Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const percentage = quiz.total_points
    ? Number(((score / quiz.total_points) * 100).toFixed(2))
    : 0;

  const attempt = {
    quiz_id: quizObjectId,
    quiz_title: quiz.title,
    student_id: studentId,
    student_name: studentName || studentId,
    started_at: startedAt,
    submitted_at: submittedAt,
    time_taken_seconds: timeTakenSeconds,
    score,
    percentage,
    passed: score >= (quiz.passing_score || 0),
    answers,
    answer_count: answers.length,
    total_questions: quiz.question_ids?.length || 0,
    rank: leaderboard.yourRank,
    submission_source: submissionSource,
  };

  const result = await db.collection('quiz_attempts').insertOne(attempt);
  attempt._id = result.insertedId;

  await redisClient.set(submissionRecordKey(quizId, studentId), result.insertedId.toString(), {
    EX: 60 * 60 * 24,
  });
  await deleteSession(quizId, studentId);
  await clearStudentAnswerLocks(quizId, studentId);
  await unscheduleSessionExpiration(quizId, studentId);
  quizEmitter.emit(EVENTS.LEADERBOARD_UPDATE, quizId);

  return { attempt, alreadySubmitted: false };
}

export async function processExpiredSessions() {
  const now = Date.now();
  const expiredMembers = await redisClient.zRangeByScore(expirationScheduleKey, 0, now);

  if (!expiredMembers.length) {
    return 0;
  }

  let processed = 0;

  for (const member of expiredMembers) {
    const [quizId, studentId] = member.split(':');
    const sessionKey = sessionKeys.getKey(quizId, studentId);
    const sessionExists = await redisClient.exists(sessionKey);

    if (sessionExists) {
      continue;
    }

    const alreadySubmitted = await getExistingSubmission(quizId, studentId);
    if (!alreadySubmitted) {
      await persistQuizAttempt({
        quizId,
        studentId,
        studentName: studentId,
        submissionSource: 'ttl-expiry',
      });
    }

    await unscheduleSessionExpiration(quizId, studentId);
    processed += 1;
  }

  return processed;
}

export function startSessionExpiryWorker() {
  const intervalMs = Number(process.env.SESSION_SWEEP_INTERVAL_MS || 3000);
  return setInterval(() => {
    processExpiredSessions().catch((error) => {
      console.error('Session expiry worker failed:', error.message);
    });
  }, intervalMs);
}

export async function teardownQuizRealtimeState(quizId) {
  await deleteLeaderboard(quizId);
}
