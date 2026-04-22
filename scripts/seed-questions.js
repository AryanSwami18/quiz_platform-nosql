import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri =
  process.env.MONGO_URI ||
  'mongodb://root:rootpassword@localhost:27017/quiz_platform?authSource=admin';

const quizTemplates = [
  {
    title: 'JavaScript Mastery Sprint',
    description: 'Closures, async flow, DOM behavior and language fundamentals.',
    duration_minutes: 25,
    created_by: 'faculty_js',
    status: 'published',
    subjects: ['JavaScript', 'Web APIs'],
    questions: [
      {
        question_text: 'Which method creates a new array with all elements that pass a test?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'JavaScript',
        options: ['map()', 'filter()', 'reduce()', 'forEach()'],
        correct_option: 1,
      },
      {
        question_text: 'Promises are eager and start running as soon as they are created.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'JavaScript',
        is_true: true,
      },
      {
        question_text: 'Write a function that returns the sum of two numbers.',
        type: 'CODING',
        difficulty: 'medium',
        subject: 'JavaScript',
        language: 'javascript',
        test_cases: [
          { input: '2, 5', expected_output: '7' },
          { input: '-2, 8', expected_output: '6' },
        ],
      },
      {
        question_text: 'What keyword preserves block scope for a variable?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'JavaScript',
        options: ['var', 'let', 'const', 'static'],
        correct_option: 1,
      },
      {
        question_text: 'setTimeout(callback, 0) runs before currently executing synchronous code.',
        type: 'TRUE_FALSE',
        difficulty: 'hard',
        subject: 'Web APIs',
        is_true: false,
      },
      {
        question_text: 'Which operator safely accesses nested properties without throwing?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'JavaScript',
        options: ['??', '?.', '===', '=>'],
        correct_option: 1,
      },
      {
        question_text: 'Arrow functions bind their own this value by default.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'JavaScript',
        is_true: false,
      },
      {
        question_text: 'Which array method is best for combining array values into one result?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'JavaScript',
        options: ['reduce()', 'slice()', 'sort()', 'find()'],
        correct_option: 0,
      },
      {
        question_text: 'Create a function that returns whether a number is even.',
        type: 'CODING',
        difficulty: 'medium',
        subject: 'JavaScript',
        language: 'javascript',
        test_cases: [
          { input: '4', expected_output: 'true' },
          { input: '9', expected_output: 'false' },
        ],
      },
      {
        question_text: 'What does JSON.parse() return?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'JavaScript',
        options: ['A string', 'A JavaScript value', 'A Buffer', 'A Promise'],
        correct_option: 1,
      },
      {
        question_text: 'The spread operator can be used to clone arrays.',
        type: 'TRUE_FALSE',
        difficulty: 'easy',
        subject: 'JavaScript',
        is_true: true,
      },
      {
        question_text: 'Which event fires when the DOM is fully parsed?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'Web APIs',
        options: ['load', 'DOMContentLoaded', 'ready', 'parse'],
        correct_option: 1,
      },
    ],
  },
  {
    title: 'Node and Mongo Systems Quiz',
    description: 'Backend flow, NoSQL modeling, and API design.',
    duration_minutes: 30,
    created_by: 'faculty_backend',
    status: 'published',
    subjects: ['Node.js', 'MongoDB'],
    questions: [
      {
        question_text: 'Which Express middleware parses incoming JSON bodies?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'Node.js',
        options: ['express.json()', 'express.static()', 'cors()', 'router.use()'],
        correct_option: 0,
      },
      {
        question_text: 'MongoDB stores documents in BSON format.',
        type: 'TRUE_FALSE',
        difficulty: 'easy',
        subject: 'MongoDB',
        is_true: true,
      },
      {
        question_text: 'Write a function that returns an HTTP 404 status message string.',
        type: 'CODING',
        difficulty: 'easy',
        subject: 'Node.js',
        language: 'javascript',
        test_cases: [
          { input: '', expected_output: 'Not Found' },
        ],
      },
      {
        question_text: 'Which MongoDB stage joins documents from another collection?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'MongoDB',
        options: ['$group', '$match', '$lookup', '$sort'],
        correct_option: 2,
      },
      {
        question_text: 'Indexes usually slow down reads but speed up writes.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'MongoDB',
        is_true: false,
      },
      {
        question_text: 'Which Node.js module is commonly used to create HTTP servers?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'Node.js',
        options: ['path', 'events', 'http', 'cluster'],
        correct_option: 2,
      },
      {
        question_text: 'The Attribute Pattern helps when documents share common fields with varying attributes.',
        type: 'TRUE_FALSE',
        difficulty: 'hard',
        subject: 'MongoDB',
        is_true: true,
      },
      {
        question_text: 'Which status code is usually returned for a successful resource creation?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'Node.js',
        options: ['200', '201', '204', '301'],
        correct_option: 1,
      },
      {
        question_text: 'Write a function that returns the number of keys in an object.',
        type: 'CODING',
        difficulty: 'medium',
        subject: 'Node.js',
        language: 'javascript',
        test_cases: [
          { input: '{a:1,b:2}', expected_output: '2' },
        ],
      },
      {
        question_text: '$match should usually appear early in an aggregation pipeline when possible.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'MongoDB',
        is_true: true,
      },
      {
        question_text: 'Which Redis data structure is best for a leaderboard?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'Node.js',
        options: ['List', 'Set', 'Hash', 'Sorted Set'],
        correct_option: 3,
      },
      {
        question_text: 'A unique index can help prevent duplicate submissions.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'MongoDB',
        is_true: true,
      },
    ],
  },
  {
    title: 'Frontend Performance and React Quiz',
    description: 'React state, rendering, hooks, and browser behavior.',
    duration_minutes: 20,
    created_by: 'faculty_ui',
    status: 'published',
    subjects: ['React', 'Frontend'],
    questions: [
      {
        question_text: 'Which hook stores local component state?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'React',
        options: ['useEffect', 'useState', 'useRef', 'useId'],
        correct_option: 1,
      },
      {
        question_text: 'React components should mutate state objects directly for best performance.',
        type: 'TRUE_FALSE',
        difficulty: 'easy',
        subject: 'React',
        is_true: false,
      },
      {
        question_text: 'Write a function component that returns a heading element.',
        type: 'CODING',
        difficulty: 'easy',
        subject: 'React',
        language: 'javascript',
        test_cases: [
          { input: '', expected_output: '<h1>' },
        ],
      },
      {
        question_text: 'What prop helps React identify list items efficiently?',
        type: 'MCQ',
        difficulty: 'medium',
        subject: 'React',
        options: ['index', 'name', 'key', 'idRef'],
        correct_option: 2,
      },
      {
        question_text: 'Debouncing is useful when reducing repeated rapid user-triggered work.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'Frontend',
        is_true: true,
      },
      {
        question_text: 'Which CSS property changes layout direction inside a flex container?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'Frontend',
        options: ['justify-content', 'flex-direction', 'align-items', 'display'],
        correct_option: 1,
      },
      {
        question_text: 'useRef updates always trigger a component rerender.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'React',
        is_true: false,
      },
      {
        question_text: 'Which browser API provides a one-way server push channel over HTTP?',
        type: 'MCQ',
        difficulty: 'hard',
        subject: 'Frontend',
        options: ['WebRTC', 'EventSource', 'History API', 'MutationObserver'],
        correct_option: 1,
      },
      {
        question_text: 'Write a function that returns a class name string based on a boolean.',
        type: 'CODING',
        difficulty: 'medium',
        subject: 'React',
        language: 'javascript',
        test_cases: [
          { input: 'true', expected_output: 'active' },
          { input: 'false', expected_output: 'inactive' },
        ],
      },
      {
        question_text: 'Semantic HTML can improve accessibility and SEO.',
        type: 'TRUE_FALSE',
        difficulty: 'easy',
        subject: 'Frontend',
        is_true: true,
      },
      {
        question_text: 'Which hook runs side effects after render?',
        type: 'MCQ',
        difficulty: 'easy',
        subject: 'React',
        options: ['useEffect', 'useContext', 'useMemo', 'useSyncExternalStore'],
        correct_option: 0,
      },
      {
        question_text: 'A loading skeleton is generally better than a completely blank screen during fetches.',
        type: 'TRUE_FALSE',
        difficulty: 'medium',
        subject: 'Frontend',
        is_true: true,
      },
    ],
  },
];

function buildQuestion(question, quizId, order) {
  const now = new Date();
  const base = {
    quiz_id: quizId,
    order,
    question_text: question.question_text,
    type: question.type,
    difficulty: question.difficulty,
    subject: question.subject,
    points: 10,
    created_at: now,
    updated_at: now,
  };

  if (question.type === 'MCQ') {
    return {
      ...base,
      options: question.options,
      option_count: question.options.length,
      correct_option: question.correct_option,
    };
  }

  if (question.type === 'TRUE_FALSE') {
    return {
      ...base,
      is_true: question.is_true,
    };
  }

  return {
    ...base,
    language: question.language,
    test_cases: question.test_cases,
  };
}

function buildMockAttempts(quizId, quizTitle, questionIds, totalPoints) {
  const students = [
    ['studentA', 'Aarav'],
    ['studentB', 'Diya'],
    ['studentC', 'Kabir'],
    ['studentD', 'Meera'],
    ['studentE', 'Rohan'],
    ['studentF', 'Sara'],
  ];

  return students.flatMap(([studentId, studentName], index) => {
    const score = Math.max(20, totalPoints - index * 20);
    const percentage = Number(((score / totalPoints) * 100).toFixed(2));
    const answers = questionIds.map((questionId, answerIndex) => {
      const isCorrect = (answerIndex + index) % 4 !== 0;
      return {
        question_id: questionId,
        question_text: `Seeded question ${answerIndex + 1}`,
        subject: answerIndex % 2 === 0 ? 'General' : 'Practice',
        type: 'MCQ',
        answer: isCorrect ? 'Correct choice' : 'Incorrect choice',
        correct_answer: 'Correct choice',
        is_correct: isCorrect,
        points_earned: isCorrect ? 10 : 0,
      };
    });

    return {
      quiz_id: quizId,
      quiz_title: quizTitle,
      student_id: studentId,
      student_name: studentName,
      started_at: new Date(Date.now() - (index + 1) * 45 * 60 * 1000),
      submitted_at: new Date(Date.now() - index * 15 * 60 * 1000),
      time_taken_seconds: 600 + index * 45,
      score,
      percentage,
      passed: percentage >= 60,
      rank: index + 1,
      submission_source: 'seeded-history',
      answers,
      answer_count: answers.length,
      total_questions: questionIds.length,
    };
  });
}

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'quiz_platform');

    await db.collection('questions').deleteMany({});
    await db.collection('quizzes').deleteMany({});
    await db.collection('quiz_attempts').deleteMany({});

    let totalQuestions = 0;
    const allAttempts = [];

    for (const template of quizTemplates) {
      const quizId = new ObjectId();
      const questions = template.questions.map((question, index) =>
        buildQuestion(question, quizId, index + 1),
      );

      const questionInsert = await db.collection('questions').insertMany(questions);
      const questionIds = Object.values(questionInsert.insertedIds);
      const totalPoints = questionIds.length * 10;

      await db.collection('quizzes').insertOne({
        _id: quizId,
        title: template.title,
        description: template.description,
        duration_minutes: template.duration_minutes,
        passing_score: Math.ceil(totalPoints * 0.6),
        total_points: totalPoints,
        created_by: template.created_by,
        status: template.status,
        subjects: template.subjects,
        created_at: new Date(),
        updated_at: new Date(),
        question_count: questionIds.length,
        question_ids: questionIds,
      });

      totalQuestions += questions.length;
      allAttempts.push(...buildMockAttempts(quizId, template.title, questionIds, totalPoints));
    }

    await db.collection('quiz_attempts').insertMany(allAttempts);

    console.log(`Seeded ${quizTemplates.length} quizzes`);
    console.log(`Seeded ${totalQuestions} questions`);
    console.log(`Seeded ${allAttempts.length} quiz attempts`);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seed();
