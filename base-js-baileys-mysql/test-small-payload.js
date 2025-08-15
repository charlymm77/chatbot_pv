import https from 'https';
import fs from 'fs';

// Disable SSL certificate verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const testData = {
  number: "5218138744797",
  message: "Test message",
  timestamp: new Date().toISOString()
};

const postData = JSON.stringify(testData);
const payloadSize = Buffer.byteLength(postData, 'utf8');

console.log(`📊 Testing small payload: ${payloadSize} bytes`);
console.log(`📋 Payload content:`, testData);

const options = {
  hostname: 'localhost',
  port: 4009,
  path: '/v1/test-payload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payloadSize
  }
};

// Try HTTP first
import http from 'http';
const req = http.request(options, (res) => {
  console.log(`📡 Response status: ${res.statusCode}`);
  console.log(`📋 Response headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 Response body:`, data);
    try {
      const jsonResponse = JSON.parse(data);
      console.log(`✅ Parsed response:`, jsonResponse);
    } catch (e) {
      console.log(`❌ Could not parse JSON response`);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
});

req.write(postData);
req.end();