import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

function getSessionId() {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

function formatCountdown(diffMs) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m} perc ${s} mp múlva új kérdések.`;
}

export default function Quiz() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const countdownInterval = useRef(null);

  const sessionId = getSessionId();

  // Start countdown timer to next hour
  function startCountdown() {
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    function update() {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = nextHour - now;
      if (diff <= 0) {
        clearInterval(countdownInterval.current);
        setCountdown(null);
        window.location.reload(); // Reload to fetch new questions
      } else {
        setCountdown(formatCountdown(diff));
      }
    }

    update();
    countdownInterval.current = setInterval(update, 1000);
  }

  useEffect(() => {
    async function fetchQuestions() {
      try {
        setLoading(true);
        setError(null);
        setScore(null);
        setCountdown(null);

        const res = await fetch(`/api/questions?sessionId=${sessionId}`);
        if (!res.ok) throw new Error('Nem sikerült betölteni a kérdéseket.');

        const data = await res.json();

        if (!data.questions || data.questions.length === 0) {
          setQuestions([]);
          setError('Ebben az órában nincs kérdés. Kérlek várj.');
          startCountdown();
          return;
        }

        setQuestions(data.questions);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [sessionId]);

  function handleAnswer(questionId, answerIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  }

  async function handleSubmit() {
    if (Object.keys(answers).length !== questions.length) {
      alert('Kérem válaszolja meg az összes kérdést!');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers: Object.entries(answers).map(([qId, ansIndex]) => ({
            questionId: parseInt(qId),
            answerIndex: ansIndex,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Beküldési hiba');
        return;
      }

      setScore(data.totalScore);
      setError(null);

      // If scoreThisSubmit === 0 (means no points or already submitted?), start countdown to next hour
      if (data.scoreThisSubmit === 0) {
        startCountdown();
      }
    } catch (e) {
      setError('Hiba történt a beküldés során');
    } finally {
      setLoading(false);
    }
  }

  // JSX rendering

  if (loading) return <p>Betöltés...</p>;

  if (error && !countdown) return <p className="error">{error}</p>;

  if (countdown)
    return <div className="countdown" style={{ fontWeight: 'bold', fontSize: 18 }}>{countdown}</div>;

  if (score !== null) {
    return (
      <div>
        <h2>Kvíz vége!</h2>
        <p>Összpontszám: {score} / {questions.length}</p>
        <button onClick={() => window.location.reload()}>Újra játszom</button>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <h1>Esküvői Kvíz</h1>
      <p>Üdvözöllek! Válaszolj az alábbi kérdésekre:</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {questions.map((q) => (
          <div key={q.id} className="question-block" style={{ marginBottom: '1.5em' }}>
            <p>{q.question}</p>
            {q.answers.map((answer, i) => (
              <label key={i} className="answer-label" style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  value={i}
                  checked={answers[q.id] === i}
                  onChange={() => handleAnswer(q.id, i)}
                  disabled={score !== null}
                />
                {' '}
                {answer}
              </label>
            ))}
          </div>
        ))}

        {!score && (
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
            }}
          >
            {loading ? 'Beküldés...' : 'Beküldés'}
          </button>
        )}
      </form>
    </div>
  );
}
