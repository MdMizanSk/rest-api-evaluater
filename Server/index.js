const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jsfaker = require('json-schema-faker');
const swagerParser = require('@apidevtools/swagger-parser');
const app = express();
const port = 8000;

app.use(cors()); 
app.use(express.json());

app.post('/api', async (req, res) => {
    const { url } = req.body;
    try{
        const promise = await axios.get(url);
        const rawData= promise.data;
        const openApi = await swagerParser.dereference(rawData);
        const baseURL=openApi.host + openApi.basePath;

        const endpoints=[]; 

        for (const path in openApi.paths){
            for (const method in openApi.paths[path]) {
                if( method === 'get' || method === 'post' ){
                    const url= `https://${baseURL}${path}`;
                    const methodData = openApi.paths[path][method];
                    

                    const dummyParams={};
                    if(methodData.parameters) {
                        for (const param of methodData.parameters) {
                            if(param.schema){
                                dummyParams[param.name] = await jsfaker.generate(param.schema);
                                //console.log(param.schema+ '  ' + param.name);
                            }
                            else if(param.type){
                                if(param.type ==='file'){
                                    dummyParams[param.name] = 'dummyFile.txt'; // Placeholder for file upload
                                    continue; // Skip further processing for file type
                                }
                                const hardCodeSchema= {
                                    type : param.type
                                }
                                if(param.enum)
                                    hardCodeSchema.enum = param.enum;
                                dummyParams[param.name] = await jsfaker.generate(hardCodeSchema);


                            }
                            else{
                                dummyParams[param.name] = "dummy";
                            }
                        }
                    }
                    endpoints.push({
                        method: method,
                        url: url,
                        parameters: dummyParams
                    });

                }
            }
        }

        const result=[];
        for(const endpoint of endpoints){
            try{
                let responses;
                if(endpoint.method === 'get') {
                    responses = await axios.get(endpoint.url, { params: endpoint.parameters });
                } else if(endpoint.method === 'post') {
                    responses = await axios.post(endpoint.url, endpoint.parameters);
                }
                result.push({
                    method: endpoint.method,
                    url: endpoint.url,
                    parameters: endpoint.parameters,
                    response: responses.data
                });
            }catch (error) {
                result.push({
                    method: endpoint.method,
                    url: endpoint.url,
                    error: `Error: ${error.message}`
                });
            }
        }
        res.json(result);
        // res.end('all ok')
    }catch (error) {
        console.error('Error fetching Swagger JSON:', error);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})
