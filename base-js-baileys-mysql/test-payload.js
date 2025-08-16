#!/usr/bin/env node

// Test script to verify payload handling
import axios from 'axios';

const SERVER_URL = 'http://localhost:4009';

// Create a large dummy PDF (base64 encoded)
function createLargePDF(sizeMB) {
  // PDF header
  const pdfHeader = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length ';
  
  // Calculate how much padding we need
  const targetBytes = sizeMB * 1024 * 1024;
  const headerBytes = Buffer.from(pdfHeader, 'utf8').length;
  const footerBytes = 100; // Approximate footer size
  const paddingNeeded = Math.max(0, targetBytes - headerBytes - footerBytes);
  
  // Create padding
  const padding = 'A'.repeat(paddingNeeded);
  
  // PDF footer
  const pdfFooter = '\n>>\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000207 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n' + (headerBytes + padding.length + 20) + '\n%%EOF';
  
  const fullPDF = pdfHeader + padding.length + '\n>>\nstream\n' + padding + '\nendstream\nendobj' + pdfFooter;
  
  return Buffer.from(fullPDF, 'utf8').toString('base64');
}

async function testPayload(sizeMB, description) {
  console.log(`\n🧪 Testing ${description} (${sizeMB}MB)...`);
  
  try {
    const largePDF = createLargePDF(sizeMB);
    const actualSizeMB = (Buffer.from(largePDF, 'base64').length / 1024 / 1024).toFixed(2);
    console.log(`📄 Generated PDF size: ${actualSizeMB}MB`);
    
    const payload = {
      number: '1234567890',
      message: `Test message with ${description}`,
      pdf: largePDF,
      xml: '<xml><test>Sample XML content</test></xml>',
      customerName: 'Test Customer'
    };
    
    const response = await axios.post(`${SERVER_URL}/v1/messages`, payload, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Response:`, response.data);
    
    if (response.data.pdfSkipped) {
      console.log(`⚠️  PDF was skipped as expected`);
    } else {
      console.log(`📄 PDF was processed normally`);
    }
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Server responded with error:`, error.response.data);
    } else {
      console.log(`❌ Request failed:`, error.message);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting payload tests...');
  
  // Test with small payload (should work normally)
  await testPayload(50, 'small PDF');
  
  // Test with medium payload (should work normally)
  await testPayload(150, 'medium PDF');
  
  // Test with large payload (should skip PDF)
  await testPayload(250, 'large PDF');
  
  // Test with very large payload (should skip PDF)
  await testPayload(350, 'very large PDF');
  
  console.log('\n✅ All tests completed!');
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testPayload, createLargePDF };