Online Quiz Platform with Leaderboard
Problem Statement

Build a timed online quiz platform where faculty can create question banks, students take
quizzes with countdown timers, and a live leaderboard updates in real-time as participants
answer. MongoDB stores question banks and quiz history permanently, while Redis handles
the time-critical quiz session and leaderboard.

Objective 1
Objective 1 — MongoDB Question Bank & History (Member A):
Design permanent data layer: (a) questions collection using Attribute Pattern: common fields +
type-specific (MCQ: option_count, coding: test_cases[], true_false: none), (b) quizzes: metadata
with question_ids reference, (c) quiz_attempts: permanent records (student_id, quiz_id,
answers[], score, time_taken), (d) Aggregation: avg score/quiz, top 5 students overall, question
difficulty analysis (<30% correct rate), subject-wise comparison, (e) Index { quiz_id:1, score:-1 }.
Deliverable: Schema with Attribute Pattern justification, 30+ questions, aggregation outputs,
explain() proof.

Objective 2
Objective 2 — Redis Quiz Session & Live Leaderboard (Member B):
Real-time quiz engine: (a) Session management: Redis key session:<quizId>:<studentId> with
TTL=quiz duration, store question index and answers in Hash, auto-expire=auto-submit, (b) Live
leaderboard: Sorted Set with ZADD/ZINCRBY on correct answers, ZREVRANGE for top 10, (c)
Spam prevention: SET answer:<quizId>:<studentId>:<questionNo> NX — one answer per
question, (d) End of quiz: read scores from Sorted Set, persist to MongoDB, delete Redis keys.
Deliverable: Session TTL demo, real-time leaderboard, spam prevention proof,
Redis→MongoDB persistence.

Objective 3
Objective 3 — Quiz Interface & Integration (Member C):
Build quiz experience: (a) Endpoints: POST /quiz/:id/start, POST /quiz/:id/answer, GET
/quiz/:id/leaderboard, POST /quiz/:id/submit, (b) UI with countdown timer synced to Redis TTL,
question navigation, live leaderboard sidebar, (c) Auto-submit on TTL expiry: fetch Redis
answers, persist to MongoDB, (d) Results page from MongoDB: rank, score breakdown, correct
answers.
Deliverable: End-to-end quiz flow, timer sync, auto-submit demo, results page.