import React, { useState } from 'react';

const InputBox = ({ onSubmit }) => {
  const [inputUrl, setInputUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault(); 
    onSubmit(inputUrl); 
  };

  return (
    <div className='input-box'>
      <input className='input' type="text" placeholder="Enter the URL..." value={inputUrl} onChange={(e) => setInputUrl(e.target.value)}/>
      <button className='button' onClick={handleSubmit}>Submit</button>
    </div>
  );
};

export default InputBox;
