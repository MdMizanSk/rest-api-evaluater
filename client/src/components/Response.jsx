import React from 'react';

const Response = ({ logs }) => {
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
                {log.parameters ? (
                  <pre>{JSON.stringify(log.parameters, null, 2)}</pre>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {log.response ? (
                  <pre>{JSON.stringify(log.response, null, 2)}</pre>
                ) : log.error ? (
                  typeof log.error === 'object' ? (
                    <pre>{JSON.stringify(log.error, null, 2)}</pre>
                  ) : (
                    log.error
                  )
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Response;
