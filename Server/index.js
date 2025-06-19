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

    const capturedIds = {
        petId: null,
        orderId: null,
        username: null
    };

    try {
        const rawData = (await axios.get(url)).data;
        const openApi = await swaggerParser.dereference(rawData);
        const baseURL = `${openApi.schemes?.[0] || 'https'}://${openApi.host}${openApi.basePath}`;

        const endpoints = [];

        for (const pathKey in openApi.paths) {
            for (const method in openApi.paths[pathKey]) {
                if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

                const methodData = openApi.paths[pathKey][method];
                let resolvedPath = pathKey;

                // Replace path params if values are known
                if (pathKey.includes('{petId}') && capturedIds.petId) {
                    resolvedPath = pathKey.replace('{petId}', capturedIds.petId);
                } else if (pathKey.includes('{orderId}') && capturedIds.orderId) {
                    resolvedPath = pathKey.replace('{orderId}', capturedIds.orderId);
                } else if (pathKey.includes('{username}') && capturedIds.username) {
                    resolvedPath = pathKey.replace('{username}', capturedIds.username);
                } else if (pathKey.match(/\{.*?\}/)) {
                    // Unfilled path parameters - skip this endpoint
                    continue;
                }

                const fullUrl = `${baseURL}${resolvedPath}`;
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

                endpoints.push({ method, url: fullUrl, parameters: dummyParams, consumes, pathKey });
            }
        }

        const result = [];

        for (const endpoint of endpoints) {
            try {
                let response;
                const { method, url, parameters, consumes, pathKey } = endpoint;

                if (method === 'get') {
                    response = await axios.get(url, { params: parameters });
                } else {
                    if (consumes === 'multipart/form-data') {
                        const form = new FormData();
                        for (const key in parameters) {
                            form.append(key, parameters[key]);
                        }
                        response = await axios({ method, url, data: form, headers: form.getHeaders() });
                    } else {
                        response = await axios({ method, url, data: parameters, headers: { 'Content-Type': consumes } });
                    }
                }

                const paramClean = Object.fromEntries(
                    Object.entries(parameters).map(([k, v]) =>
                        typeof v === 'object' && v.path ? [k, `file: ${path.basename(v.path)}`] : [k, v]
                    )
                );

                // Capture returned IDs
                if (method === 'post' && pathKey.includes('/pet') && response.data?.id) {
                    capturedIds.petId = response.data.id.toString();
                }
                if (method === 'post' && pathKey.includes('/order') && response.data?.id) {
                    capturedIds.orderId = response.data.id.toString();
                }
                if (method === 'post' && pathKey.includes('/user') && response.data?.username) {
                    capturedIds.username = response.data.username.toString();
                }

                result.push({ method, url, parameters: paramClean, response: response.data });
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
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to process OpenAPI spec.' });
    }
});

app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
