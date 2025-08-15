import axios from 'axios';

// Test PDF en base64 (PDF simple con metadata y anotaciones)
const testPDF = 'JVBERi0xLjcKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKL01ldGFkYXRhIDMgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbNCAwIFIgNSAwIFJdCi9Db3VudCAyCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNiAwIFIKPj4KPj4KL0NvbnRlbnRzIDcgMCBSCi9Bbm5vdHMgWzggMCBSXQo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDYgMCBSCj4+Cj4+Ci9Db250ZW50cyA5IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0xlbmd0aCA4MAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFRoaXMgaXMgYSB0ZXN0IFBERiB3aXRoIG1ldGFkYXRhIGFuZCBhbm5vdGF0aW9ucykgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9UeXBlIC9Bbm5vdAovU3VidHlwZSAvVGV4dAovUmVjdCBbMTAwIDYwMCAyMDAgNjUwXQovQ29udGVudHMgKFRlc3QgQW5ub3RhdGlvbikKPj4KZW5kb2JqCjkgMCBvYmoKPDwKL0xlbmd0aCA2MAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKFNlY29uZCBwYWdlIHdpdGggbW9yZSBjb250ZW50KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL01ldGFkYXRhCi9TdWJ0eXBlIC9YTUwKL0xlbmd0aCAyMDAKPj4Kc3RyZWFtCjw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04Ij8+CjxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiPgo8ZGM6dGl0bGU+VGVzdCBQREY8L2RjOnRpdGxlPgo8L3JkZjpEZXNjcmlwdGlvbj4KPC9yZGY6UkRGPgplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTMxIDAwMDAwIG4gCjAwMDAwMDAzODcgMDAwMDAgbiAKMDAwMDAwMDU0MyAwMDAwMCBuIAowMDAwMDAwNjc5IDAwMDAwIG4gCjAwMDAwMDA3NTYgMDAwMDAgbiAKMDAwMDAwMDg4NiAwMDAwMCBuIAowMDAwMDAwOTg2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgMTAKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjEwOTYKJSVFT0Y=';

async function testCompressionEndpoint() {
  console.log('🧪 Testing PDF Compression Endpoint...\n');
  
  try {
    const response = await axios.post('http://localhost:4009/v1/test-compression', {
      pdf: testPDF
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    console.log('✅ Endpoint Response:');
    console.log('Status:', response.data.status);
    console.log('Message:', response.data.message);
    console.log('\n📊 PDF Analysis:');
    console.log(JSON.stringify(response.data.analysis, null, 2));
    console.log('\n🔄 Compression Results:');
    console.log(JSON.stringify(response.data.compression, null, 2));
    console.log('\n🎯 Test completed successfully!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running. Please start the server first with:');
      console.log('   npm start');
    } else {
      console.error('❌ Test failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }
}

testCompressionEndpoint();