import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import './index.css';

const API_ROOT = 'http://localhost:3000';
const QUIZ_API = `${API_ROOT}/quiz`;
const FACULTY_API = `${API_ROOT}/faculty`;

const emptyQuestionForm = {
  question_text: '',
  type: 'MCQ',
  difficulty: 'medium',
  subject: '',
  options: ['', '', '', ''],
  correct_option: 0,
  is_true: true,
  language: 'javascript',
  test_input: '',
  expected_output: '',
};

function formatTime(totalSeconds) {
  const seconds = Math.max(totalSeconds, 0);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainingSeconds = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function labelFromType(type) {
  return type === 'TRUE_FALSE' ? 'True / False' : type;
}

function LoadingBlock({ text = 'Loading...' }) {
  return (
    <div className="empty-state">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card ${accent || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuizCard({ quiz, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`quiz-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(quiz._id)}
    >
      <div className="quiz-card-top">
        <span className="pill">{quiz.status}</span>
        <span className="muted">{quiz.created_by}</span>
      </div>
      <h3>{quiz.title}</h3>
      <p>{quiz.description || 'No description provided yet.'}</p>
      <div className="quiz-meta-row">
        <span>{quiz.question_count} questions</span>
        <span>{quiz.duration_minutes} min</span>
        <span>{quiz.total_points} pts</span>
      </div>
    </button>
  );
}

function App() {
  const [view, setView] = useState('home');
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [session, setSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [leaderboard, setLeaderboard] = useState({ top10: [], yourRank: null, yourScore: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState(null);
  const [facultyQuizzes, setFacultyQuizzes] = useState([]);
  const [facultyQuizId, setFacultyQuizId] = useState(null);
  const [facultyQuiz, setFacultyQuiz] = useState(null);
  const [createQuizForm, setCreateQuizForm] = useState({
    title: '',
    description: '',
    duration_minutes: 20,
    passing_score: 60,
    facultyId: 'faculty_demo',
    subject: '',
  });
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const autoSubmittedRef = useRef(false);

  const bootstrap = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');
      const loadedQuizzes = await loadPublishedQuizzes();
      if (loadedQuizzes[0]?._id) {
        await loadQuizDetails(loadedQuizzes[0]._id);
      }
      const loadedFaculty = await loadFacultyQuizzes();
      if (loadedFaculty[0]?._id) {
        await loadFacultyQuizDetails(loadedFaculty[0]._id);
      }
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  });

  const submitQuizEvent = useEffectEvent(async (autoSubmit) => {
    await handleSubmitQuiz(autoSubmit);
  });

  async function loadPublishedQuizzes(preferredQuizId) {
    const response = await fetch(`${QUIZ_API}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load quizzes');
    }

    setQuizzes(data);
    const nextId = preferredQuizId || selectedQuizId || data[0]?._id || null;
    setSelectedQuizId(nextId);
    return data;
  }

  async function loadQuizDetails(quizId) {
    if (!quizId) {
      setSelectedQuiz(null);
      return null;
    }

    const response = await fetch(`${QUIZ_API}/${quizId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load quiz details');
    }

    setSelectedQuiz(data);
    return data;
  }

  async function loadFacultyQuizzes(preferredQuizId) {
    const response = await fetch(`${FACULTY_API}/quizzes`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load faculty quizzes');
    }

    setFacultyQuizzes(data);
    const nextId = preferredQuizId || facultyQuizId || data[0]?._id || null;
    setFacultyQuizId(nextId);
    return data;
  }

  async function loadFacultyQuizDetails(quizId) {
    if (!quizId) {
      setFacultyQuiz(null);
      return null;
    }

    const response = await fetch(`${FACULTY_API}/quiz/${quizId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load faculty quiz');
    }

    setFacultyQuiz(data);
    return data;
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      bootstrap();
    });
  }, []);

  useEffect(() => {
    if (view !== 'quiz') {
      return undefined;
    }

    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitQuizEvent(true);
      }
      return undefined;
    }

    const timer = window.setTimeout(() => setTimeLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, view]);

  useEffect(() => {
    if (view !== 'quiz' || !selectedQuizId || !studentId) {
      return undefined;
    }

    const syncTimer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${QUIZ_API}/${selectedQuizId}/session?student_id=${encodeURIComponent(studentId)}`,
        );
        const data = await response.json();

        if (!response.ok) {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            await submitQuizEvent(true);
          }
          return;
        }

        setTimeLeft(Number(data.ttl_seconds || 0));
      } catch {
        // Keep local countdown moving even if the sync request fails once.
      }
    }, 10000);

    return () => window.clearInterval(syncTimer);
  }, [view, selectedQuizId, studentId]);

  useEffect(() => {
    if (view !== 'quiz' || !selectedQuizId || !studentId) {
      return undefined;
    }

    const stream = new EventSource(
      `${API_ROOT}/stream/${selectedQuizId}/leaderboard?student_id=${encodeURIComponent(studentId)}`,
    );

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'UPDATE' && payload.payload) {
          setLeaderboard(payload.payload);
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    return () => stream.close();
  }, [view, selectedQuizId, studentId]);

  const currentQuestion = session?.questions?.[currentQuestionIndex] || null;
  const answeredCount = useMemo(
    () => Object.keys(submittedAnswers).filter((key) => submittedAnswers[key]).length,
    [submittedAnswers],
  );

  async function handleStartQuiz(event) {
    event.preventDefault();
    if (!selectedQuizId || !studentId || !studentName) {
      return;
    }

    try {
      setBusy(true);
      setError('');
      setNotice('');
      autoSubmittedRef.current = false;

      const response = await fetch(`${QUIZ_API}/${selectedQuizId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to start quiz');
      }

      setSession(data);
      setAnswers({});
      setSubmittedAnswers({});
      setCurrentQuestionIndex(0);
      setLeaderboard({ top10: [], yourRank: null, yourScore: 0 });
      setTimeLeft(Number(data.ttl_seconds || data.duration_minutes * 60));
      setView('quiz');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAnswerSubmit(question, value) {
    if (!question || submittedAnswers[question._id]) {
      return;
    }

    setAnswers((current) => ({ ...current, [question._id]: value }));
    setNotice('');

    try {
      const response = await fetch(`${QUIZ_API}/${selectedQuizId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          questionId: question._id,
          answer: value,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit answer');
      }

      setLeaderboard((current) => ({
        ...current,
        yourRank: data.your_rank,
        yourScore: data.your_score,
      }));
      setSubmittedAnswers((current) => ({ ...current, [question._id]: true }));
      setNotice(
        data.correct ? `Correct answer. +${data.points_earned} points.` : 'Answer submitted.',
      );
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleSubmitQuiz(autoSubmit = false) {
    if (!selectedQuizId || !studentId || !studentName) {
      return;
    }

    try {
      setBusy(true);
      setError('');
      const response = await fetch(`${QUIZ_API}/${selectedQuizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit quiz');
      }

      const resultResponse = await fetch(
        `${QUIZ_API}/${selectedQuizId}/results?attempt_id=${encodeURIComponent(data.attempt_id)}`,
      );
      const resultData = await resultResponse.json();

      if (!resultResponse.ok) {
        throw new Error(resultData.error || 'Unable to load results');
      }

      setResults(resultData);
      setView('results');
      setNotice(autoSubmit ? 'Time expired. Your quiz was auto-submitted.' : '');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateQuiz(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setError('');
      const response = await fetch(`${FACULTY_API}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createQuizForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create quiz');
      }

      setNotice('Draft quiz created. Add questions and publish when ready.');
      await loadFacultyQuizzes(data.quizId);
      await loadFacultyQuizDetails(data.quizId);
      setFacultyQuizId(data.quizId);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddQuestion(event) {
    event.preventDefault();
    if (!facultyQuizId) {
      return;
    }

    const payload = {
      question_text: questionForm.question_text,
      type: questionForm.type,
      difficulty: questionForm.difficulty,
      subject: questionForm.subject,
      points: 10,
    };

    if (questionForm.type === 'MCQ') {
      payload.options = questionForm.options;
      payload.correct_option = questionForm.correct_option;
    } else if (questionForm.type === 'TRUE_FALSE') {
      payload.is_true = questionForm.is_true;
    } else {
      payload.language = questionForm.language;
      payload.test_cases = [
        {
          input: questionForm.test_input,
          expected_output: questionForm.expected_output,
        },
      ];
    }

    try {
      setBusy(true);
      setError('');
      const response = await fetch(`${FACULTY_API}/quiz/${facultyQuizId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to add question');
      }

      setNotice('Question added to the question bank.');
      setQuestionForm(emptyQuestionForm);
      await loadFacultyQuizzes(facultyQuizId);
      await loadFacultyQuizDetails(facultyQuizId);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishQuiz() {
    if (!facultyQuizId) {
      return;
    }

    try {
      setBusy(true);
      setError('');
      const response = await fetch(`${FACULTY_API}/quiz/${facultyQuizId}/publish`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to publish quiz');
      }

      setNotice('Quiz published. Students can now start it from the dashboard.');
      await loadFacultyQuizzes(facultyQuizId);
      await loadFacultyQuizDetails(facultyQuizId);
      await loadPublishedQuizzes(facultyQuizId);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function resetToHome() {
    setView('home');
    setSession(null);
    setResults(null);
    setAnswers({});
    setSubmittedAnswers({});
    setCurrentQuestionIndex(0);
    setTimeLeft(0);
    autoSubmittedRef.current = false;
  }

  async function handleSelectPublishedQuiz(quizId) {
    try {
      setSelectedQuizId(quizId);
      await loadQuizDetails(quizId);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }

  async function handleSelectFacultyQuiz(quizId) {
    try {
      setFacultyQuizId(quizId);
      await loadFacultyQuizDetails(quizId);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <LoadingBlock text="Booting quiz workspace..." />
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Project 3</p>
          <h1>Online Quiz Platform with Live Leaderboard</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={resetToHome}>
            Student View
          </button>
          <button type="button" className="primary-button" onClick={() => setView('faculty')}>
            Faculty Studio
          </button>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {notice ? <div className="banner success">{notice}</div> : null}

      {view === 'home' ? (
        <section className="home-grid">
          <div className="panel hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">Student Dashboard</p>
              <h2>Pick any published quiz and join the leaderboard in real time.</h2>
              <p>
                Multiple quizzes can stay published together now, each with its own timer,
                leaderboard, and result history.
              </p>
            </div>

            <div className="stats-grid">
              <StatCard label="Published Quizzes" value={quizzes.length} accent="amber" />
              <StatCard
                label="Question Bank"
                value={quizzes.reduce((sum, quiz) => sum + (quiz.question_count || 0), 0)}
                accent="teal"
              />
              <StatCard label="Live Mode" value="Redis + MongoDB" accent="rose" />
            </div>
          </div>

          <div className="panel quiz-list-panel">
            <div className="section-heading">
              <h3>Available Quizzes</h3>
              <span>{quizzes.length} live</span>
            </div>
            <div className="quiz-list">
              {quizzes.length ? (
                quizzes.map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    selected={quiz._id === selectedQuizId}
                    onSelect={handleSelectPublishedQuiz}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <p>No published quizzes yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="panel details-panel">
            {selectedQuiz ? (
              <>
                <div className="section-heading">
                  <h3>{selectedQuiz.title}</h3>
                  <span>{selectedQuiz.question_count} questions</span>
                </div>
                <p className="detail-copy">{selectedQuiz.description}</p>

                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Duration</span>
                    <strong>{selectedQuiz.duration_minutes} minutes</strong>
                  </div>
                  <div>
                    <span className="detail-label">Pass Mark</span>
                    <strong>{selectedQuiz.passing_score} points</strong>
                  </div>
                  <div>
                    <span className="detail-label">Total Points</span>
                    <strong>{selectedQuiz.total_points}</strong>
                  </div>
                  <div>
                    <span className="detail-label">Topics</span>
                    <strong>{(selectedQuiz.subjects || []).join(', ') || 'Mixed'}</strong>
                  </div>
                </div>

                <form className="student-form" onSubmit={handleStartQuiz}>
                  <input
                    className="text-input"
                    placeholder="Student ID"
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    required
                  />
                  <input
                    className="text-input"
                    placeholder="Student name"
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    required
                  />
                  <button type="submit" className="primary-button" disabled={busy}>
                    {busy ? 'Starting...' : 'Start Selected Quiz'}
                  </button>
                </form>

                <div className="preview-strip">
                  {(selectedQuiz.questions || []).slice(0, 4).map((question) => (
                    <div key={question._id} className="preview-chip">
                      <span>{labelFromType(question.type)}</span>
                      <strong>{question.subject}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Select a quiz to see details.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {view === 'quiz' && currentQuestion ? (
        <section className="quiz-grid">
          <div className="panel question-panel">
            <div className="question-header">
              <div>
                <p className="eyebrow">{session.quiz.title}</p>
                <h2>
                  Question {currentQuestionIndex + 1} of {session.questions.length}
                </h2>
              </div>
              <div className="question-badges">
                <span className="pill">{currentQuestion.subject}</span>
                <span className="pill outline">{currentQuestion.difficulty}</span>
              </div>
            </div>

            <p className="question-text">{currentQuestion.question_text}</p>

            <div className="answer-stack">
              {currentQuestion.type === 'MCQ'
                ? currentQuestion.options.map((option, index) => (
                    <button
                      key={`${currentQuestion._id}-${option}`}
                      type="button"
                      className={`answer-card ${
                        answers[currentQuestion._id] === index ? 'selected' : ''
                      }`}
                      onClick={() => handleAnswerSubmit(currentQuestion, index)}
                      disabled={submittedAnswers[currentQuestion._id]}
                    >
                      <span className="answer-index">{String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                    </button>
                  ))
                : null}

              {currentQuestion.type === 'TRUE_FALSE'
                ? [true, false].map((value) => (
                    <button
                      key={`${currentQuestion._id}-${String(value)}`}
                      type="button"
                      className={`answer-card ${
                        answers[currentQuestion._id] === value ? 'selected' : ''
                      }`}
                      onClick={() => handleAnswerSubmit(currentQuestion, value)}
                      disabled={submittedAnswers[currentQuestion._id]}
                    >
                      <span className="answer-index">{value ? 'T' : 'F'}</span>
                      <span>{value ? 'True' : 'False'}</span>
                    </button>
                  ))
                : null}

              {currentQuestion.type === 'CODING' ? (
                <div className="code-block">
                  <textarea
                    className="text-area"
                    rows="10"
                    placeholder="Write your code here..."
                    value={answers[currentQuestion._id] || ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [currentQuestion._id]: event.target.value,
                      }))
                    }
                    disabled={submittedAnswers[currentQuestion._id]}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      handleAnswerSubmit(currentQuestion, answers[currentQuestion._id] || '')
                    }
                    disabled={
                      submittedAnswers[currentQuestion._id] ||
                      !String(answers[currentQuestion._id] || '').trim()
                    }
                  >
                    {submittedAnswers[currentQuestion._id] ? 'Code Submitted' : 'Submit Code'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="nav-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setCurrentQuestionIndex((index) => Math.max(index - 1, 0))}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setCurrentQuestionIndex((index) =>
                    Math.min(index + 1, session.questions.length - 1),
                  )
                }
                disabled={currentQuestionIndex === session.questions.length - 1}
              >
                Next
              </button>
              <button type="button" className="primary-button" onClick={() => handleSubmitQuiz()}>
                {busy ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </div>
          </div>

          <aside className="panel side-panel">
            <div className={`timer-card ${timeLeft <= 60 ? 'danger' : ''}`}>
              <span>Redis TTL Sync</span>
              <strong>{formatTime(timeLeft)}</strong>
            </div>

            <div className="mini-stats">
              <StatCard label="Answered" value={`${answeredCount}/${session.questions.length}`} />
              <StatCard label="Your Rank" value={leaderboard.yourRank || '-'} />
              <StatCard label="Score" value={leaderboard.yourScore || 0} />
            </div>

            <div className="section-heading">
              <h3>Question Navigator</h3>
              <span>Jump anywhere</span>
            </div>
            <div className="question-nav-grid">
              {session.questions.map((question, index) => (
                <button
                    key={question._id}
                    type="button"
                    className={`nav-chip ${index === currentQuestionIndex ? 'active' : ''} ${
                    submittedAnswers[question._id] ? 'done' : ''
                  }`}
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="section-heading">
              <h3>Live Leaderboard</h3>
              <span>Top 10</span>
            </div>
            <div className="leaderboard-list">
              {(leaderboard.top10 || []).length ? (
                leaderboard.top10.map((entry, index) => (
                  <div key={`${entry.studentId}-${index}`} className="leaderboard-row">
                    <div>
                      <span className="rank-label">#{index + 1}</span>
                      <strong>{entry.studentId}</strong>
                    </div>
                    <span>{entry.score}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <p>Leaderboard wakes up as answers come in.</p>
                </div>
              )}
            </div>
          </aside>
        </section>
      ) : null}

      {view === 'results' && results ? (
        <section className="results-layout">
          <div className="panel results-hero">
            <p className="eyebrow">Results</p>
            <h2>{results.quiz_title}</h2>
            <p>
              Rank #{results.rank} out of {results.total_attempts} attempts.{' '}
              {results.passed ? 'You cleared the pass mark.' : 'You can review and retry another quiz.'}
            </p>
            <div className="stats-grid">
              <StatCard label="Score" value={results.score} accent="amber" />
              <StatCard label="Percentage" value={`${results.percentage}%`} accent="teal" />
              <StatCard label="Time Taken" value={`${results.time_taken_seconds}s`} accent="rose" />
            </div>
            <button type="button" className="primary-button" onClick={resetToHome}>
              Back to Quiz Dashboard
            </button>
          </div>

          <div className="panel results-breakdown">
            <div className="section-heading">
              <h3>Score Breakdown</h3>
              <span>{results.answers.length} answers captured</span>
            </div>

            <div className="result-list">
              {results.answers.map((answer, index) => (
                <article
                  key={`${answer.question_id}-${index}`}
                  className={`result-card ${answer.is_correct ? 'correct' : 'wrong'}`}
                >
                  <div className="result-top">
                    <span className="pill">{answer.subject}</span>
                    <span>{answer.points_earned} pts</span>
                  </div>
                  <h4>{answer.question_text}</h4>
                  <p>
                    <strong>Your answer:</strong> {answer.answer || 'Not answered'}
                  </p>
                  <p>
                    <strong>Correct answer:</strong> {String(answer.correct_answer)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {view === 'faculty' ? (
        <section className="faculty-grid">
          <div className="panel faculty-form-panel">
            <div className="section-heading">
              <h3>Create Quiz</h3>
              <span>Draft first, publish later</span>
            </div>
            <form className="stack-form" onSubmit={handleCreateQuiz}>
              <input
                className="text-input"
                placeholder="Quiz title"
                value={createQuizForm.title}
                onChange={(event) =>
                  setCreateQuizForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
              <textarea
                className="text-area"
                rows="4"
                placeholder="Quiz description"
                value={createQuizForm.description}
                onChange={(event) =>
                  setCreateQuizForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
              <div className="form-split">
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  placeholder="Duration"
                  value={createQuizForm.duration_minutes}
                  onChange={(event) =>
                    setCreateQuizForm((current) => ({
                      ...current,
                      duration_minutes: Number(event.target.value),
                    }))
                  }
                  required
                />
                <input
                  className="text-input"
                  type="number"
                  min="0"
                  placeholder="Pass score"
                  value={createQuizForm.passing_score}
                  onChange={(event) =>
                    setCreateQuizForm((current) => ({
                      ...current,
                      passing_score: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="form-split">
                <input
                  className="text-input"
                  placeholder="Faculty ID"
                  value={createQuizForm.facultyId}
                  onChange={(event) =>
                    setCreateQuizForm((current) => ({ ...current, facultyId: event.target.value }))
                  }
                />
                <input
                  className="text-input"
                  placeholder="Primary subject"
                  value={createQuizForm.subject}
                  onChange={(event) =>
                    setCreateQuizForm((current) => ({ ...current, subject: event.target.value }))
                  }
                />
              </div>
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Saving...' : 'Create Draft Quiz'}
              </button>
            </form>
          </div>

          <div className="panel faculty-list-panel">
            <div className="section-heading">
              <h3>Quiz Library</h3>
              <span>{facultyQuizzes.length} total</span>
            </div>
            <div className="quiz-list">
              {facultyQuizzes.map((quiz) => (
                <QuizCard
                  key={quiz._id}
                  quiz={quiz}
                  selected={quiz._id === facultyQuizId}
                  onSelect={handleSelectFacultyQuiz}
                />
              ))}
            </div>
          </div>

          <div className="panel builder-panel">
            {facultyQuiz ? (
              <>
                <div className="section-heading">
                  <div>
                    <h3>{facultyQuiz.title}</h3>
                    <p className="muted-line">
                      {facultyQuiz.question_count} questions, {facultyQuiz.total_points} points
                    </p>
                  </div>
                  <button type="button" className="primary-button" onClick={handlePublishQuiz}>
                    Publish Quiz
                  </button>
                </div>

                <div className="type-tabs">
                  {['MCQ', 'TRUE_FALSE', 'CODING'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={questionForm.type === type ? 'tab active' : 'tab'}
                      onClick={() =>
                        setQuestionForm((current) => ({
                          ...current,
                          type,
                        }))
                      }
                    >
                      {labelFromType(type)}
                    </button>
                  ))}
                </div>

                <form className="stack-form" onSubmit={handleAddQuestion}>
                  <textarea
                    className="text-area"
                    rows="4"
                    placeholder="Question text"
                    value={questionForm.question_text}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        question_text: event.target.value,
                      }))
                    }
                    required
                  />
                  <div className="form-split">
                    <input
                      className="text-input"
                      placeholder="Subject"
                      value={questionForm.subject}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          subject: event.target.value,
                        }))
                      }
                      required
                    />
                    <select
                      className="text-input"
                      value={questionForm.difficulty}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          difficulty: event.target.value,
                        }))
                      }
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {questionForm.type === 'MCQ' ? (
                    <div className="option-editor">
                      {questionForm.options.map((option, index) => (
                        <label key={`option-${index}`} className="option-line">
                          <input
                            type="radio"
                            name="correct-option"
                            checked={questionForm.correct_option === index}
                            onChange={() =>
                              setQuestionForm((current) => ({
                                ...current,
                                correct_option: index,
                              }))
                            }
                          />
                          <input
                            className="text-input"
                            placeholder={`Option ${index + 1}`}
                            value={option}
                            onChange={(event) =>
                              setQuestionForm((current) => {
                                const nextOptions = [...current.options];
                                nextOptions[index] = event.target.value;
                                return { ...current, options: nextOptions };
                              })
                            }
                            required
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {questionForm.type === 'TRUE_FALSE' ? (
                    <div className="true-false-toggle">
                      <button
                        type="button"
                        className={questionForm.is_true ? 'tab active' : 'tab'}
                        onClick={() =>
                          setQuestionForm((current) => ({ ...current, is_true: true }))
                        }
                      >
                        True
                      </button>
                      <button
                        type="button"
                        className={!questionForm.is_true ? 'tab active' : 'tab'}
                        onClick={() =>
                          setQuestionForm((current) => ({ ...current, is_true: false }))
                        }
                      >
                        False
                      </button>
                    </div>
                  ) : null}

                  {questionForm.type === 'CODING' ? (
                    <>
                      <input
                        className="text-input"
                        placeholder="Language"
                        value={questionForm.language}
                        onChange={(event) =>
                          setQuestionForm((current) => ({
                            ...current,
                            language: event.target.value,
                          }))
                        }
                      />
                      <div className="form-split">
                        <input
                          className="text-input"
                          placeholder="Test input"
                          value={questionForm.test_input}
                          onChange={(event) =>
                            setQuestionForm((current) => ({
                              ...current,
                              test_input: event.target.value,
                            }))
                          }
                          required
                        />
                        <input
                          className="text-input"
                          placeholder="Expected output"
                          value={questionForm.expected_output}
                          onChange={(event) =>
                            setQuestionForm((current) => ({
                              ...current,
                              expected_output: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </>
                  ) : null}

                  <button type="submit" className="primary-button" disabled={busy}>
                    Add Question
                  </button>
                </form>

                <div className="section-heading">
                  <h3>Current Question Bank</h3>
                  <span>{facultyQuiz.questions?.length || 0} items</span>
                </div>
                <div className="result-list compact-list">
                  {(facultyQuiz.questions || []).map((question) => (
                    <article key={question._id} className="result-card neutral">
                      <div className="result-top">
                        <span className="pill">{labelFromType(question.type)}</span>
                        <span>{question.difficulty}</span>
                      </div>
                      <h4>{question.question_text}</h4>
                      <p>{question.subject}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Create or select a quiz to start building the question bank.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default App;
