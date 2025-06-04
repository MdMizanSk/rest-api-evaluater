import axios from 'axios';
import { useEffect, useState } from 'react';

function GetData() {
    const [data,setData]=useState(null);

    useEffect(() =>{
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api');
                //setData(data);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);
    return <></>
}
export default GetData;