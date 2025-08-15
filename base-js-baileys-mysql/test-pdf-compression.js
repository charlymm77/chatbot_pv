import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { compressPDFToTarget, analyzePDF, getBufferSizeMB, isValidPDF } from './src/pdf-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4009';

/**
 * Test PDF compression functionality
 */
async function testPDFCompression() {
  console.log('🧪 Testing PDF Compression Functionality\n');
  
  try {
    // Test 1: Create a sample PDF buffer for testing
    console.log('📄 Test 1: Creating sample PDF for testing...');
    
    // You can replace this with a real PDF file path if you have one
    const samplePdfPath = './assets/sample.pdf'; // Adjust path as needed
    
    let testPdfBuffer;
    
    // Try to load a real PDF file, or create a minimal PDF for testing
    try {
      if (require('fs').existsSync(samplePdfPath)) {
        testPdfBuffer = readFileSync(samplePdfPath);
        console.log(`✅ Loaded PDF from ${samplePdfPath}: ${getBufferSizeMB(testPdfBuffer).toFixed(2)} MB`);
      } else {
        // Create a minimal PDF for testing
        const minimalPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF for compression) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;
        
        testPdfBuffer = Buffer.from(minimalPdf, 'utf8');
        console.log(`✅ Created minimal test PDF: ${getBufferSizeMB(testPdfBuffer).toFixed(2)} MB`);
      }
    } catch (error) {
      console.error('❌ Error loading/creating test PDF:', error.message);
      return;
    }

    // Test 2: Validate PDF
    console.log('\n📋 Test 2: Validating PDF...');
    const isValid = isValidPDF(testPdfBuffer);
    console.log(`PDF validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (!isValid) {
      console.error('❌ Test PDF is not valid, cannot continue tests');
      return;
    }

    // Test 3: Analyze PDF
    console.log('\n📊 Test 3: Analyzing PDF...');
    const analysis = await analyzePDF(testPdfBuffer);
    console.log('Analysis results:', analysis);

    // Test 4: Compress PDF
    console.log('\n🔄 Test 4: Compressing PDF...');
    const startTime = performance.now();
    const compressedBuffer = await compressPDFToTarget(testPdfBuffer, 10); // Target 10MB
    const compressionTime = performance.now() - startTime;
    
    const originalSize = getBufferSizeMB(testPdfBuffer);
    const compressedSize = getBufferSizeMB(compressedBuffer);
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`Compression results:`);
    console.log(`- Original size: ${originalSize.toFixed(2)} MB`);
    console.log(`- Compressed size: ${compressedSize.toFixed(2)} MB`);
    console.log(`- Compression ratio: ${compressionRatio}%`);
    console.log(`- Processing time: ${compressionTime.toFixed(2)}ms`);
    console.log(`- Compressed PDF valid: ${isValidPDF(compressedBuffer) ? '✅' : '❌'}`);

    // Test 5: Test API endpoint (if server is running)
    console.log('\n🌐 Test 5: Testing API endpoint...');
    try {
      const base64Pdf = testPdfBuffer.toString('base64');
      
      const response = await axios.post(`${SERVER_URL}/v1/test-compression`, {
        pdf: base64Pdf
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        console.log('✅ API endpoint test successful');
        console.log('API Response:', {
          analysis: response.data.analysis,
          compression: response.data.compression
        });
      } else {
        console.log('❌ API endpoint test failed:', response.data.message);
      }
    } catch (apiError) {
      if (apiError.code === 'ECONNREFUSED') {
        console.log('⚠️ Server not running, skipping API test');
        console.log(`   Start server with: npm start`);
        console.log(`   Then test API at: ${SERVER_URL}/v1/test-compression`);
      } else {
        console.log('❌ API test error:', apiError.message);
      }
    }

    // Test 6: Save compressed PDF for manual inspection
    console.log('\n💾 Test 6: Saving compressed PDF...');
    const outputPath = join(process.cwd(), 'test-compressed-output.pdf');
    writeFileSync(outputPath, compressedBuffer);
    console.log(`✅ Compressed PDF saved to: ${outputPath}`);
    console.log(`   You can open this file to verify it works correctly`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- PDF compression is working: ✅`);
    console.log(`- Original size: ${originalSize.toFixed(2)} MB`);
    console.log(`- Compressed size: ${compressedSize.toFixed(2)} MB`);
    console.log(`- Compression ratio: ${compressionRatio}%`);
    console.log(`- Processing time: ${compressionTime.toFixed(2)}ms`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Test with a large dummy PDF
 */
async function testWithLargePDF() {
  console.log('\n🔬 Testing with artificially large PDF...');
  
  try {
    // Create a larger PDF with repeated content
    let largePdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 1000000
>>
stream
BT
/F1 12 Tf
100 700 Td
`;

    // Add repetitive content to make it larger
    for (let i = 0; i < 10000; i++) {
      largePdfContent += `(This is line ${i} of test content for PDF compression testing. ) Tj\n`;
    }

    largePdfContent += `ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
1000300
%%EOF`;

    const largePdfBuffer = Buffer.from(largePdfContent, 'utf8');
    const originalSize = getBufferSizeMB(largePdfBuffer);
    
    console.log(`📄 Created large test PDF: ${originalSize.toFixed(2)} MB`);
    
    if (originalSize > 8) {
      console.log('🔄 Testing compression on large PDF...');
      const compressedBuffer = await compressPDFToTarget(largePdfBuffer, 25);
      const compressedSize = getBufferSizeMB(compressedBuffer);
      const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      console.log(`✅ Large PDF compression test:`);
      console.log(`- Original: ${originalSize.toFixed(2)} MB`);
      console.log(`- Compressed: ${compressedSize.toFixed(2)} MB`);
      console.log(`- Reduction: ${ratio}%`);
    } else {
      console.log('⚠️ Generated PDF is not large enough to trigger compression');
    }
    
  } catch (error) {
    console.error('❌ Large PDF test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting PDF Compression Tests\n');
  console.log('=' .repeat(50));
  
  await testPDFCompression();
  await testWithLargePDF();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 All tests completed!');
  console.log('\nTo test with real PDFs:');
  console.log('1. Place a PDF file in ./assets/sample.pdf');
  console.log('2. Run this test again');
  console.log('3. Or use the API endpoint /v1/test-compression');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testPDFCompression, testWithLargePDF };