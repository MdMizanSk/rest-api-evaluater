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
      0xff, 0xd8, 0xff, 0xe0,
      0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
      0xff, 0xd9
    ]);
    fs.writeFileSync(dummyImagePath, jpegHeader);
  }
  return dummyImagePath;
}

function generatePositiveInt() {
  return Math.floor(Math.random() * 1000000000) + 1;
}

// For Petstore API, allowed methods per path (can be extended)
const validMethodsForPath = {
  '/pet': ['get', 'post', 'put'],
  '/pet/{petId}': ['get', 'put', 'delete'],
  '/pet/{petId}/uploadImage': ['post'],
  '/store/inventory': ['get'],
  '/store/order': ['post', 'get'],
  '/store/order/{orderId}': ['get', 'delete'],
  '/user': ['post'],
  '/user/createWithList': ['post'],
  '/user/createWithArray': ['post'],
  '/user/{username}': ['get', 'put', 'delete'],
  '/user/login': ['get'],
  '/user/logout': ['get'],
};

app.post('/api', async (req, res) => {
  const { url } = req.body;
  try {
    const swaggerResponse = await axios.get(url);
    const rawData = swaggerResponse.data;
    const openApi = await swaggerParser.dereference(rawData);

    const scheme = openApi.schemes?.[0] || 'https';
    const baseURL = scheme + '://' + openApi.host + openApi.basePath;

    // Map to keep created IDs for path params (like petId, orderId, username)
    const createdIds = {};

    // Helper to create a pet and get valid petId for reuse
    async function createPet() {
      try {
        const petPayload = {
          id: generatePositiveInt(),
          name: "DummyPet",
          photoUrls: ["http://example.com/photo.jpg"],
          status: "available"
        };
        const resp = await axios.post(`${baseURL}/pet`, petPayload);
        if (resp.data && resp.data.id) {
          return resp.data.id;
        }
        return petPayload.id;
      } catch (err) {
        console.warn('Failed to create pet:', err.message);
        return generatePositiveInt();
      }
    }

    // Pre-create petId to replace {petId}
    createdIds['petId'] = await createPet();

    const endpoints = [];

    for (const pathKey in openApi.paths) {
      for (const method in openApi.paths[pathKey]) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

        // Skip invalid method for path (if known)
        if (validMethodsForPath[pathKey] && !validMethodsForPath[pathKey].includes(method)) {
          continue;
        }

        // Replace path params like {petId} with generated or created ids
        let actualPath = pathKey.replace(/{([^}]+)}/g, (_, paramName) => {
          if (createdIds[paramName]) return createdIds[paramName];
          // For other params generate positive int as fallback
          return generatePositiveInt();
        });

        const fullUrl = `${baseURL}${actualPath}`;
        const methodData = openApi.paths[pathKey][method];
        const dummyParams = {};
        const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';

        if (methodData.parameters) {
          for (const param of methodData.parameters) {
            // Skip path parameters since we replaced them in URL
            if (param.in === 'path') continue;

            if (param.schema) {
              dummyParams[param.name] = await jsfaker.generate(param.schema);
            } else if (param.type) {
              if (param.type === 'file' || param.format === 'binary') {
                const imgPath = ensureDummyImageExists();
                dummyParams[param.name] = fs.createReadStream(imgPath);
              } else {
                const schema = { type: param.type };
                if (param.enum) schema.enum = param.enum;
                // For integer/number type ensure positive for IDs if needed
                if ((param.name.toLowerCase().includes('id') || param.type === 'integer') && !param.enum) {
                  dummyParams[param.name] = generatePositiveInt();
                } else {
                  dummyParams[param.name] = await jsfaker.generate(schema);
                }
              }
            } else {
              dummyParams[param.name] = "dummy";
            }
          }
        }

        endpoints.push({
          method,
          url: fullUrl,
          parameters: dummyParams,
          consumes,
        });
      }
    }

    const result = [];

    for (const endpoint of endpoints) {
      try {
        let response;
        const { method, url, parameters, consumes } = endpoint;

        if (method === 'get') {
          response = await axios.get(url, { params: parameters });
        } else {
          if (consumes === 'multipart/form-data') {
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
        }

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
