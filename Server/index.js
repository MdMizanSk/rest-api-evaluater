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

// Helper to generate positive integer IDs
function generatePositiveInt() {
  return Math.floor(Math.random() * 1e7) + 1; // between 1 and 10 million
}

app.post('/api', async (req, res) => {
  const { url } = req.body;

  try {
    const swaggerRaw = await axios.get(url);
    const openApi = await swaggerParser.dereference(swaggerRaw.data);
    const baseURL = (openApi.schemes?.[0] || 'https') + '://' + openApi.host + (openApi.basePath || '');

    const endpoints = [];

    // We'll store created pet IDs etc. here to replace path params later
    const createdResources = {};

    // First pass: prepare endpoints with dummy params, replacing path params with placeholder keys
    for (const pathKey in openApi.paths) {
      for (const method in openApi.paths[pathKey]) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          let fullUrl = `${baseURL}${pathKey}`;
          const methodData = openApi.paths[pathKey][method];
          const dummyParams = {};
          const consumes = methodData.consumes?.[0] || openApi.consumes?.[0] || 'application/json';

          if (methodData.parameters) {
            for (const param of methodData.parameters) {
              if (param.in === 'path') {
                // For path params, put a placeholder (will replace later)
                dummyParams[param.name] = `{${param.name}}`;
              } else if (param.schema) {
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
                dummyParams[param.name] = 'dummy';
              }
            }
          }

          endpoints.push({
            method,
            url: fullUrl,
            parameters: dummyParams,
            consumes,
            pathKey,
            methodData,
          });
        }
      }
    }

    // Helper function to replace path param placeholders with real values
    function replacePathParams(url, params) {
      let replacedUrl = url;
      for (const key in params) {
        if (typeof params[key] === 'string' && params[key].startsWith('{') && params[key].endsWith('}')) {
          const paramName = params[key].slice(1, -1);
          if (params[paramName]) {
            replacedUrl = replacedUrl.replace(`{${paramName}}`, params[paramName]);
          }
        }
      }
      return replacedUrl;
    }

    // Create pets first so we have valid IDs to use for path parameters
    for (const endpoint of endpoints) {
      try {
        let response;
        const { method, url, parameters, consumes, pathKey, methodData } = endpoint;

        // If this is POST /pet, create pet and store ID
        if (method === 'post' && pathKey === '/pet') {
          // Ensure id is present and positive integer
          if (!parameters.id) {
            parameters.id = generatePositiveInt();
          }

          response = await axios.post(url, parameters, {
            headers: { 'Content-Type': consumes }
          });

          // Store created pet id for later usage
          if (response.data && response.data.id) {
            createdResources['petId'] = response.data.id;
          } else {
            createdResources['petId'] = parameters.id;
          }

          endpoint.response = response.data;
          endpoint.parameters = parameters;
          endpoint.url = url;
          continue;
        }

        // Replace path params with created resource ids
        let finalUrl = url;
        for (const paramName in parameters) {
          if (parameters[paramName] && typeof parameters[paramName] === 'string' && parameters[paramName].startsWith('{') && parameters[paramName].endsWith('}')) {
            const key = parameters[paramName].slice(1, -1);
            if (createdResources[key]) {
              finalUrl = finalUrl.replace(`{${key}}`, createdResources[key]);
              parameters[paramName] = createdResources[key];
            }
          }
        }

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
              headers: form.getHeaders(),
            });
          } else {
            response = await axios({
              method,
              url: finalUrl,
              data: parameters,
              headers: { 'Content-Type': consumes },
            });
          }
        }

        endpoint.response = response.data;
        endpoint.parameters = parameters;
        endpoint.url = finalUrl;
      } catch (error) {
        endpoint.error = error.response?.data || error.message;
      }
    }

    // Prepare results for response
    const result = endpoints.map(e => ({
      method: e.method,
      url: e.url,
      parameters: e.parameters,
      response: e.response,
      error: e.error,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching Swagger JSON:', error.message);
    res.status(500).json({ error: 'Failed to process OpenAPI spec.' });
  }
});

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
