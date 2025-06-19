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
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49,
      0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48,
      0x00, 0x00, 0xff, 0xd9
    ]);
    fs.writeFileSync(dummyImagePath, jpegHeader);
  }
  return dummyImagePath;
}

app.post('/api', async (req, res) => {
  const { url } = req.body;

  try {
    const promise = await axios.get(url);
    const rawData = promise.data;
    const openApi = await swaggerParser.dereference(rawData);
    const baseURL = (openApi.schemes?.[0] || 'https') + '://' + openApi.host + openApi.basePath;

    const endpoints = [];
    const idStore = { petId: null, orderId: null, username: null };

    for (const pathKey in openApi.paths) {
      for (const method in openApi.paths[pathKey]) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

        let fullPath = pathKey;
        const methodData = openApi.paths[pathKey][method];
        const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';
        const dummyParams = {};

        // Replace placeholders if we already have IDs
        fullPath = fullPath.replace('{petId}', idStore.petId ?? '{petId}');
        fullPath = fullPath.replace('{orderId}', idStore.orderId ?? '{orderId}');
        fullPath = fullPath.replace('{username}', idStore.username ?? '{username}');

        if (fullPath.includes('{')) continue; // Skip if placeholder still remains

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

        endpoints.push({ method, url: `${baseURL}${fullPath}`, parameters: dummyParams, consumes });
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
          response = await axios({ method, url, data: form, headers: form.getHeaders() });
        } else {
          response = await axios({ method, url, data: parameters, headers: { 'Content-Type': consumes } });
        }

        // Save generated IDs for future use
        if (url.includes('/pet') && method === 'post' && response.data?.id) {
          idStore.petId = response.data.id;
        }
        if (url.includes('/order') && method === 'post' && response.data?.id) {
          idStore.orderId = response.data.id;
        }
        if (url.includes('/user') && method === 'post' && response.data?.username) {
          idStore.username = response.data.username;
        }

        result.push({ method, url, parameters: simplifyParams(parameters), response: response.data });
      } catch (error) {
        result.push({
          method: endpoint.method,
          url: endpoint.url,
          parameters: simplifyParams(endpoint.parameters),
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

function simplifyParams(params) {
  return Object.fromEntries(Object.entries(params).map(([k, v]) =>
    typeof v === 'object' && v.path ? [k, `file: ${path.basename(v.path)}`] : [k, v]
  ));
}

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
