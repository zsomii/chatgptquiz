import express from 'express';
import cors from 'cors';
import { openDb } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to get 5 random unique question IDs from all questions
async function getRandomQuestionIds(db, count = 5) {
  const allIds = await db.all('SELECT id FROM questions');
  const ids = allIds.map(r => r.id);
  // Shuffle and pick first 5
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

// GET /api/questions?sessionId=xxx
app.get('/api/questions', async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  try {
    const db = await openDb();

    // Check if session exists
    const session = await db.get('SELECT * FROM sessions WHERE sessionId = ?', sessionId);
    let questionIds;

    if (session) {
      questionIds = JSON.parse(session.assignedQuestionIds);
    } else {
      // Assign new questions, store session
      questionIds = await getRandomQuestionIds(db);
      await db.run('INSERT INTO sessions (sessionId, assignedQuestionIds) VALUES (?, ?)', sessionId, JSON.stringify(questionIds));
    }

    // Get question details
    const placeholders = questionIds.map(() => '?').join(',');
    const questions = await db.all(
      `SELECT id, question, options FROM questions WHERE id IN (${placeholders})`,
      questionIds
    );

    // Parse options JSON
    const formattedQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      answers: JSON.parse(q.options),
    }));

    res.json({ questions: formattedQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/submit
// Body: { sessionId, answers: [{ questionId, answerIndex }] }
app.post('/api/submit', async (req, res) => {
  const { sessionId, answers } = req.body;
  if (!sessionId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Missing sessionId or answers' });
  }

  try {
    const db = await openDb();
    const session = await db.get('SELECT * FROM sessions WHERE sessionId = ?', sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Prevent multiple submissions in the same hour
    const now = Date.now();
    const lastAnswered = session.lastAnsweredAt || 0;
    if (now - lastAnswered < 60 * 60 * 1000) {
      return res.status(403).json({ error: 'Already answered in the last hour' });
    }

    // Get questions assigned to this session
    const assignedQuestionIds = JSON.parse(session.assignedQuestionIds);

    // Fetch correct answers for assigned questions
    const placeholders = assignedQuestionIds.map(() => '?').join(',');
    const questions = await db.all(
      `SELECT id, correctIndex FROM questions WHERE id IN (${placeholders})`,
      assignedQuestionIds
    );

    // Calculate score
    let totalScore = 0;
    for (const ans of answers) {
      if (!assignedQuestionIds.includes(ans.questionId)) {
        return res.status(400).json({ error: 'Invalid questionId in answers' });
      }
      const q = questions.find(q => q.id === ans.questionId);
      if (q && q.correctIndex === ans.answerIndex) {
        totalScore++;
      }
    }

    // Update session score and timestamp
    await db.run(
      'UPDATE sessions SET score = score + ?, lastAnsweredAt = ? WHERE sessionId = ?',
      totalScore,
      now,
      sessionId
    );

    res.json({ totalScore, scoreThisSubmit: totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
