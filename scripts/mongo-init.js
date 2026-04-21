// MongoDB initialization script
// This runs automatically when the container starts

const db = db.getSiblingDB('quiz_platform');

// Drop existing collections if needed (comment out after initial setup)
// db.questions.drop();
// db.quizzes.drop();
// db.quiz_attempts.drop();

// ============================================
// 1. QUESTIONS COLLECTION (Attribute Pattern)
// ============================================
db.createCollection('questions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['quiz_id', 'question_text', 'type', 'difficulty'],
      properties: {
        _id: { bsonType: 'objectId' },
        quiz_id: { bsonType: 'objectId', description: 'Reference to quiz' },
        question_text: { bsonType: 'string', description: 'The question content' },
        type: { 
          enum: ['MCQ', 'TRUE_FALSE', 'CODING'],
          description: 'Question type for attribute pattern'
        },
        difficulty: {
          enum: ['easy', 'medium', 'hard'],
          description: 'Question difficulty level'
        },
        subject: { bsonType: 'string', description: 'Subject/topic' },
        
        // MCQ-specific fields (only present if type === 'MCQ')
        options: { 
          bsonType: 'array',
          description: 'Answer options for MCQ',
          items: { bsonType: 'string' }
        },
        correct_option: { bsonType: 'int', description: 'Index of correct option' },
        
        // TRUE_FALSE-specific (minimal, no extra fields needed)
        is_true: { bsonType: 'bool', description: 'Correct answer for true/false' },
        
        // CODING-specific fields
        test_cases: {
          bsonType: 'array',
          description: 'Test cases for coding questions',
          items: {
            bsonType: 'object',
            properties: {
              input: { bsonType: 'string' },
              expected_output: { bsonType: 'string' }
            }
          }
        },
        language: { bsonType: 'string', description: 'Programming language' },
        
        // Metadata
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});

// ============================================
// 2. QUIZZES COLLECTION
// ============================================
db.createCollection('quizzes', {
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
          description: 'Reference to question documents'
        },
        duration_minutes: { bsonType: 'int', description: 'Quiz duration in minutes' },
        passing_score: { bsonType: 'int', description: 'Score needed to pass (0-100)' },
        total_points: { bsonType: 'int', description: 'Sum of all question points' },
        created_by: { bsonType: 'string', description: 'Faculty ID' },
        status: {
          enum: ['draft', 'published', 'archived'],
          default: 'draft'
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});

// ============================================
// 3. QUIZ_ATTEMPTS COLLECTION (Permanent History)
// ============================================
db.createCollection('quiz_attempts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['quiz_id', 'student_id', 'started_at'],
      properties: {
        _id: { bsonType: 'objectId' },
        quiz_id: { bsonType: 'objectId' },
        student_id: { bsonType: 'string', description: 'Student identifier' },
        student_name: { bsonType: 'string' },
        
        // Attempt timing
        started_at: { bsonType: 'date' },
        submitted_at: { bsonType: 'date' },
        time_taken_seconds: { bsonType: 'int' },
        
        // Answers: array of {question_id, answer, is_correct}
        answers: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              question_id: { bsonType: 'objectId' },
              answer: { bsonType: 'string' },
              is_correct: { bsonType: 'bool' },
              points_earned: { bsonType: 'int' }
            }
          }
        },
        
        // Scoring
        score: { bsonType: 'int', description: 'Total points earned' },
        percentage: { bsonType: 'double', description: 'Percentage score (0-100)' },
        passed: { bsonType: 'bool' },
        
        // Metadata
        ip_address: { bsonType: 'string' }
      }
    }
  }
});

// ============================================
// 4. CREATE INDEXES
// ============================================

// Questions indexes
db.questions.createIndex({ quiz_id: 1 });
db.questions.createIndex({ type: 1, difficulty: 1 });
db.questions.createIndex({ subject: 1 });

// Quizzes indexes
db.quizzes.createIndex({ created_by: 1 });
db.quizzes.createIndex({ status: 1 });
db.quizzes.createIndex({ created_at: -1 });

// Quiz attempts indexes (CRITICAL for aggregations)
db.quiz_attempts.createIndex({ quiz_id: 1, score: -1 });
db.quiz_attempts.createIndex({ student_id: 1, quiz_id: 1 });
db.quiz_attempts.createIndex({ submitted_at: -1 });
db.quiz_attempts.createIndex({ quiz_id: 1, submitted_at: -1 });

// Compound index for leaderboard queries
db.quiz_attempts.createIndex({ quiz_id: 1, score: -1, submitted_at: -1 });

console.log('✓ Collections created with schemas');
console.log('✓ Indexes created');
console.log('✓ MongoDB initialization complete');

