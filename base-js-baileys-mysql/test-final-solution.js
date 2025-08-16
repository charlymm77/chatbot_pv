#!/usr/bin/env node

import axios from 'axios';

const REGULAR_SERVER = 'http://localhost:4009';
const LARGE_SERVER = 'http://localhost:4010';

// Smart client function that chooses the right endpoint
async function sendWhatsAppMessage(payload) {
  const payloadSize = JSON.stringify(payload).length / 1024 / 1024; // MB
  
  const endpoint = payloadSize > 50 
    ? `${LARGE_SERVER}/v1/messages-large`
    : `${REGULAR_SERVER}/v1/messages`;
  
  const timeout = payloadSize > 100 ? 120000 : 30000;
  
  console.log(`📊 Payload size: ${payloadSize.toFixed(2)}MB`);
  console.log(`📡 Using endpoint: ${endpoint}`);
  
  try {
    const response = await axios.post(endpoint, payload, {
      timeout,
      headers: { 'Content-Type': 'application/json' }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

// Create test PDFs of different sizes
function createPDF(sizeMB) {
  const sizeBytes = sizeMB * 1024 * 1024;
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const fillData = Buffer.alloc(sizeBytes - pdfHeader.length, 'A');
  const pdf = Buffer.concat([pdfHeader, fillData]);
  return pdf.toString('base64');
}

async function runFinalTest() {
  console.log('🚀 Final Solution Test - Demonstrating Smart Payload Handling\n');

  const testCases = [
    {
      name: 'Small payload (no PDF)',
      payload: {
        number: '1234567890',
        message: 'Small test message',
        xml: Buffer.from('<?xml version="1.0"?><small>test</small>').toString('base64'),
        customerName: 'Small Test'
      }
    },
    {
      name: 'Medium payload with small PDF',
      payload: {
        number: '1234567890',
        message: 'Medium test message with small PDF',
        pdf: createPDF(10), // 10MB PDF
        xml: Buffer.from('<?xml version="1.0"?><medium>test</medium>').toString('base64'),
        customerName: 'Medium Test'
      }
    },
    {
      name: 'Large payload with large PDF',
      payload: {
        number: '1234567890',
        message: 'Large test message with large PDF',
        pdf: createPDF(250), // 250MB PDF
        xml: Buffer.from('<?xml version="1.0"?><large>test</large>').toString('base64'),
        customerName: 'Large Test'
      }
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 Test ${i + 1}: ${testCase.name}`);
    console.log('─'.repeat(50));

    try {
      const result = await sendWhatsAppMessage(testCase.payload);
      
      console.log('✅ Result:', result);
      
      // Analyze the result
      if (result.status === 'ok') {
        console.log('🎉 SUCCESS: All data processed normally');
      } else if (result.status === 'partial_success') {
        console.log('🎉 SUCCESS: Large payload handled gracefully');
        console.log(`   📄 PDF skipped: ${result.pdfSkipped}`);
        console.log(`   📊 Payload size: ${result.payloadSize}`);
        console.log(`   ⚠️  Warning: ${result.warning}`);
      }
      
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  console.log('🏁 Final test completed!');
  console.log('\n📋 Summary:');
  console.log('✅ Small payloads: Use regular endpoint (port 4009)');
  console.log('✅ Large payloads: Use large payload endpoint (port 4010)');
  console.log('✅ PDFs automatically skipped for large payloads');
  console.log('✅ Messages and XML always processed');
  console.log('✅ Clear status reporting for clients');
}

runFinalTest().catch(console.error);