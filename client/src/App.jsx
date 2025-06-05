import React, { useState } from 'react';
import axios from 'axios';
import Header from './components/Header';
import InputBox from './components/InputBox';
import LogBox from './components/LogBox';
import Response from './components/Response';
import GetData from './components/GetData';
import './style.css';

function App() {
  const [logs, setLogs] = useState([]);

  const handleUrlSubmit = async (swaggerUrl) => {
    try {
      const response = await axios.post('https://rest-api-evaluater-server.onrender.com/api', {
        url: swaggerUrl,
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Error submitting URL:', error);
    }
  };

  return (
    <div className='container'>
      <GetData />
      <Header />
      <InputBox onSubmit={handleUrlSubmit} />
      <LogBox logs={logs} />
      <Response logs={logs} />
    </div>
  );
}

export default App;
