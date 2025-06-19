const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jsfaker = require('json-schema-faker');
const swagerParser = require('@apidevtools/swagger-parser');
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

// Replace path params like {petId} with dummy values
function fillPathParams(pathTemplate, parameters) {
    return pathTemplate.replace(/{([^}]+)}/g, (_, paramName) => {
        return parameters[paramName] || '1'; // fallback if not present
    });
}

app.post('/api', async (req, res) => {
    const { url } = req.body;

    try {
        const promise = await axios.get(url);
        const rawData = promise.data;
        const openApi = await swagerParser.dereference(rawData);

        // Get base URL
        const baseURL =
            openApi.servers?.[0]?.url ||
            ((openApi.schemes?.[0] || 'https') + '://' + openApi.host + openApi.basePath);

        const endpoints = [];

        for (const pathKey in openApi.paths) {
            for (const method in openApi.paths[pathKey]) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    const methodData = openApi.paths[pathKey][method];

                    // Separate path parameters and others
                    const dummyParams = {};
                    const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';

                    if (methodData.parameters) {
                        for (const param of methodData.parameters) {
                            const name = param.name;

                            // Generate dummy value
                            if (param.schema) {
                                dummyParams[name] = await jsfaker.generate(param.schema);
                            } else if (param.type) {
                                if (param.type === 'file' || param.format === 'binary') {
                                    const imgPath = ensureDummyImageExists();
                                    dummyParams[name] = fs.createReadStream(imgPath);
                                } else {
                                    const schema = { type: param.type };
                                    if (param.enum) schema.enum = param.enum;
                                    dummyParams[name] = await jsfaker.generate(schema);
                                }
                            } else {
                                dummyParams[name] = 'dummy';
                            }
                        }
                    }

                    // Replace path params placeholders with dummy values
                    const fullPath = pathKey.replace(/{([^}]+)}/g, (_, p1) => {
                        // Use dummy param if exists, else '1'
                        return dummyParams[p1] !== undefined ? dummyParams[p1] : '1';
                    });

                    const fullUrl = `${baseURL}${fullPath}`;

                    endpoints.push({
                        method,
                        url: fullUrl,
                        parameters: dummyParams,
                        consumes
                    });
                }
            }
        }

        const result = [];

        for (const endpoint of endpoints) {
            const { method, url, parameters, consumes } = endpoint;
            try {
                let response;

                if (method === 'get') {
                    // For get, pass non-path params as query
                    const queryParams = {};
                    // Remove path params from query params
                    for (const [key, val] of Object.entries(parameters)) {
                        if (!url.includes(val)) {
                            queryParams[key] = val;
                        }
                    }
                    response = await axios.get(url, { params: queryParams });
                } else {
                    if (consumes === 'multipart/form-data') {
                        const form = new FormData();
                        for (const key in parameters) {
                            // skip path params in form data (already in URL)
                            if (!url.includes(parameters[key])) {
                                form.append(key, parameters[key]);
                            }
                        }
                        response = await axios({
                            method,
                            url,
                            data: form,
                            headers: form.getHeaders()
                        });
                    } else {
                        // For other methods
                        // Remove path params from body
                        const bodyParams = {};
                        for (const [key, val] of Object.entries(parameters)) {
                            if (!url.includes(val)) {
                                bodyParams[key] = val;
                            }
                        }
                        response = await axios({
                            method,
                            url,
                            data: bodyParams,
                            headers: { 'Content-Type': consumes }
                        });
                    }
                }

                result.push({
                    method,
                    url,
                    parameters: Object.fromEntries(Object.entries(parameters).map(([k, v]) =>
                        typeof v === 'object' && v.path ? [k, `file: ${path.basename(v.path)}`] : [k, v]
                    )),
                    status: response.status,
                    response: response.data
                });
            } catch (error) {
                result.push({
                    method,
                    url,
                    parameters,
                    status: error.response?.status || 500,
                    error: error.response?.data || error.message
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Error parsing Swagger/OpenAPI:', error.message);
        res.status(500).json({ error: 'Failed to process OpenAPI spec.' });
    }
});
