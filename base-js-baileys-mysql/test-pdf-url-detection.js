const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:4009';
const TEST_NUMBER = '1234567890';

// Test cases
const testCases = [
  {
    name: 'PDF as URL',
    data: {
      number: TEST_NUMBER,
      message: 'Test message with PDF URL',
      pdf: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      xml: '<xml>test</xml>',
      customerName: 'Test Customer'
    }
  },
  {
    name: 'PDF as base64',
    data: {
      number: TEST_NUMBER,
      message: 'Test message with PDF base64',
      pdf: 'JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KeJzLSM3PyVEozy/KSVEoLU5NLMnMz1FIzkksLU5VyMxTyC9NScwr0ctLLckozSvRy87IL9dLzs8rSc0rzi9KLMnMz9FLLskvL9JLzsjMS8/MS9dLzk9JLbJSULBVqAUAn5wjFAplbmRzdHJlYW0KZW5kb2JqCgozIDAgb2JqCjw8Ci9MZW5ndGggMTAKPj4Kc3RyZWFtCmVuZG9iagpzdHJlYW0KZW5kb2JqCgp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTggMDAwMDAgbiAKMDAwMDAwMDA3NyAwMDAwMCBuIAowMDAwMDAwMTc4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNAovUm9vdCAyIDAgUgo+PgpzdGFydHhyZWYKMjI4CiUlRU9G',
      xml: '<xml>test</xml>',
      customerName: 'Test Customer'
    }
  }
];

async function runTests() {
  console.log('🧪 Testing PDF URL vs Base64 detection...\n');

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      const response = await axios.post(`${BASE_URL}/v1/messages`, testCase.data, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log(`✅ ${testCase.name}: ${response.data.status}`);
      console.log(`   Message: ${response.data.message}`);
      if (response.data.warning) {
        console.log(`   Warning: ${response.data.warning}`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.error(`   Error: ${error.message}`);
      }
      console.log('');
    }
  }
}

// Run tests
runTests().catch(console.error);