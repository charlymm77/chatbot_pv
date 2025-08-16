#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://localhost:4009';
const LARGE_SERVER_URL = 'http://localhost:4010';

// Create a large base64 string to simulate a large PDF
function createLargePDFBase64(sizeMB) {
  const sizeBytes = sizeMB * 1024 * 1024;
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const fillData = Buffer.alloc(sizeBytes - pdfHeader.length, 'A');
  const largePDF = Buffer.concat([pdfHeader, fillData]);
  return largePDF.toString('base64');
}

async function testBothEndpoints() {
  console.log('🧪 Testing both regular and large payload endpoints...\n');

  try {
    // Test 1: Small payload (should use regular endpoint)
    console.log('📝 Test 1: Small payload (should use regular endpoint)');
    const smallPayload = {
      number: '1234567890',
      message: 'Test message with small payload',
      xml: Buffer.from('<?xml version="1.0"?><test>Small XML</test>').toString('base64'),
      customerName: 'Test Customer Small'
    };

    console.log(`📊 Small payload size: ~${Math.round(JSON.stringify(smallPayload).length / 1024)}KB`);
    
    try {
      const response1 = await axios.post(`${SERVER_URL}/v1/messages`, smallPayload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Small payload test result:', response1.data);
    } catch (error) {
      console.log('❌ Small payload test failed:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Large payload (should use large payload endpoint)
    console.log('📝 Test 2: Large payload (should use large payload endpoint)');
    const largePDFBase64 = createLargePDFBase64(250);
    const largePayload = {
      number: '1234567890',
      message: 'Test message with large PDF',
      pdf: largePDFBase64,
      xml: Buffer.from('<?xml version="1.0"?><test>Large XML</test>').toString('base64'),
      customerName: 'Test Customer Large'
    };

    console.log(`📊 Large payload size: ~${Math.round(JSON.stringify(largePayload).length / 1024 / 1024)}MB`);
    
    try {
      const response2 = await axios.post(`${LARGE_SERVER_URL}/v1/messages-large`, largePayload, {
        timeout: 120000,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Large payload test result:', response2.data);
      
      if (response2.data.pdfSkipped) {
        console.log('🎉 SUCCESS: Large payload was handled gracefully!');
      }
    } catch (error) {
      console.log('❌ Large payload test failed:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Medium payload with PDF (should use regular endpoint but skip PDF)
    console.log('📝 Test 3: Medium payload with PDF (should use regular endpoint but skip PDF)');
    const mediumPDFBase64 = createLargePDFBase64(50); // 50MB PDF
    const mediumPayload = {
      number: '1234567890',
      message: 'Test message with medium PDF',
      pdf: mediumPDFBase64,
      xml: Buffer.from('<?xml version="1.0"?><test>Medium XML</test>').toString('base64'),
      customerName: 'Test Customer Medium'
    };

    const mediumPayloadSizeMB = Math.round(JSON.stringify(mediumPayload).length / 1024 / 1024);
    console.log(`📊 Medium payload size: ~${mediumPayloadSizeMB}MB`);
    
    // Choose endpoint based on size
    const endpoint = mediumPayloadSizeMB > 200 
      ? `${LARGE_SERVER_URL}/v1/messages-large`
      : `${SERVER_URL}/v1/messages`;
    
    console.log(`📡 Using endpoint: ${endpoint}`);
    
    try {
      const response3 = await axios.post(endpoint, mediumPayload, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Medium payload test result:', response3.data);
      
      if (response3.data.pdfSkipped) {
        console.log('🎉 SUCCESS: PDF was skipped as expected!');
      } else if (response3.data.status === 'ok') {
        console.log('✅ SUCCESS: Medium payload processed normally!');
      }
    } catch (error) {
      console.log('❌ Medium payload test failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

testBothEndpoints().then(() => {
  console.log('\n🏁 Test suite completed');
}).catch(error => {
  console.error('💥 Test suite crashed:', error);
});