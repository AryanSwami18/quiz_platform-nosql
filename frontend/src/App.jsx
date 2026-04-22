import { useState, useEffect, useRef } from 'react';
import './index.css';

const API_BASE = 'http://localhost:3000/quiz';

function App() {
  const [view, setView] = useState('start'); // start, quiz, results
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  
  const [quizInfo, setQuizInfo] = useState(null); // { id, title, duration_minutes }
  const [session, setSession] = useState(null); // { sessionId, questions }
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // Stores local answer state
  const [leaderboard, setLeaderboard] = useState({ top10: [], yourRank: null, yourScore: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const lbIntervalRef = useRef(null);

  // Fetch active quiz on mount
  useEffect(() => {
    fetch(`${API_BASE}/active`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setQuizInfo(data);
      })
      .catch(err => console.error('Error fetching active quiz:', err));
  }, []);

  // Timer & Auto-submit effect
  useEffect(() => {
    if (view === 'quiz' && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (view === 'quiz' && timeLeft === 0) {
      handleSubmitQuiz(); // Auto submit
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, view]);

  // Leaderboard polling
  useEffect(() => {
    if (view === 'quiz') {
      lbIntervalRef.current = setInterval(fetchLeaderboard, 3000); // Poll every 3s
    }
    return () => clearInterval(lbIntervalRef.current);
  }, [view, studentId]);

  const fetchLeaderboard = async () => {
    if (!quizInfo) return;
    try {
      const res = await fetch(`${API_BASE}/${quizInfo.id}/leaderboard?student_id=${studentId}`);
      const data = await res.json();
      if (!data.error && data.top10) {
        setLeaderboard(data);
      } else {
        console.error('Leaderboard API returned error:', data.error);
      }
    } catch (err) {
      console.error('Leaderboard error', err);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!studentId || !studentName || !quizInfo) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/${quizInfo.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setSession({
        sessionId: data.sessionId,
        questions: data.questions
      });
      setTimeLeft(data.duration_minutes * 60);
      setView('quiz');
      fetchLeaderboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answerVal) => {
    const question = session.questions[currentQuestionIdx];
    
    // Optimistic UI update locally
    setAnswers(prev => ({ ...prev, [question._id]: answerVal }));

    try {
      const res = await fetch(`${API_BASE}/${quizInfo.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          questionId: question._id,
          answer: answerVal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn('Answer error:', data.error);
        // Might already be answered (SET NX locked)
      } else {
        // Fetch leaderboard instantly to show updated score/rank
        fetchLeaderboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitQuiz = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${quizInfo.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      // Fetch full results
      const resData = await fetch(`${API_BASE}/${quizInfo.id}/results?attempt_id=${data.attempt_id}`);
      const finalResults = await resData.json();
      
      setResults(finalResults);
      setView('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Views
  if (view === 'start') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <h1>Quiz Platform</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {quizInfo ? `Ready to take: ${quizInfo.title}` : 'Loading active quiz...'}
          </p>
          
          {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}
          
          <form onSubmit={handleStart}>
            <input 
              className="input-field" 
              placeholder="Enter Student ID (e.g., studentA)" 
              value={studentId} 
              onChange={e => setStudentId(e.target.value)}
              required 
            />
            <input 
              className="input-field" 
              placeholder="Enter Full Name" 
              value={studentName} 
              onChange={e => setStudentName(e.target.value)}
              required 
            />
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%' }}
              disabled={loading || !quizInfo}
            >
              {loading ? <div className="loader" style={{ width: '20px', height: '20px', margin: 0, borderWidth: '2px' }} /> : 'Start Quiz'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'quiz') {
    if (!session || !session.questions || session.questions.length === 0) {
      return <div className="app-container"><div style={{color:'white'}}>Loading session...</div></div>;
    }
    const question = session.questions[currentQuestionIdx];
    if (!question) return null;
    const hasAnswered = answers[question._id] !== undefined;

    return (
      <div className="app-container quiz-layout">
        <div className="main-content">
          <div className="glass-panel" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
                Question {currentQuestionIdx + 1} of {session.questions.length}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.9rem' }}>
                {question.difficulty.toUpperCase()} • {question.subject}
              </span>
            </div>
            
            <h2>{question.question_text}</h2>

            <div style={{ marginTop: '2rem' }}>
              {question.type === 'MCQ' && question.options.map((opt, idx) => (
                <div 
                  key={idx} 
                  className={`option-card ${answers[question._id] === idx ? 'selected' : ''}`}
                  onClick={() => !hasAnswered && handleAnswer(idx)}
                  style={{ opacity: hasAnswered && answers[question._id] !== idx ? 0.5 : 1 }}
                >
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {answers[question._id] === idx && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                  </div>
                  {opt}
                </div>
              ))}

              {question.type === 'TRUE_FALSE' && ['True', 'False'].map((opt, idx) => {
                const val = opt === 'True';
                return (
                  <div 
                    key={idx} 
                    className={`option-card ${answers[question._id] === val ? 'selected' : ''}`}
                    onClick={() => !hasAnswered && handleAnswer(val)}
                  >
                    {opt}
                  </div>
                )
              })}

              {question.type === 'CODING' && (
                <div>
                  <textarea 
                    className="input-field" 
                    rows="6" 
                    placeholder="Write your code here..."
                    disabled={hasAnswered}
                    value={answers[question._id] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [question._id]: e.target.value }))}
                    style={{ fontFamily: 'monospace' }}
                  ></textarea>
                  {!hasAnswered && (
                    <button className="btn-secondary" onClick={() => handleAnswer(answers[question._id])}>Run & Submit Code</button>
                  )}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setCurrentQuestionIdx(p => Math.max(0, p - 1))}
                disabled={currentQuestionIdx === 0}
              >
                Previous
              </button>
              
              {currentQuestionIdx < session.questions.length - 1 ? (
                <button 
                  className="btn-primary" 
                  onClick={() => setCurrentQuestionIdx(p => Math.min(session.questions.length - 1, p + 1))}
                >
                  Next
                </button>
              ) : (
                <button className="btn-primary" onClick={handleSubmitQuiz} disabled={loading}>
                  {loading ? 'Submitting...' : 'Finish & Submit'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div className={`timer-widget ${timeLeft < 60 ? 'urgent' : ''}`}>
              {formatTime(timeLeft)}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>Time Remaining</p>
            
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Live Leaderboard
            </h3>
            
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Your Standing</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Rank #{leaderboard.yourRank || '-'}</span>
                <span style={{ fontWeight: 600 }}>{leaderboard.yourScore} pts</span>
              </div>
            </div>

            <div className="leaderboard-list">
              {(leaderboard?.top10 || []).map((lb, idx) => (
                <div key={idx} className={`leaderboard-item ${idx < 3 ? 'top-3' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="rank-badge">{idx + 1}</div>
                    <span style={{ fontWeight: idx < 3 ? 600 : 400 }}>{lb.studentId}</span>
                  </div>
                  <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{lb.score}</span>
                </div>
              ))}
              {leaderboard.top10.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>No entries yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '800px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1>Quiz Completed!</h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
              {results.passed ? '🎉 Congratulations, you passed!' : 'Better luck next time.'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
            <div className="stat-box">
              <div style={{ color: 'var(--text-muted)' }}>Final Score</div>
              <div className="stat-value">{results.score}</div>
            </div>
            <div className="stat-box">
              <div style={{ color: 'var(--text-muted)' }}>Percentage</div>
              <div className="stat-value">{results.percentage.toFixed(1)}%</div>
            </div>
            <div className="stat-box" style={{ borderColor: results.passed ? 'var(--success)' : 'var(--error)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Status</div>
              <div className="stat-value" style={{ color: results.passed ? 'var(--success)' : 'var(--error)' }}>
                {results.passed ? 'PASS' : 'FAIL'}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn-secondary" onClick={() => window.location.reload()}>Back to Start</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
