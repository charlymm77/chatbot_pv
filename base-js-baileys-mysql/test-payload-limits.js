import axios from 'axios';
import fs from 'fs';

const SERVER_URL = 'http://localhost:4009'; // Cambia por tu URL si es diferente

async function testPayloadLimits() {
  console.log('🧪 Iniciando pruebas de límites de payload...\n');

  // Test 1: Payload pequeño (debería funcionar)
  console.log('📝 Test 1: Payload pequeño (1KB)');
  try {
    const smallPayload = {
      number: '1234567890',
      message: 'Test message',
      data: 'x'.repeat(1000) // 1KB de datos
    };

    const response1 = await axios.post(`${SERVER_URL}/v1/test-payload`, smallPayload);
    console.log('✅ Resultado:', response1.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Payload mediano (debería funcionar)
  console.log('📝 Test 2: Payload mediano (1MB)');
  try {
    const mediumPayload = {
      number: '1234567890',
      message: 'Test message with large data',
      data: 'x'.repeat(1024 * 1024) // 1MB de datos
    };

    const response2 = await axios.post(`${SERVER_URL}/v1/test-payload`, mediumPayload);
    console.log('✅ Resultado:', response2.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Simular PDF base64 de 96KB
  console.log('📝 Test 3: Simulando PDF de 96KB en base64');
  try {
    // Un PDF de 96KB en base64 sería aproximadamente 128KB
    const pdfBase64Size = Math.ceil(96 * 1024 * 4/3); // Tamaño aproximado en base64
    const simulatedPdf = 'x'.repeat(pdfBase64Size);
    
    const pdfPayload = {
      number: '1234567890',
      message: 'Enviando PDF simulado',
      pdf: simulatedPdf,
      customerName: 'Cliente Test'
    };

    console.log(`📄 Tamaño del PDF simulado: ${Math.round(pdfBase64Size / 1024)}KB`);
    
    const response3 = await axios.post(`${SERVER_URL}/v1/test-payload`, pdfPayload);
    console.log('✅ Resultado:', response3.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Payload muy grande (debería fallar)
  console.log('📝 Test 4: Payload muy grande (110MB - debería fallar)');
  try {
    const largePayload = {
      number: '1234567890',
      message: 'Test message with very large data',
      data: 'x'.repeat(110 * 1024 * 1024) // 110MB de datos
    };

    const response4 = await axios.post(`${SERVER_URL}/v1/test-payload`, largePayload);
    console.log('✅ Resultado:', response4.data);
  } catch (error) {
    console.log('❌ Error (esperado):', error.response?.data || error.message);
  }

  console.log('\n🏁 Pruebas completadas');
}

// Ejecutar las pruebas
testPayloadLimits().catch(console.error);