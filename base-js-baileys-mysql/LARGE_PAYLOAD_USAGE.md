# Large Payload Usage Guide

## Overview
The WhatsApp bot now supports two endpoints for handling different payload sizes:

- **Regular Endpoint**: `http://localhost:4009/v1/messages` (for payloads < 50MB)
- **Large Payload Endpoint**: `http://localhost:4010/v1/messages-large` (for payloads > 50MB)

## Quick Start

### For Small Payloads (< 50MB)
```javascript
const response = await axios.post('http://localhost:4009/v1/messages', {
  number: '1234567890',
  message: 'Your message here',
  pdf: 'base64_encoded_small_pdf',
  xml: 'base64_encoded_xml',
  customerName: 'Customer Name'
});
```

### For Large Payloads (> 50MB)
```javascript
const response = await axios.post('http://localhost:4010/v1/messages-large', {
  number: '1234567890',
  message: 'Your message here',
  pdf: 'base64_encoded_large_pdf', // Will be skipped automatically
  xml: 'base64_encoded_xml',       // Will be processed
  customerName: 'Customer Name'
}, {
  timeout: 120000 // 2 minutes timeout for large payloads
});
```

## Smart Client Implementation

```javascript
async function sendWhatsAppMessage(payload) {
  // Calculate payload size
  const payloadSize = JSON.stringify(payload).length / 1024 / 1024; // MB
  
  // Choose endpoint based on size
  const endpoint = payloadSize > 50 
    ? 'http://localhost:4010/v1/messages-large'
    : 'http://localhost:4009/v1/messages';
  
  // Set appropriate timeout
  const timeout = payloadSize > 100 ? 120000 : 30000;
  
  console.log(`Sending ${payloadSize.toFixed(2)}MB payload to ${endpoint}`);
  
  try {
    const response = await axios.post(endpoint, payload, {
      timeout,
      headers: { 'Content-Type': 'application/json' }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// Usage example
const result = await sendWhatsAppMessage({
  number: '1234567890',
  message: 'Invoice attached',
  pdf: largePdfBase64,
  xml: xmlBase64,
  customerName: 'John Doe'
});

console.log('Result:', result);
```

## Response Formats

### Successful Small Payload
```json
{
  "status": "ok",
  "message": "Mensaje enviado exitosamente a 1234567890",
  "method": "whatsapp"
}
```

### Successful Large Payload (PDF Skipped)
```json
{
  "status": "partial_success",
  "message": "Mensaje enviado exitosamente a 1234567890 (PDF omitido por tamaño)",
  "method": "whatsapp",
  "warning": "PDF omitido debido al tamaño del payload",
  "pdfSkipped": true,
  "payloadSize": "333.33MB",
  "maxAllowed": "200MB"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description here"
}
```

## Best Practices

### 1. Always Check Response Status
```javascript
const response = await sendWhatsAppMessage(payload);

if (response.status === 'ok') {
  console.log('✅ Message sent successfully with all attachments');
} else if (response.status === 'partial_success') {
  console.log('⚠️ Message sent but PDF was skipped due to size');
  console.log(`PDF size: ${response.payloadSize}, Max allowed: ${response.maxAllowed}`);
} else {
  console.error('❌ Failed to send message:', response.message);
}
```

### 2. Handle Large PDFs Gracefully
```javascript
// Check PDF size before sending
function checkPDFSize(pdfBase64) {
  const sizeBytes = Buffer.from(pdfBase64, 'base64').length;
  const sizeMB = sizeBytes / 1024 / 1024;
  return sizeMB;
}

const pdfSize = checkPDFSize(pdfBase64);
if (pdfSize > 200) {
  console.warn(`⚠️ PDF is ${pdfSize.toFixed(2)}MB, will be skipped automatically`);
  // Consider compressing PDF or using alternative delivery method
}
```

### 3. Set Appropriate Timeouts
```javascript
const config = {
  timeout: payloadSize > 100 ? 180000 : 30000, // 3 min for large, 30s for small
  headers: { 'Content-Type': 'application/json' }
};
```

### 4. Error Handling
```javascript
try {
  const response = await sendWhatsAppMessage(payload);
  return response;
} catch (error) {
  if (error.code === 'ECONNABORTED') {
    console.error('Request timeout - payload might be too large');
  } else if (error.response?.status === 413) {
    console.error('Payload too large for server');
  } else {
    console.error('Unexpected error:', error.message);
  }
  throw error;
}
```

## Testing

### Test Small Payload
```bash
curl -X POST http://localhost:4009/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Test message",
    "xml": "PHRlc3Q+WE1MPC90ZXN0Pg==",
    "customerName": "Test User"
  }'
```

### Test Large Payload Endpoint
```bash
# Use the test script
node test-simple-payload.js
```

## Troubleshooting

### Common Issues

1. **Socket Hang Up**: Usually means the regular endpoint received a payload too large
   - Solution: Use the large payload endpoint (`port 4010`)

2. **Timeout Errors**: Large payloads take time to process
   - Solution: Increase timeout to 2-3 minutes

3. **PDF Not Sent**: Large payload endpoint automatically skips PDFs
   - Expected behavior: Check response for `pdfSkipped: true`

4. **Server Not Responding**: Check if both servers are running
   - Regular server: `curl http://localhost:4009/v1/status`
   - Large payload server: `curl http://localhost:4010/v1/messages-large` (should return 404 for GET)

### Server Status Check
```bash
# Check regular server
curl http://localhost:4009/v1/status

# Check if large payload server is running
curl -X POST http://localhost:4010/v1/messages-large \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Configuration

### Environment Variables
```env
MAX_PAYLOAD_SIZE_MB=200  # Business logic limit for PDF processing
```

### Server Ports
- `4009`: Regular endpoint (builderbot framework)
- `4010`: Large payload endpoint (raw Node.js)
- `4008`: HTTPS endpoint (if SSL enabled)

Make sure these ports are available and not blocked by firewall.