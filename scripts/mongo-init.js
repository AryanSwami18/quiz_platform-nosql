const db = db.getSiblingDB('quiz_platform');

function ensureCollection(name, options) {
  const exists = db.getCollectionInfos({ name }).length > 0;
  if (!exists) {
    db.createCollection(name, options);
    return;
  }

  db.runCommand({
    collMod: name,
    validator: options.validator,
  });
}

ensureCollection('questions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['quiz_id', 'question_text', 'type', 'difficulty', 'subject'],
      properties: {
        _id: { bsonType: 'objectId' },
        quiz_id: { bsonType: 'objectId' },
        order: { bsonType: ['int', 'long'] },
        question_text: { bsonType: 'string' },
        type: { enum: ['MCQ', 'TRUE_FALSE', 'CODING'] },
        difficulty: { enum: ['easy', 'medium', 'hard'] },
        subject: { bsonType: 'string' },
        points: { bsonType: ['int', 'long'] },
        options: {
          bsonType: 'array',
          items: { bsonType: 'string' },
        },
        option_count: { bsonType: ['int', 'long'] },
        correct_option: { bsonType: ['int', 'long'] },
        is_true: { bsonType: 'bool' },
        test_cases: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['input', 'expected_output'],
            properties: {
              input: { bsonType: 'string' },
              expected_output: { bsonType: 'string' },
            },
          },
        },
        language: { bsonType: 'string' },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    },
  },
});

ensureCollection('quizzes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'question_ids', 'duration_minutes', 'created_by'],
      properties: {
        _id: { bsonType: 'objectId' },
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        question_ids: {
          bsonType: 'array',
          items: { bsonType: 'objectId' },
        },
        question_count: { bsonType: ['int', 'long'] },
        duration_minutes: { bsonType: ['int', 'long'] },
        passing_score: { bsonType: ['int', 'long'] },
        total_points: { bsonType: ['int', 'long'] },
        created_by: { bsonType: 'string' },
        subjects: {
          bsonType: 'array',
          items: { bsonType: 'string' },
        },
        status: { enum: ['draft', 'published', 'archived'] },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' },
      },
    },
  },
});

ensureCollection('quiz_attempts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['quiz_id', 'student_id', 'started_at', 'submitted_at'],
      properties: {
        _id: { bsonType: 'objectId' },
        quiz_id: { bsonType: 'objectId' },
        quiz_title: { bsonType: 'string' },
        student_id: { bsonType: 'string' },
        student_name: { bsonType: 'string' },
        started_at: { bsonType: 'date' },
        submitted_at: { bsonType: 'date' },
        time_taken_seconds: { bsonType: ['int', 'long'] },
        score: { bsonType: ['int', 'long', 'double'] },
        percentage: { bsonType: ['double', 'int', 'long'] },
        passed: { bsonType: 'bool' },
        rank: { bsonType: ['int', 'long', 'null'] },
        submission_source: { bsonType: 'string' },
        answers: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['question_id', 'answer', 'is_correct', 'points_earned'],
            properties: {
              question_id: { bsonType: 'objectId' },
              question_text: { bsonType: 'string' },
              subject: { bsonType: 'string' },
              type: { bsonType: 'string' },
              answer: { bsonType: 'string' },
              correct_answer: { bsonType: ['string', 'bool', 'null'] },
              is_correct: { bsonType: 'bool' },
              points_earned: { bsonType: ['int', 'long', 'double'] },
            },
          },
        },
      },
    },
  },
});

db.questions.createIndex({ quiz_id: 1, order: 1 });
db.questions.createIndex({ type: 1, difficulty: 1 });
db.questions.createIndex({ subject: 1 });

db.quizzes.createIndex({ status: 1, created_at: -1 });
db.quizzes.createIndex({ created_by: 1, created_at: -1 });

db.quiz_attempts.createIndex({ quiz_id: 1, score: -1 });
db.quiz_attempts.createIndex({ student_id: 1, quiz_id: 1 });
db.quiz_attempts.createIndex({ submitted_at: -1 });
db.quiz_attempts.createIndex({ quiz_id: 1, score: -1, submitted_at: -1 });

print('MongoDB schema and indexes are ready');
