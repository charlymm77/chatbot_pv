# PDF Compression Usage Guide

## Overview

The WhatsApp bot now includes automatic PDF compression to handle large PDF files efficiently. PDFs larger than 8MB are automatically compressed before sending, with a maximum limit of 45MB.

## How It Works

### Automatic Compression
When you send a PDF through the `/v1/messages` endpoint:

1. **Size Check**: PDFs larger than 8MB trigger automatic compression
2. **Analysis**: The system analyzes the PDF structure to determine the best compression strategy
3. **Multi-Stage Compression**: Up to 4 compression stages are applied as needed
4. **Validation**: The compressed PDF is validated to ensure it's still readable
5. **Fallback**: If compression fails, the original PDF is used (if under 45MB)

### Compression Strategies

- **Basic**: For PDFs < 10MB with simple content
- **Moderate**: For PDFs 10-25MB or with images/annotations  
- **Aggressive**: For PDFs 25-50MB with complex content
- **Ultra-Aggressive**: For PDFs > 50MB requiring maximum compression

## API Usage

### Send Message with PDF (Automatic Compression)

```bash
curl -X POST http://localhost:4009/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "number": "1234567890",
    "message": "Here is your invoice",
    "pdf": "base64_encoded_pdf_content",
    "customerName": "John Doe"
  }'
```

### Test PDF Compression

```bash
curl -X POST http://localhost:4009/v1/test-compression \
  -H "Content-Type: application/json" \
  -d '{
    "pdf": "base64_encoded_pdf_content"
  }'
```

**Response:**
```json
{
  "status": "success",
  "analysis": {
    "size": 15.23,
    "pages": 5,
    "hasImages": true,
    "hasAnnotations": false,
    "compressionStrategy": "aggressive"
  },
  "compression": {
    "originalSize": "15.23 MB",
    "compressedSize": "8.45 MB", 
    "compressionRatio": "44.5%",
    "processingTime": "1250.45ms",
    "isValid": true,
    "targetAchieved": true
  },
  "compressedPdf": "compressed_base64_content"
}
```

## Configuration

### Environment Variables

You can configure compression behavior in your `.env` file:

```env
# Maximum payload size (affects compression target)
MAX_PAYLOAD_SIZE_MB=100

# These are hardcoded but can be modified in src/app.js:
# COMPRESSION_THRESHOLD_MB=8    # Compress PDFs larger than this
# MAX_PDF_SIZE_MB=45           # Reject PDFs larger than this even after compression
```

### Code Configuration

In `src/app.js`, you can modify these values:

```javascript
const targetSizeMB = 25; // Target size after compression
const compressionThresholdMB = 8; // Start compressing at this size
const maxAllowedSizeMB = 45; // Maximum size even after compression
```

## Testing

### Run Compression Tests

```bash
# Test compression functionality
npm run test-compression

# Test with real PDF files
node test-pdf-compression.js

# Test API endpoints
npm run test-payload
```

### Manual Testing

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open browser to:** `http://localhost:4009`

3. **Test compression endpoint:**
   ```bash
   curl -X POST http://localhost:4009/v1/test-compression \
     -H "Content-Type: application/json" \
     -d '{"pdf":"'$(base64 -i your-file.pdf)'"}'
   ```

## Compression Results

### Typical Compression Ratios

- **Text-heavy PDFs**: 30-60% reduction
- **Image-heavy PDFs**: 10-40% reduction  
- **Mixed content**: 20-50% reduction
- **Already optimized PDFs**: 5-20% reduction

### Processing Times

- **Small PDFs** (< 10MB): Instant (no compression)
- **Medium PDFs** (10-25MB): 1-3 seconds
- **Large PDFs** (25-45MB): 3-10 seconds

## Error Handling

### Common Errors

1. **"PDF file is too large"**
   - The PDF exceeds 45MB even after compression
   - **Solution**: Pre-compress the PDF or split it into smaller files

2. **"Invalid PDF format"**
   - The input is not a valid PDF file
   - **Solution**: Ensure the file is a proper PDF and base64 encoded correctly

3. **"PDF compression failed"**
   - The compression process encountered an error
   - **Solution**: The system will fall back to the original file if possible

### Troubleshooting

1. **Check logs** for detailed compression information
2. **Use test endpoint** to verify compression works with your PDFs
3. **Validate PDF** files before sending
4. **Monitor file sizes** in the logs

## Monitoring

The system provides detailed logging:

```
📄 PDF original size: 15.23 MB
🔄 PDF size (15.23 MB) exceeds 8MB, compressing...
📊 PDF Analysis: 5 pages, strategy: aggressive
✅ PDF compression completed in 1250ms:
   - Original: 15.23 MB
   - Compressed: 8.45 MB
   - Reduction: 44.5%
💾 Final PDF size: 8.45 MB - Ready to send
```

## Best Practices

1. **Pre-optimize PDFs** when possible to reduce processing time
2. **Monitor compression ratios** to understand your typical file types
3. **Test with your actual PDFs** to verify compression effectiveness
4. **Set appropriate limits** based on your WhatsApp usage patterns
5. **Use the test endpoint** to verify compression before sending

## Limitations

- **Maximum file size**: 45MB (even after compression)
- **Processing time**: Large files may take several seconds to compress
- **Compression effectiveness**: Varies greatly depending on PDF content
- **Memory usage**: Large PDFs require significant memory during processing

## Support

If you encounter issues:

1. Check the server logs for detailed error information
2. Use the test endpoints to isolate problems
3. Verify your PDF files are valid and not corrupted
4. Monitor memory usage for very large files