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

  // ✅ Replace this URL with your deployed backend API URL
  const API_BASE_URL = 'https://rest-api-evaluater-server.onrender.com/api';

  const handleUrlSubmit = async (swaggerUrl) => {
    try {
      setError('');
      setLogs([]);

      const response = await axios.post(API_BASE_URL, {
        url: swaggerUrl,
      });

      setLogs(response.data);
    } catch (error) {
      console.error('Error submitting URL:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  return (
    <div className='container'>
      <Header />
      <InputBox onSubmit={handleUrlSubmit} />
      {error && <div className="error">Error: {error}</div>}
      <LogBox logs={logs} />
      <Response logs={logs} />
    </div>
  );
}

export default App;
