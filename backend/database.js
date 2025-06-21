import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { questions } from './questions.js';

export async function openDb() {
  const db = await open({
    filename: './quiz.db',
    driver: sqlite3.Database,
  });

  // Create tables if not exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correctIndex INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sessionId TEXT PRIMARY KEY,
      assignedQuestionIds TEXT NOT NULL,  -- JSON array
      score INTEGER DEFAULT 0,
      lastAnsweredAt INTEGER
    );
  `);

  // Seed questions if empty
  const count = await db.get('SELECT COUNT(*) as cnt FROM questions');
  if (count.cnt === 0) {
    const insert = await db.prepare('INSERT INTO questions (id, question, options, correctIndex) VALUES (?, ?, ?, ?)');
    for (const q of questions) {
      await insert.run(q.id, q.question, JSON.stringify(q.answers), q.correctIndex);
    }
    await insert.finalize();
    console.log('Seeded questions to DB.');
  }

  return db;
}
