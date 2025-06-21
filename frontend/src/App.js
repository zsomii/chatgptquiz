import React, { useState, useEffect } from 'react';
import Quiz from './Quiz';

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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Mi a neved?</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Add meg a neved"
            style={{ padding: '0.5rem', fontSize: '1rem' }}
          />
          <br /><br />
          <button type="submit" style={{ padding: '0.5rem 1rem' }}>Kezdés</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <h2>Szia, {name}!</h2>
      </div>
      <Quiz name={name} />
    </div>
  );
}

export default App;
