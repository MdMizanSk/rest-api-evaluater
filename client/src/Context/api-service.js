import { createContext,useContext,useEffect, useState } from "react";
import axios from "axios";
const ApiServiceContext = createContext();
export const ApiServiceProvider = ({ children }) => {
    const [method , setMethod] = useState(' ');
    const [url , setUrl] = useState(' ');
    const [StatusCode , setStatusCode] = useState(' ');
    const [response , setResponse] = useState(' ');
    const makeRequest = async () => {    
        try{
            
            const response = await axios({
                baseUrl : 'http://localhost:8000',
            });
            console.log('Response:', response.data);

            
            return response.data;

        }catch (error) {
            console.error('Error making request:', error);
            throw error;
        }
    }
    const apicall =() => {  
        return makeRequest({
            method: 'get',
            url: '/api',
        })
            
    }
}
