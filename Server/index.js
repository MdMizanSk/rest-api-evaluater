const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jsfaker = require('json-schema-faker');
const swaggerParser = require('@apidevtools/swagger-parser');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json());

function ensureDummyImageExists() {
    const dummyImagePath = path.join(__dirname, 'dummy.jpg');
    if (!fs.existsSync(dummyImagePath)) {
        const jpegHeader = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0,
            0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
            0xFF, 0xD9
        ]);
        fs.writeFileSync(dummyImagePath, jpegHeader);
    }
    return dummyImagePath;
}

app.post('/api', async (req, res) => {
    const { url } = req.body;
    try {
        const rawSpec = (await axios.get(url)).data;
        const openApi = await swaggerParser.dereference(rawSpec);
        const baseURL = `${(openApi.schemes?.[0] || 'https')}://${openApi.host}${openApi.basePath || ''}`;

        const endpoints = [];
        const pathIdStore = {}; // Save IDs from POST responses

        for (const pathKey in openApi.paths) {
            for (const method in openApi.paths[pathKey]) {
                if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

                const methodData = openApi.paths[pathKey][method];
                const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';
                let fullUrl = `${baseURL}${pathKey}`;

                const dummyParams = {};
                if (methodData.parameters) {
                    for (const param of methodData.parameters) {
                        if (param.in === 'path') {
                            const value = jsfaker.generate({ type: 'integer', minimum: 1, maximum: 99999999 });
                            fullUrl = fullUrl.replace(`{${param.name}}`, value);
                            pathIdStore[param.name] = value;
                        } else if (param.in === 'body' && param.schema) {
                            Object.assign(dummyParams, await jsfaker.generate(param.schema));
                        } else if (param.in === 'formData') {
                            if (param.type === 'file' || param.format === 'binary') {
                                const imgPath = ensureDummyImageExists();
                                dummyParams[param.name] = fs.createReadStream(imgPath);
                            } else {
                                dummyParams[param.name] = jsfaker.generate({ type: param.type });
                            }
                        } else {
                            dummyParams[param.name] = jsfaker.generate({ type: param.type || 'string' });
                        }
                    }
                }

                endpoints.push({ method, url: fullUrl, parameters: dummyParams, consumes });
            }
        }

        const result = [];

        for (const endpoint of endpoints) {
            try {
                let response;
                const { method, url, parameters, consumes } = endpoint;

                if (method === 'get') {
                    response = await axios.get(url, { params: parameters });
                } else if (consumes === 'multipart/form-data') {
                    const form = new FormData();
                    for (const key in parameters) {
                        form.append(key, parameters[key]);
                    }
                    response = await axios({
                        method,
                        url,
                        data: form,
                        headers: form.getHeaders()
                    });
                } else {
                    response = await axios({
                        method,
                        url,
                        data: parameters,
                        headers: { 'Content-Type': consumes }
                    });
                }

                result.push({
                    method,
                    url,
                    parameters: Object.fromEntries(Object.entries(parameters).map(([k, v]) =>
                        typeof v === 'object' && v.path ? [k, `file: ${path.basename(v.path)}`] : [k, v]
                    )),
                    response: response.data
                });

                // Save ID for path use in subsequent calls (e.g., POST returns a petId)
                const id = response.data?.id || response.data?.petId || response.data?.orderId || response.data?.username;
                if (id) {
                    pathIdStore['petId'] = id;
                    pathIdStore['orderId'] = id;
                    pathIdStore['username'] = id;
                }
            } catch (error) {
                result.push({
                    method: endpoint.method,
                    url: endpoint.url,
                    error: error.response?.data || error.message
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching Swagger JSON:', error.message);
        res.status(500).json({ error: 'Failed to process OpenAPI spec.' });
    }
});

app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
