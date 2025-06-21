const express = require('express');
const cors = require('cors');
const db = require('./database');
const { questions } = require('./questions');

const app = express();
app.use(cors());
app.use(express.json());

const QUESTIONS_PER_HOUR = 5;

function getCurrentHourKey() {
  const now = new Date();
  return now.toISOString().substring(0, 13); // e.g. '2025-06-20T15'
}

function pickRandomQuestions(allQuestions, count) {
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Promisify db operations
function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

app.get('/api/questions', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const currentHour = getCurrentHourKey();
    const session = await dbGet('SELECT * FROM sessions WHERE sessionId = ?', [sessionId]);

    if (session) {
      if (session.answeredHour === currentHour) {
        return res.json({ answered: true, message: 'Please come back next hour for new questions.' });
      }
      if (session.assignedHour === currentHour && session.assignedQuestions) {
        const assignedIds = JSON.parse(session.assignedQuestions);
        const qs = questions.filter(q => assignedIds.includes(q.id));
        return res.json({ questions: qs });
      }
    }

    // Assign new questions
    const selectedQuestions = pickRandomQuestions(questions, QUESTIONS_PER_HOUR);
    const selectedIds = selectedQuestions.map(q => q.id);

    if (session) {
      await dbRun(
        'UPDATE sessions SET assignedHour = ?, assignedQuestions = ?, answeredHour = NULL, score = NULL WHERE sessionId = ?',
        [currentHour, JSON.stringify(selectedIds), sessionId]
      );
    } else {
      await dbRun(
        'INSERT INTO sessions (sessionId, assignedHour, assignedQuestions) VALUES (?, ?, ?)',
        [sessionId, currentHour, JSON.stringify(selectedIds)]
      );
    }

    res.json({ questions: selectedQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const { sessionId, name, answers } = req.body;
    if (!sessionId || !name || !answers) return res.status(400).json({ error: 'Missing data' });

    const currentHour = getCurrentHourKey();
    const session = await dbGet('SELECT * FROM sessions WHERE sessionId = ?', [sessionId]);

    if (!session || session.answeredHour === currentHour) {
      return res.status(400).json({ error: 'Already answered this hour or no assigned questions' });
    }

    const assignedIds = JSON.parse(session.assignedQuestions);
    if (assignedIds.length !== answers.length) {
      return res.status(400).json({ error: 'Answer count mismatch' });
    }

    let score = 0;
    for (let i = 0; i < assignedIds.length; i++) {
      const q = questions.find(q => q.id === assignedIds[i]);
      if (q && q.correctIndex === answers[i]) score++;
    }

    await dbRun(
      'UPDATE sessions SET answeredHour = ?, score = ?, name = ? WHERE sessionId = ?',
      [currentHour, score, name, sessionId]
    );

    await dbRun(
      'INSERT INTO scores (name, score, answeredHour) VALUES (?, ?, ?)',
      [name, score, currentHour]
    );

    res.json({ totalScore: score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/toplist', async (req, res) => {
  try {
    db.all(
      `SELECT name, MAX(score) as score 
      FROM scores 
      GROUP BY name 
      ORDER BY score DESC 
      LIMIT 10`,
      [],
      (err, rows) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
        res.json({ toplist: rows });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on port ${port}`));
