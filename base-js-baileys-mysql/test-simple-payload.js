#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://localhost:4009';

// Create a large base64 string to simulate a large PDF
function createLargePDFBase64(sizeMB) {
  const sizeBytes = sizeMB * 1024 * 1024;
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const fillData = Buffer.alloc(sizeBytes - pdfHeader.length, 'A');
  const largePDF = Buffer.concat([pdfHeader, fillData]);
  return largePDF.toString('base64');
}

async function testLargePayload() {
  console.log('🧪 Testing large payload handling...\n');

  try {
    // Test with large PDF (250MB)
    console.log('📝 Creating 250MB PDF...');
    const largePDFBase64 = createLargePDFBase64(250);
    console.log(`📄 PDF created: ${Math.round(largePDFBase64.length / 1024 / 1024)}MB`);
    
    const payload = {
      number: '1234567890',
      message: 'Test message with large PDF',
      pdf: largePDFBase64,
      xml: Buffer.from('<?xml version="1.0"?><test>XML content</test>').toString('base64'),
      customerName: 'Test Customer'
    };

    console.log(`📊 Total payload size: ~${Math.round(JSON.stringify(payload).length / 1024 / 1024)}MB`);
    console.log('📤 Sending request...');

    // Use the large payload endpoint for payloads > 200MB
    const endpoint = Math.round(JSON.stringify(payload).length / 1024 / 1024) > 200 
      ? `http://localhost:4010/v1/messages-large`
      : `${SERVER_URL}/v1/messages`;
    
    console.log(`📡 Using endpoint: ${endpoint}`);
    
    const response = await axios.post(endpoint, payload, {
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Response received:', response.data);
    
    if (response.data.pdfSkipped) {
      console.log('🎉 SUCCESS: PDF was skipped as expected!');
    } else {
      console.log('⚠️ PDF was not skipped - might need adjustment');
    }

  } catch (error) {
    console.log('❌ Test failed:', error.response?.data || error.message);
  }
}

testLargePayload();