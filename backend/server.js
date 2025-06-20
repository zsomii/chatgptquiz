const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

const DB_FILE = './quiz.db';

const db = new sqlite3.Database(DB_FILE);

// Seed questions if not exist
const seedQuestions = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      question TEXT,
      answer1 TEXT,
      answer2 TEXT,
      answer3 TEXT,
      answer4 TEXT,
      correct INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY,
      sessionId TEXT,
      questionId INTEGER,
      selected INTEGER,
      correct INTEGER,
      answeredAt INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      sessionId TEXT PRIMARY KEY,
      name TEXT
    )`);

    db.get(`SELECT COUNT(*) as count FROM questions`, (err, row) => {
      if (row.count === 0) {
        // Seed 100 Hungarian questions
        const questions = generateHungarianQuestions();
        const stmt = db.prepare(`INSERT INTO questions 
          (question, answer1, answer2, answer3, answer4, correct) VALUES (?, ?, ?, ?, ?, ?)`);

        questions.forEach(q => {
          stmt.run(q.question, q.answers[0], q.answers[1], q.answers[2], q.answers[3], q.correct);
        });
        stmt.finalize();
        console.log('Seeded questions');
      }
    });
  });
};

function generateHungarianQuestions() {
  const baseQuestions = [
    {
      question: 'Mi Magyarország fővárosa?',
      answers: ['Budapest', 'Debrecen', 'Szeged', 'Pécs'],
      correct: 0,
    },
    {
      question: 'Melyik évben volt a magyar forradalom?',
      answers: ['1848', '1914', '1956', '1945'],
      correct: 0,
    },
    {
      question: 'Mi a magyar nemzeti ital?',
      answers: ['Pálinka', 'Sör', 'Bor', 'Kávé'],
      correct: 0,
    },
    {
      question: 'Ki volt Szent István?',
      answers: ['Magyarország első királya', 'Festő', 'Író', 'Zenész'],
      correct: 0,
    },
    {
      question: 'Mi a Hortobágy?',
      answers: ['Nemzeti park', 'Város', 'Tó', 'Folyó'],
      correct: 0,
    }
  ];
  let questions = [];
  for(let i=0; i<20; i++) {
    baseQuestions.forEach((q) => {
      questions.push({
        question: q.question + ` (${i+1})`,
        answers: q.answers,
        correct: q.correct,
      });
    });
  }
  return questions.slice(0,100);
}

seedQuestions();

// API: get 5 questions for current hour that user has not answered
app.get('/api/questions', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const hourStart = now.getTime();

  db.all(`SELECT questionId FROM answers WHERE sessionId = ? AND answeredAt >= ?`, [sessionId, hourStart], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const answeredIds = rows.map(r => r.questionId);

    const placeholders = answeredIds.length > 0 ? answeredIds.map(() => '?').join(',') : '';
    const sql = answeredIds.length > 0
      ? `SELECT * FROM questions WHERE id NOT IN (${placeholders}) LIMIT 5`
      : `SELECT * FROM questions LIMIT 5`;

    db.all(sql, answeredIds, (err2, questions) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (questions.length === 0) {
        const nextHour = hourStart + 3600 * 1000;
        return res.json({ done: true, nextHour });
      }
      res.json({ questions, done: false });
    });
  });
});

// Submit answers
app.post('/api/submit', (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId || !answers) return res.status(400).json({ error: 'Missing data' });

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const hourStart = now.getTime();

  if (!Array.isArray(answers)) return res.status(400).json({ error: 'Answers should be array' });

  const questionIds = answers.map(a => a.questionId);
  const placeholders = questionIds.map(() => '?').join(',');
  db.all(`SELECT id, correct FROM questions WHERE id IN (${placeholders})`, questionIds, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const correctMap = {};
    rows.forEach(r => {
      correctMap[r.id] = r.correct;
    });

    let score = 0;
    const stmt = db.prepare(`INSERT INTO answers (sessionId, questionId, selected, correct, answeredAt) VALUES (?, ?, ?, ?, ?)`);

    answers.forEach(a => {
      const correctIndex = correctMap[a.questionId];
      const isCorrect = a.selected === correctIndex ? 1 : 0;
      if (isCorrect) score++;
      stmt.run(sessionId, a.questionId, a.selected, isCorrect, hourStart);
    });

    stmt.finalize(() => {
      res.json({ score });
    });
  });
});

// Save/update user name
app.post('/api/user', (req, res) => {
  const { sessionId, name } = req.body;
  if (!sessionId || !name) return res.status(400).json({ error: 'Missing sessionId or name' });

  db.run(
    `INSERT INTO users (sessionId, name) VALUES (?, ?)
     ON CONFLICT(sessionId) DO UPDATE SET name=excluded.name`,
    [sessionId, name],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Cumulative toplist endpoint
app.get('/api/toplist', (req, res) => {
  const sql = `
    SELECT u.name, a.sessionId, SUM(a.correct) AS score
    FROM answers a
    JOIN users u ON a.sessionId = u.sessionId
    GROUP BY a.sessionId
    ORDER BY score DESC
    LIMIT 10
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});