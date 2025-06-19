import React from 'react';

const LogBox = ({ logs }) => {
  if (!Array.isArray(logs)) return null;

  return (
    <div className='log-box'>
      <h2>API Test Results</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Request URL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => {
            let status;
            if (log.error) {
              status = typeof log.error === 'string'
                ? log.error
                : JSON.stringify(log.error);
            } else if (log.response) {
              status = '200 OK';
            } else {
              status = 'Unknown';
            }

            return (
              <tr key={index}>
                <td>{log.method?.toUpperCase() || '—'}</td>
                <td>{log.url || '—'}</td>
                <td><pre style={{ margin: 0 }}>{status}</pre></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LogBox;
