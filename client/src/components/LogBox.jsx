import react from 'react';

const LogBox = ({logs}) => {
    if (!Array.isArray(logs)) return null;
    return (
        <div className='log-box'> 
            <table>
                <thead>
                    <tr><th>Method</th><th>Request</th><th>Status</th></tr>
                </thead>
                <tbody>
                    {logs.map((log, index) => (
                    <tr key={index}>
                        <td>{log.method}</td>
                        <td>{log.url}</td>
                        <td>
                            {log.error ? log.error : log.response ? '200 OK': 'Unknown'}
                        </td>
                    </tr>
                    ))}
                    
                </tbody>
            </table>
        </div>
    );
};
export default LogBox;