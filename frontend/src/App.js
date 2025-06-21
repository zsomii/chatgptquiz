// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';

function generateSessionId() {
  return 'xxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

function App() {
  const [name, setName] = useState(localStorage.getItem('quizName') || '');
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId') || null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [toplist, setToplist] = useState([]);

  useEffect(() => {
    if (!sessionId) {
      const sid = generateSessionId();
      localStorage.setItem('sessionId', sid);
      setSessionId(sid);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !name) return;

    fetch(`/api/questions?sessionId=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else if (data.answered) {
          setMessage(data.message);
          setQuestions([]);
          setScore(null);
        } else {
          setQuestions(data.questions);
          setScore(null);
          setMessage(null);
          setAnswers({});
        }
      })
      .catch(() => setError('Failed to fetch questions'));

    fetch('/api/toplist')
      .then(res => res.json())
      .then(data => setToplist(data.toplist || []))
      .catch(() => setToplist([]));
  }, [sessionId, name]);

  function handleAnswerChange(qId, answerIdx) {
    setAnswers(prev => ({ ...prev, [qId]: answerIdx }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (Object.keys(answers).length !== questions.length) {
      alert('Kérlek válaszolj az összes kérdésre!');
      return;
    }

    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        name,
        answers: questions.map(q => answers[q.id]),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          setScore(null);
        } else {
          setScore(data.totalScore);
          setMessage(null);
          // Refresh toplist
          fetch('/api/toplist')
            .then(res => res.json())
            .then(data => setToplist(data.toplist || []));
        }
      })
      .catch(() => setError('Hiba a beküldés közben'));
  }

  if (!name) {
    return (
      <div className="container">
        <h1>Esküvői Kvíz</h1>
        <label>
          Kérlek add meg a neved:
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) {
                localStorage.setItem('quizName', name.trim());
                setName(name.trim());
              }
            }}
          />
        </label>
        <button
          disabled={!name.trim()}
          onClick={() => {
            localStorage.setItem('quizName', name.trim());
            setName(name.trim());
          }}
        >
          Mehet
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Esküvői Kvíz</h1>
      {error && <div className="error">{error}</div>}
      {message && <div className="message">{message}</div>}

      {score === null && questions.length > 0 && (
        <form onSubmit={handleSubmit}>
          {questions.map(q => (
            <div key={q.id} className="question-block">
              <p>{q.question}</p>
              {q.answers.map((a, idx) => (
                <label key={idx}>
                  <input
                    type="radio"
                    name={`q${q.id}`}
                    value={idx}
                    checked={answers[q.id] === idx}
                    onChange={() => handleAnswerChange(q.id, idx)}
                  />
                  {a}
                </label>
              ))}
            </div>
          ))}
          <button type="submit">Beküld</button>
        </form>
      )}

      {score !== null && (
        <div className="score-message">
          <h2>Az eredményed: {score} / {questions.length}</h2>
        </div>
      )}

      <h2>Toplista</h2>
      <ol>
        {toplist.map((entry, i) => (
          <li key={i}>
            {entry.name} - {entry.score}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default App;
