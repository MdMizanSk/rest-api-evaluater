import React from 'react';

const Response = ({ logs }) => {
    console.log("Logs:", logs);
  return (
    <div className='response-box'>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Parameters</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index}>
              <td>{log.method}</td>
              <td>{log.url}</td>
              <td>
                <pre>
                  {log.parameters
                    ? JSON.stringify(log.parameters, null, 2)
                    : '—'}
                </pre>
              </td>
              <td>
                <pre>
                  {log.response
                    ? JSON.stringify(log.response, null, 2)
                    : log.error
                    ? typeof log.error === 'object'
                      ? JSON.stringify(log.error, null, 2)
                      : log.error
                    : '—'}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Response;
