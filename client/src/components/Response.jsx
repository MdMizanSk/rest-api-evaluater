import React from 'react';

const Response = ({ logs }) => {
  console.log("Logs:", logs);

  if (!Array.isArray(logs) || logs.length === 0) {
    return <div className="response-box">No data to display.</div>;
  }

  return (
    <div className='response-box'>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Parameters</th>
            <th>Response/Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index}>
              <td>{log.method?.toUpperCase() || '—'}</td>
              <td>{log.url || '—'}</td>
              <td>
                <pre>
                  {log.parameters
                    ? safeStringify(log.parameters)
                    : '—'}
                </pre>
              </td>
              <td>
                <pre>
                  {log.response
                    ? safeStringify(log.response)
                    : log.error
                    ? typeof log.error === 'object'
                      ? safeStringify(log.error)
                      : String(log.error)
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

// 🔒 Helper to safely stringify
function safeStringify(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return 'Could not stringify data';
  }
}

export default Response;
