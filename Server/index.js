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

const idStore = {
  petId: null,
  orderId: null,
  username: null
};

app.post('/api', async (req, res) => {
  const { url } = req.body;
  try {
    const { data: rawData } = await axios.get(url);
    const openApi = await swaggerParser.dereference(rawData);
    const baseURL = `${openApi.schemes?.[0] || 'https'}://${openApi.host}${openApi.basePath}`;

    const endpoints = [];

    for (const pathKey in openApi.paths) {
      for (const method in openApi.paths[pathKey]) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const methodData = openApi.paths[pathKey][method];
          const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';

          let fullPath = pathKey
            .replace('{petId}', idStore.petId || '{petId}')
            .replace('{orderId}', idStore.orderId || '{orderId}')
            .replace('{username}', idStore.username || '{username}');

          const fullUrl = `${baseURL}${fullPath}`;
          const dummyParams = {};

          if (methodData.parameters) {
            for (const param of methodData.parameters) {
              if (pathKey === '/user/createWithList' && param.name === 'body') {
                dummyParams[param.name] = [
                  {
                    id: 1,
                    username: 'testuser',
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'test@example.com',
                    password: 'password',
                    phone: '1234567890',
                    userStatus: 1
                  }
                ];
              } else if (param.schema) {
                if (param.schema.type === 'array') {
                  dummyParams[param.name] = [await jsfaker.generate(param.schema.items)];
                } else {
                  dummyParams[param.name] = await jsfaker.generate(param.schema);
                }
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

          endpoints.push({ method, url: fullUrl, parameters: dummyParams, consumes });
        }
      }
    }

    const result = [];

    for (const endpoint of endpoints) {
      try {
        const { method, url, parameters, consumes } = endpoint;
        let response;

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

        if (url.includes('/pet') && response.data && response.data.id) idStore.petId = response.data.id;
        if (url.includes('/store/order') && response.data && response.data.id) idStore.orderId = response.data.id;
        if (url.includes('/user') && response.data && parameters.username) idStore.username = parameters.username;

        result.push({
          method,
          url,
          parameters: Object.fromEntries(Object.entries(parameters).map(([k, v]) =>
            typeof v === 'object' && v.path ? [k, `file: ${path.basename(v.path)}`] : [k, v]
          )),
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
