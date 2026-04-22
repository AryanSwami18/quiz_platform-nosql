import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://root:rootpassword@localhost:27017/quiz_platform?authSource=admin';

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db('quiz_platform');
    
    // Clear existing data
    await db.collection('questions').deleteMany({});
    await db.collection('quizzes').deleteMany({});
    await db.collection('quiz_attempts').deleteMany({});
    
    const facultyId = 'faculty_001';
    
    // 1. Create a Quiz
    const quizId = new ObjectId();
    const newQuiz = {
      _id: quizId,
      title: 'Full Stack Development Quiz',
      description: 'Comprehensive test covering JavaScript, React, Node.js, and Databases.',
      duration_minutes: 60,
      passing_score: 50,
      total_points: 300,
      created_by: facultyId,
      status: 'published',
      created_at: new Date(),
      updated_at: new Date(),
      question_ids: []
    };

    const questions = [];
    
    // Generate 15 MCQs
    for (let i = 1; i <= 15; i++) {
      questions.push({
        quiz_id: quizId,
        question_text: `Sample MCQ Question ${i} about web development.`,
        type: 'MCQ',
        difficulty: i % 3 === 0 ? 'hard' : (i % 2 === 0 ? 'medium' : 'easy'),
        subject: i % 2 === 0 ? 'JavaScript' : 'Node.js',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_option: 1,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Generate 10 True/False
    for (let i = 1; i <= 10; i++) {
      questions.push({
        quiz_id: quizId,
        question_text: `Sample True/False Question ${i} about databases.`,
        type: 'TRUE_FALSE',
        difficulty: i % 3 === 0 ? 'hard' : 'easy',
        subject: 'Database',
        is_true: i % 2 === 0,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Generate 5 Coding questions
    for (let i = 1; i <= 5; i++) {
      questions.push({
        quiz_id: quizId,
        question_text: `Sample Coding Question ${i}: Implement a basic function.`,
        type: 'CODING',
        difficulty: 'hard',
        subject: 'Algorithms',
        language: 'javascript',
        test_cases: [
          { input: '1, 2', expected_output: '3' },
          { input: '-1, 5', expected_output: '4' }
        ],
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    const insertedQuestions = await db.collection('questions').insertMany(questions);
    console.log(`✓ Inserted ${insertedQuestions.insertedCount} questions.`);

    newQuiz.question_ids = Object.values(insertedQuestions.insertedIds);
    await db.collection('quizzes').insertOne(newQuiz);
    console.log('✓ Inserted quiz.');

    // Seed mock quiz_attempts for aggregations
    const attempts = [];
    const students = ['studentA', 'studentB', 'studentC', 'studentD', 'studentE', 'studentF'];

    for (let i = 0; i < 20; i++) {
      const student_id = students[i % students.length];
      const score = Math.floor(Math.random() * 300); // random score up to 300
      
      const mockAnswers = [];
      Object.values(insertedQuestions.insertedIds).forEach((qId, idx) => {
        // Mock some answers to be wrong intentionally to test < 30% accuracy
        const isCorrect = Math.random() > 0.4; 
        mockAnswers.push({
          question_id: qId,
          answer: 'mock_answer',
          is_correct: isCorrect,
          points_earned: isCorrect ? 10 : 0
        });
      });

      attempts.push({
        quiz_id: quizId,
        student_id: student_id,
        student_name: `Student ${student_id.replace('student', '')}`,
        started_at: new Date(Date.now() - 3600000), // 1 hour ago
        submitted_at: new Date(),
        time_taken_seconds: 1800 + Math.floor(Math.random() * 1000),
        answers: mockAnswers,
        score: score,
        percentage: (score / 300) * 100,
        passed: score >= 50
      });
    }

    await db.collection('quiz_attempts').insertMany(attempts);
    console.log(`✓ Inserted ${attempts.length} mock quiz attempts.`);

  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.close();
  }
}

seed();
