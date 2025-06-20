import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function getSessionId() {
  let id = localStorage.getItem('sessionId');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('sessionId', id);
  }
  return id;
}

function Toplist() {
  const [toplist, setToplist] = useState([]);

  useEffect(() => {
    const fetchToplist = () => {
      fetch(`${API_URL}/toplist`)
        .then(res => res.json())
        .then(data => setToplist(data))
        .catch(() => setToplist([]));
    };

    fetchToplist();
    const interval = setInterval(fetchToplist, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ marginTop: 20 }}>
      <h2>Toplista (összesített)</h2>
      {toplist.length === 0 && <p>Nincs még eredmény.</p>}
      <ol>
        {toplist.map(({ sessionId, name, score }) => (
          <li key={sessionId}>{name}: {score} pont</li>
        ))}
      </ol>
    </div>
  );
}

function App() {
  const [name, setName] = useState(localStorage.getItem('name') || '');
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState('');
  const sessionId = getSessionId();

  useEffect(() => {
    if (started) fetchQuestions();
  }, [started]);

  useEffect(() => {
    if (done) {
      // Countdown to next hour
      const interval = setInterval(() => {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        const diff = nextHour - now;
        if (diff <= 0) {
          setDone(false);
          setScore(null);
          setAnswers({});
          fetchQuestions();
          clearInterval(interval);
          return;
        }
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes} perc ${seconds} mp`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [done]);

  function fetchQuestions() {
    fetch(`${API_URL}/questions?sessionId=${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.done) {
          setDone(true);
        } else {
          setQuestions(data.questions);
          setDone(false);
          setScore(null);
          setAnswers({});
        }
      });
  }

  function selectAnswer(qid, idx) {
    setAnswers(prev => ({ ...prev, [qid]: idx }));
  }

  function submitAnswers() {
    if (Object.keys(answers).length < questions.length) {
      alert('Minden kérdésre válaszolj!');
      return;
    }
    const payload = {
      sessionId,
      answers: Object.entries(answers).map(([qid, selected]) => ({
        questionId: Number(qid),
        selected,
      })),
    };
    fetch(`${API_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        setScore(data.score);
      });
  }

  function startQuiz() {
    if (!name.trim()) return;
    localStorage.setItem('name', name);
    fetch(`${API_URL}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, name }),
    }).then(() => {
      setStarted(true);
    });
  }

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 20, fontFamily: 'Arial' }}>
      {!started ? (
        <>
          <h1>Kvíz játék</h1>
          <input
            placeholder="Add meg a neved"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ fontSize: 16, padding: 8, width: '100%', marginBottom: 10 }}
          />
          <button
            disabled={!name.trim()}
            onClick={startQuiz}
            style={{ fontSize: 16, padding: '8px 12px' }}
          >
            Kezdés
          </button>
        </>
      ) : done ? (
        <>
          <h1>Minden kérdés megválaszolva erre az órára.</h1>
          <p>Következő kérdések a következő órában érhetők el.</p>
          <p>Várakozás: {countdown}</p>
          <Toplist />
        </>
      ) : score !== null ? (
        <>
          <h1>Eredményed: {score} / {questions.length}</h1>
          <button onClick={() => fetchQuestions()}>Új kérdések</button>
          <Toplist />
        </>
      ) : (
        <>
          <h1>Kérdések</h1>
          <form
            onSubmit={e => {
              e.preventDefault();
              submitAnswers();
            }}
          >
            {questions.map(q => (
              <div key={q.id} style={{ marginBottom: 15 }}>
                <p>{q.question}</p>
                { [q.answer1, q.answer2, q.answer3, q.answer4].map((a, i) => (
                  <label key={i} style={{ display: 'block', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`q${q.id}`}
                      value={i}
                      checked={answers[q.id] === i}
                      onChange={() => selectAnswer(q.id, i)}
                    /> {a}
                  </label>
                ))}
              </div>
            ))}
            <button type="submit" style={{ fontSize: 16, padding: '8px 12px' }}>Beküldés</button>
          </form>
          <Toplist />
        </>
      )}
    </div>
  );
}

export default App;
