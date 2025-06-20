import React, { useState, useEffect } from 'react';

function generateSessionId() {
  // Simple UUID generator for session id
  return 'xxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // On mount: get or create sessionId
  useEffect(() => {
    let sid = localStorage.getItem('sessionId');
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem('sessionId', sid);
    }
    setSessionId(sid);
  }, []);

  // Fetch questions when sessionId available
  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/questions?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch questions');
        return res.json();
      })
      .then((data) => {
        if (data.questions && data.questions.length === 5) {
          setQuestions(data.questions);
          setScore(null);
          setAnswers({});
          setError(null);
          setCountdown(null);
        } else {
          setError('No questions assigned for this hour.');
          // Could start countdown here to next hour
          startCountdownToNextHour();
        }
      })
      .catch((err) => setError(err.message));
  }, [sessionId]);

  function handleAnswerChange(questionId, answerIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  }

  function handleSubmit() {
    if (Object.keys(answers).length !== 5) {
      alert('Kérem válaszolja meg az összes kérdést!');
      return;
    }

    setSubmitting(true);
    const payload = {
      sessionId,
      answers: Object.entries(answers).map(([questionId, answerIndex]) => ({
        questionId: parseInt(questionId),
        answerIndex,
      })),
    };

    fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setSubmitting(false);
          return;
        }
        setScore(data.totalScore);
        setSubmitting(false);
        // After submit, maybe start countdown if user answered all questions this hour
        if (data.scoreThisSubmit === 0) startCountdownToNextHour();
      })
      .catch((err) => {
        setError('Hiba a válasz beküldésekor');
        setSubmitting(false);
      });
  }

  // Countdown timer to next hour
  function startCountdownToNextHour() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1);
    nextHour.setMinutes(0, 0, 0);

    function updateCountdown() {
      const diff = nextHour - new Date();
      if (diff <= 0) {
        setCountdown(null);
        window.location.reload(); // reload to fetch new questions
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m} perc ${s} mp múlva új kérdések.`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }

  if (error) return <div className="error">{error}</div>;

  if (countdown) return <div className="countdown">{countdown}</div>;

  if (questions.length === 0) return <div>Betöltés...</div>;

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
          <div key={q.id} className="question-block">
            <p>{q.question}</p>
            {q.answers.map((answer, i) => (
              <label key={i} className="answer-label">
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  value={i}
                  checked={answers[q.id] === i}
                  onChange={() => handleAnswerChange(q.id, i)}
                  disabled={score !== null}
                />
                {answer}
              </label>
            ))}
          </div>
        ))}

        {!score && (
          <button type="submit" disabled={submitting}>
            {submitting ? 'Beküldés...' : 'Beküldés'}
          </button>
        )}
      </form>

      {score !== null && <p>Összpontszám: {score}</p>}
    </div>
  );
}

export default App;
