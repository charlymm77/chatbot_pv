import axios from 'axios';
import fs from 'fs';
import path from 'path';

const SERVER_URL = 'http://localhost:4009'; // Cambia por tu URL si es diferente

async function testWithRealPDF() {
  console.log('🧪 Probando con PDF real...\n');

  try {
    // Crear un PDF pequeño de prueba usando texto
    const testPdfContent = `%PDF-1.4
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
(Test PDF Content) Tj
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
299
%%EOF`;

    // Guardar el PDF de prueba
    const testPdfPath = path.join(process.cwd(), 'test-sample.pdf');
    fs.writeFileSync(testPdfPath, testPdfContent);
    
    // Leer el archivo y convertirlo a base64
    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    console.log(`📄 Tamaño del PDF original: ${pdfBuffer.length} bytes (${Math.round(pdfBuffer.length / 1024)}KB)`);
    console.log(`📄 Tamaño del PDF en base64: ${pdfBase64.length} bytes (${Math.round(pdfBase64.length / 1024)}KB)`);

    // Probar con el endpoint de test
    console.log('\n📝 Probando con endpoint de test...');
    try {
      const testPayload = {
        number: '1234567890',
        message: 'Probando con PDF real',
        pdf: pdfBase64,
        customerName: 'Cliente Test'
      };

      const testResponse = await axios.post(`${SERVER_URL}/v1/test-payload`, testPayload);
      console.log('✅ Test endpoint resultado:', testResponse.data);
    } catch (error) {
      console.log('❌ Test endpoint error:', error.response?.data || error.message);
    }

    // Probar con el endpoint real de mensajes (comentado para evitar envío real)
    console.log('\n📝 Probando con endpoint de mensajes (simulado)...');
    console.log('ℹ️  Para probar el endpoint real, descomenta las líneas en el script');
    
    /*
    try {
      const messagePayload = {
        number: '1234567890', // Cambia por un número real para pruebas
        message: 'Probando envío de PDF',
        pdf: pdfBase64,
        customerName: 'Cliente Test'
      };

      const messageResponse = await axios.post(`${SERVER_URL}/v1/messages`, messagePayload);
      console.log('✅ Messages endpoint resultado:', messageResponse.data);
    } catch (error) {
      console.log('❌ Messages endpoint error:', error.response?.data || error.message);
    }
    */

    // Limpiar archivo de prueba
    fs.unlinkSync(testPdfPath);
    console.log('\n🧹 Archivo de prueba eliminado');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }

  console.log('\n🏁 Prueba completada');
}

// Ejecutar la prueba
testWithRealPDF().catch(console.error);