import { getFacturasB64 } from './src/facturas.js';

// Test the SSL certificate fix
async function testSSLFix() {
  console.log('🧪 Testing SSL certificate fix...');
  
  try {
    // Test with dummy token and path
    const result = await getFacturasB64('test-token', 'test-path');
    console.log('✅ SSL certificate fix working! Response received:', result ? 'Data received' : 'No data');
  } catch (error) {
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.log('❌ SSL certificate verification error still exists');
    } else if (error.response && error.response.status) {
      console.log('✅ SSL certificate fix working! Got HTTP response:', error.response.status);
      console.log('   (This is expected - the API returned an HTTP error, not an SSL error)');
    } else {
      console.log('🔍 Different error (not SSL-related):', error.message);
    }
  }
}

testSSLFix();
