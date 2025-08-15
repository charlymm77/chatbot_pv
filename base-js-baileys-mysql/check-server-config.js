const axios = require('axios');

async function checkServerConfig() {
  const baseURL = 'http://localhost:4009'; // Change to your server URL
  
  try {
    console.log('🔍 Checking server configuration...\n');
    
    // Check server status
    const statusResponse = await axios.get(`${baseURL}/v1/status`);
    console.log('📊 Server Status:', statusResponse.data);
    
    // Check if server is accessible
    const homeResponse = await axios.get(baseURL);
    console.log('🏠 Home page accessible:', homeResponse.status === 200 ? '✅' : '❌');
    
    // Test small payload
    const smallTestResponse = await axios.post(`${baseURL}/v1/test-payload`, {
      test: 'small payload'
    });
    console.log('📦 Small payload test:', smallTestResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Server Error:', error.response.status);
      console.log('Response:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Server might not be running');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

checkServerConfig();