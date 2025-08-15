const axios = require('axios');

// Test script to verify large payload handling
async function testLargePayload() {
  const baseURL = 'http://localhost:4009'; // Change to your server URL
  
  // Create a large base64 string to simulate a large PDF
  const largeData = 'A'.repeat(50 * 1024 * 1024); // 50MB of data
  
  const testPayload = {
    number: "5218138744797",
    message: "Test message with large payload",
    pdf: largeData,
    xml: "<?xml version=\"1.0\"?><test>Sample XML</test>",
    customerName: "Test Customer"
  };

  try {
    console.log('🧪 Testing large payload...');
    console.log(`📦 Payload size: ~${Math.round(JSON.stringify(testPayload).length / 1024 / 1024)}MB`);
    
    const response = await axios.post(`${baseURL}/v1/messages`, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });
    
    console.log('✅ Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Server Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.log('❌ Network Error:', error.message);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Test payload limits endpoint
async function testPayloadLimits() {
  const baseURL = 'http://localhost:4009';
  
  const testData = {
    testData: 'A'.repeat(10 * 1024 * 1024) // 10MB test data
  };

  try {
    console.log('🧪 Testing payload limits endpoint...');
    const response = await axios.post(`${baseURL}/v1/test-payload`, testData);
    console.log('✅ Test payload response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Server Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting payload tests...\n');
  
  await testPayloadLimits();
  console.log('\n' + '='.repeat(50) + '\n');
  await testLargePayload();
}

runTests().catch(console.error);