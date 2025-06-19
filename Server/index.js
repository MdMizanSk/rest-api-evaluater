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
        const swaggerResp = await axios.get(url);
        const rawData = swaggerResp.data;
        const openApi = await swaggerParser.dereference(rawData);
        const baseURL = (openApi.schemes?.[0] || 'https') + '://' + openApi.host + (openApi.basePath || '');

        // Object to store created resource IDs
        const createdResources = {};

        const endpoints = [];

        for (const pathKey in openApi.paths) {
            for (const method in openApi.paths[pathKey]) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    const fullUrl = `${baseURL}${pathKey}`;
                    const methodData = openApi.paths[pathKey][method];
                    const dummyParams = {};
                    const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';

                    if (methodData.parameters) {
                        for (const param of methodData.parameters) {
                            if (param.schema) {
                                dummyParams[param.name] = await jsfaker.generate(param.schema);
                            } else if (param.type) {
                                if (param.type === 'file' || param.format === 'binary') {
                                    const imgPath = ensureDummyImageExists();
                                    dummyParams[param.name] = fs.createReadStream(imgPath);
                                } else {
                                    const schema = { type: param.type };
                                    if (param.enum) schema.enum = param.enum;
                                    dummyParams[param.name] = await jsfaker.generate(schema);
                                }
                            } else {
                                dummyParams[param.name] = "dummy";
                            }
                        }
                    }

                    endpoints.push({
                        method,
                        pathKey,
                        url: fullUrl,
                        parameters: dummyParams,
                        consumes
                    });
                }
            }
        }

        const result = [];

        for (const endpoint of endpoints) {
            try {
                let response;
                const { method, url, parameters, consumes, pathKey } = endpoint;

                // Replace path params like {petId}, {orderId}, {username} in URL with saved IDs or dummy values
                let finalUrl = url.replace(/{([^}]+)}/g, (match, p1) => {
                    // p1 is the param name without braces
                    if (createdResources[p1]) {
                        return createdResources[p1];
                    }
                    // If parameter exists in parameters, use that, else fallback to a dummy number or string
                    if (parameters[p1]) return parameters[p1];
                    // Default dummy replacement: if param includes 'id', use a random positive number else 'dummy'
                    if (p1.toLowerCase().includes('id')) return Math.floor(Math.random() * 1000000).toString();
                    return 'dummy';
                });

                // Also update parameters keys if they hold path param placeholders
                for (const key in parameters) {
                    if (typeof parameters[key] === 'string' && parameters[key].startsWith('{') && parameters[key].endsWith('}')) {
                        const paramName = parameters[key].slice(1, -1);
                        if (createdResources[paramName]) {
                            parameters[key] = createdResources[paramName];
                        } else if (paramName.toLowerCase().includes('id')) {
                            parameters[key] = Math.floor(Math.random() * 1000000).toString();
                        } else {
                            parameters[key] = 'dummy';
                        }
                    }
                }

                if (method === 'post' && pathKey === '/store/order') {
                    // POST store order: capture created order ID
                    response = await axios.post(finalUrl, parameters, {
                        headers: { 'Content-Type': consumes }
                    });
                    if (response.data && response.data.id) {
                        createdResources['orderId'] = response.data.id.toString();
                    } else if (parameters.id) {
                        createdResources['orderId'] = parameters.id.toString();
                    }
                } else if (method === 'post' && pathKey === '/pet') {
                    // POST pet: capture petId
                    response = await axios.post(finalUrl, parameters, {
                        headers: { 'Content-Type': consumes }
                    });
                    if (response.data && response.data.id) {
                        createdResources['petId'] = response.data.id.toString();
                    } else if (parameters.id) {
                        createdResources['petId'] = parameters.id.toString();
                    }
                } else if (method === 'post' && pathKey === '/user') {
                    // POST user: capture username if returned or from parameters
                    response = await axios.post(finalUrl, parameters, {
                        headers: { 'Content-Type': consumes }
                    });
                    if (response.data && response.data.username) {
                        createdResources['username'] = response.data.username;
                    } else if (parameters.username) {
                        createdResources['username'] = parameters.username;
                    }
                } else {
                    // Other requests: normal handling
                    if (method === 'get') {
                        response = await axios.get(finalUrl, { params: parameters });
                    } else {
                        if (consumes === 'multipart/form-data') {
                            const form = new FormData();
                            for (const key in parameters) {
                                form.append(key, parameters[key]);
                            }
                            response = await axios({
                                method,
                                url: finalUrl,
                                data: form,
                                headers: form.getHeaders()
                            });
                        } else {
                            response = await axios({
                                method,
                                url: finalUrl,
                                data: parameters,
                                headers: { 'Content-Type': consumes }
                            });
                        }
                    }
                }

                result.push({
                    method,
                    url: finalUrl,
                    parameters: Object.fromEntries(
                        Object.entries(parameters).map(([k, v]) =>
                            typeof v === 'object' && v.path
                                ? [k, `file: ${path.basename(v.path)}`]
                                : [k, v]
                        )
                    ),
                    response: response.data
                });
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
