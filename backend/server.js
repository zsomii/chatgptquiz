const express = require('express');
const cors = require('cors');
const db = require('./database');
const questions = require('./questions');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// --- DB Setup ---

// Create questions table (store full 100 questions)
db.prepare(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    answer0 TEXT NOT NULL,
    answer1 TEXT NOT NULL,
    answer2 TEXT NOT NULL,
    answer3 TEXT NOT NULL,
    correctAnswer INTEGER NOT NULL
  )
`).run();

// Store assigned question sets per user per hour
db.prepare(`
  CREATE TABLE IF NOT EXISTS user_question_sets (
    sessionId TEXT NOT NULL,
    hour INTEGER NOT NULL,
    questionId INTEGER NOT NULL,
    PRIMARY KEY(sessionId, hour, questionId)
  )
`).run();

// Store user answers
db.prepare(`
  CREATE TABLE IF NOT EXISTS user_answers (
    sessionId TEXT NOT NULL,
    questionId INTEGER NOT NULL,
    answerIndex INTEGER NOT NULL,
    PRIMARY KEY(sessionId, questionId)
  )
`).run();

// Store total user scores
db.prepare(`
  CREATE TABLE IF NOT EXISTS user_scores (
    sessionId TEXT PRIMARY KEY,
    totalScore INTEGER NOT NULL DEFAULT 0
  )
`).run();

// Seed questions if empty
const count = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO questions (id, question, answer0, answer1, answer2, answer3, correctAnswer)
    VALUES (@id, @question, @answer0, @answer1, @answer2, @answer3, @correctAnswer)
  `);
  const insertMany = db.transaction((questions) => {
    for (const q of questions) {
      insert.run({
        id: q.id,
        question: q.question,
        answer0: q.answers[0],
        answer1: q.answers[1],
        answer2: q.answers[2],
        answer3: q.answers[3],
        correctAnswer: q.correctAnswer,
      });
    }
  });
  insertMany(questions);
  console.log('Seeded questions into DB');
}

// Helper: get current hour timestamp (e.g. YYYYMMDDHH)
function getCurrentHour() {
  const d = new Date();
  return d.getFullYear() * 1000000 + (d.getMonth() + 1) * 10000 + d.getDate() * 100 + d.getHours();
}

// API: Get 5 questions assigned for user this hour, or assign new 5 if none
app.get('/api/questions', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const hour = getCurrentHour();

  // Check if user has assigned questions this hour
  const assigned = db.prepare(`
    SELECT questionId FROM user_question_sets WHERE sessionId = ? AND hour = ?
  `).all(sessionId, hour);

  if (assigned.length === 5) {
    // Fetch question data for these 5 ids
    const questionsData = db.prepare(`
      SELECT * FROM questions WHERE id IN (${assigned.map(() => '?').join(',')})
    `).all(...assigned.map(a => a.questionId));

    const formatted = questionsData.map(q => ({
      id: q.id,
      question: q.question,
      answers: [q.answer0, q.answer1, q.answer2, q.answer3],
    }));

    return res.json({ questions: formatted });
  }

  if (assigned.length > 0 && assigned.length < 5) {
    // Edge case: incomplete assignment, clean and reassign
    db.prepare(`DELETE FROM user_question_sets WHERE sessionId = ? AND hour = ?`).run(sessionId, hour);
  }

  // Assign 5 random unique questions to user for this hour
  const allQuestionIds = db.prepare('SELECT id FROM questions').all().map(q => q.id);

  // Pick 5 random unique questions
  const shuffled = allQuestionIds.sort(() => 0.5 - Math.random());
  const selectedIds = shuffled.slice(0, 5);

  // Insert assignment into user_question_sets
  const insertAssignment = db.prepare(`
    INSERT INTO user_question_sets (sessionId, hour, questionId)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const qid of selectedIds) {
      insertAssignment.run(sessionId, hour, qid);
    }
  });

  insertMany();

  // Fetch questions for these IDs
  const questionsData = db.prepare(`
    SELECT * FROM questions WHERE id IN (${selectedIds.map(() => '?').join(',')})
  `).all(...selectedIds);

  const formatted = questionsData.map(q => ({
    id: q.id,
    question: q.question,
    answers: [q.answer0, q.answer1, q.answer2, q.answer3],
  }));

  return res.json({ questions: formatted });
});

// API: Submit answers for current hour questions
app.post('/api/submit', (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Missing sessionId or answers' });
  }

  const hour = getCurrentHour();

  // Get assigned questions for this user this hour
  const assigned = db.prepare(`
    SELECT questionId FROM user_question_sets WHERE sessionId = ? AND hour = ?
  `).all(sessionId, hour);

  if (assigned.length !== 5) {
    return res.status(400).json({ error: 'No assigned questions found for this hour' });
  }

  // Make sure submitted answers correspond to assigned questions
  const assignedIds = new Set(assigned.map(a => a.questionId));

  // Check user_answers to avoid double scoring same question
  const alreadyAnswered = new Set(
    db.prepare(`
      SELECT questionId FROM user_answers WHERE sessionId = ?
    `).all(sessionId).map(r => r.questionId)
  );

  let scoreThisSubmit = 0;

  const insertAnswer = db.prepare(`
    INSERT OR IGNORE INTO user_answers (sessionId, questionId, answerIndex)
    VALUES (?, ?, ?)
  `);

  const getQuestion = db.prepare('SELECT correctAnswer FROM questions WHERE id = ?');

  for (const ans of answers) {
    const { questionId, answerIndex } = ans;
    if (!assignedIds.has(questionId)) {
      // Ignore answers for questions not assigned
      continue;
    }
    if (alreadyAnswered.has(questionId)) {
      // Already answered this question before, skip
      continue;
    }
    const q = getQuestion.get(questionId);
    if (!q) continue;

    if (q.correctAnswer === answerIndex) {
      scoreThisSubmit++;
    }

    insertAnswer.run(sessionId, questionId, answerIndex);
  }

  // Update total score
  const existingScore = db.prepare('SELECT totalScore FROM user_scores WHERE sessionId = ?').get(sessionId);

  if (existingScore) {
    db.prepare('UPDATE user_scores SET totalScore = totalScore + ? WHERE sessionId = ?').run(scoreThisSubmit, sessionId);
  } else {
    db.prepare('INSERT INTO user_scores (sessionId, totalScore) VALUES (?, ?)').run(sessionId, scoreThisSubmit);
  }

  const updatedScore = db.prepare('SELECT totalScore FROM user_scores WHERE sessionId = ?').get(sessionId);

  res.json({
    message: 'Answers submitted',
    scoreThisSubmit,
    totalScore: updatedScore.totalScore,
  });
});

// API: Leaderboard (top 10 by totalScore)
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.prepare(`
    SELECT sessionId, totalScore FROM user_scores ORDER BY totalScore DESC LIMIT 10
  `).all();

  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
