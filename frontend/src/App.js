import React, { useState, useEffect } from 'react';
import Quiz from './Quiz';
import './App.css';

function App() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('quizUserName');
    if (storedName) {
      setName(storedName);
      setSubmitted(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() !== '') {
      localStorage.setItem('quizUserName', name.trim());
      setSubmitted(true);
    }
  };

  if (!submitted) {
    return (
      <div className="quiz-container" style={{ textAlign: 'center' }}>
        <h2>Mi a neved?</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Add meg a neved"
          />
          <br />
          <br />
          <button type="submit">Kezdés</button>
        </form>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <h2>Szia, {name}!</h2>
      </div>
      <Quiz name={name} />
    </div>
  );
}

export default App;
