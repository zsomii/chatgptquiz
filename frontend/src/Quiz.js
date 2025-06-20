import React, { useState, useEffect } from 'react';

function Quiz({ name }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // For demo, replace this with your actual question loading
  useEffect(() => {
    // Example: fetching from your backend
    fetch('/api/questions')
      .then((res) => res.json())
      .then((data) => setQuestions(data))
      .catch(() => {
        // fallback demo questions
        setQuestions([
          {
            id: 1,
            question: 'Melyik a magyar főváros?',
            answers: ['Debrecen', 'Budapest', 'Szeged', 'Pécs'],
            correctAnswer: 1,
          },
          // Add more questions or load from server
        ]);
      });
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleSubmit = () => {
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore((prev) => prev + 1);
    }

    if (currentIndex + 1 < questions.length && currentIndex + 1 < 5) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  if (questions.length === 0) {
    return <div>Töltés...</div>;
  }

  if (showResult) {
    return (
      <div className="result-message">
        <h2>Gratulálunk, {name}!</h2>
        <p>{score} pontot szereztél ebben az órában.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="question">{currentQuestion.question}</div>
      <div className="answers">
        {currentQuestion.answers.map((ans, i) => (
          <label key={i}>
            <input
              type="radio"
              name="answer"
              value={i}
              checked={selectedAnswer === i}
              onChange={() => setSelectedAnswer(i)}
            />
            {ans}
          </label>
        ))}
      </div>
      <button disabled={selectedAnswer === null} onClick={handleSubmit}>
        Beküld
      </button>
    </div>
  );
}

export default Quiz;
