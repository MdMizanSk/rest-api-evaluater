import React, { useState } from 'react';
import axios from 'axios';
import Header from './components/Header';
import InputBox from './components/InputBox';
import LogBox from './components/LogBox';
import Response from './components/Response';
import './style.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const API_BASE_URL = 'https://rest-api-evaluater-server.onrender.com/api';

  const handleUrlSubmit = async (swaggerUrl) => {
    try {
      setError('');
      setLogs([]);
      const response = await axios.post(API_BASE_URL, { url: swaggerUrl });
      setLogs(response.data);
    } catch (err) {
      console.error('Request failed:', err);
      setError(err.message || 'Something went wrong.');
    }
  };

  try {
    return (
      <div className="container">
        <Header />
        <InputBox onSubmit={handleUrlSubmit} />
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        <LogBox logs={logs} />
        <Response logs={logs} />
      </div>
    );
  } catch (e) {
    console.error('Render crash:', e);
    return <div>❌ A component crashed: {e.message}</div>;
  }
}

export default App;
