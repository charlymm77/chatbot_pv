#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CERTS_DIR = './certs';

// Create certs directory if it doesn't exist
if (!existsSync(CERTS_DIR)) {
  mkdirSync(CERTS_DIR, { recursive: true });
  console.log('📁 Created certs directory');
}

try {
  console.log('🔐 Generating self-signed SSL certificates...');
  
  // Generate private key
  execSync(`openssl genrsa -out ${CERTS_DIR}/private-key.pem 2048`, { stdio: 'inherit' });
  
  // Generate certificate signing request
  execSync(`openssl req -new -key ${CERTS_DIR}/private-key.pem -out ${CERTS_DIR}/csr.pem -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`, { stdio: 'inherit' });
  
  // Generate self-signed certificate
  execSync(`openssl x509 -req -in ${CERTS_DIR}/csr.pem -signkey ${CERTS_DIR}/private-key.pem -out ${CERTS_DIR}/certificate.pem -days 365`, { stdio: 'inherit' });
  
  // Clean up CSR file
  execSync(`rm ${CERTS_DIR}/csr.pem`);
  
  console.log('✅ SSL certificates generated successfully!');
  console.log('📄 Files created:');
  console.log(`   - ${CERTS_DIR}/private-key.pem`);
  console.log(`   - ${CERTS_DIR}/certificate.pem`);
  console.log('');
  console.log('⚠️  Note: These are self-signed certificates for development only.');
  console.log('   For production, use certificates from a trusted CA.');
  console.log('');
  console.log('🚀 To enable HTTPS, set SSL_ENABLED=true in your .env file');
  
} catch (error) {
  console.error('❌ Error generating certificates:', error.message);
  console.log('');
  console.log('Make sure OpenSSL is installed on your system:');
  console.log('- macOS: brew install openssl');
  console.log('- Ubuntu/Debian: sudo apt-get install openssl');
  console.log('- Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
}