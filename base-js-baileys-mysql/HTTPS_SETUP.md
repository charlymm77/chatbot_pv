# HTTPS Configuration Guide

This guide explains how to configure your WhatsApp bot to run with HTTPS using SSL certificates.

## Quick Setup (Development)

### 1. Generate Self-Signed Certificates
```bash
npm run generate-certs
```

### 2. Create Environment File
```bash
cp .env.example .env
```

### 3. Enable HTTPS in .env
```env
SSL_ENABLED=true
SSL_KEY_PATH=./certs/private-key.pem
SSL_CERT_PATH=./certs/certificate.pem
```

### 4. Start the Server
```bash
npm start
```

Your server will now run on HTTPS at `https://localhost:4008`

## Production Setup

### 1. Obtain SSL Certificates
For production, you need certificates from a trusted Certificate Authority (CA):

- **Let's Encrypt** (Free): Use Certbot to get free SSL certificates
- **Commercial CA**: Purchase certificates from providers like DigiCert, Comodo, etc.

### 2. Configure Certificate Paths
Update your `.env` file with the paths to your production certificates:

```env
SSL_ENABLED=true
SSL_KEY_PATH=/path/to/your/private-key.pem
SSL_CERT_PATH=/path/to/your/certificate.pem
SSL_CA_PATH=/path/to/your/ca-bundle.pem  # Optional CA bundle
```

### 3. Certificate File Structure
Your certificate files should be:
- **Private Key**: `private-key.pem` - Keep this secure and never share it
- **Certificate**: `certificate.pem` - Your domain's SSL certificate
- **CA Bundle**: `ca-bundle.pem` - Intermediate certificates (optional)

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SSL_ENABLED` | Enable/disable HTTPS | `false` | No |
| `SSL_KEY_PATH` | Path to private key file | `./certs/private-key.pem` | Yes (if SSL enabled) |
| `SSL_CERT_PATH` | Path to certificate file | `./certs/certificate.pem` | Yes (if SSL enabled) |
| `SSL_CA_PATH` | Path to CA bundle file | `null` | No |

## Troubleshooting

### Certificate Not Found
```
Error loading SSL certificates: ENOENT: no such file or directory
```
**Solution**: Make sure certificate files exist at the specified paths.

### Permission Denied
```
Error loading SSL certificates: EACCES: permission denied
```
**Solution**: Check file permissions. Certificate files should be readable by the application.

### Invalid Certificate Format
```
Error: error:0909006C:PEM routines:get_name:no start line
```
**Solution**: Ensure certificate files are in PEM format and not corrupted.

### Self-Signed Certificate Warning
When using self-signed certificates, browsers will show security warnings. This is normal for development but should not be used in production.

## Security Best Practices

1. **Never commit certificates to version control**
2. **Use strong private keys** (2048-bit RSA minimum)
3. **Keep certificates updated** before expiration
4. **Use proper file permissions** (600 for private keys)
5. **Use trusted CAs for production**

## Let's Encrypt Setup (Linux/macOS)

```bash
# Install Certbot
sudo apt-get install certbot  # Ubuntu/Debian
brew install certbot          # macOS

# Get certificate for your domain
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

Update your `.env`:
```env
SSL_ENABLED=true
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

## Testing HTTPS

Test your HTTPS setup:
```bash
curl -k https://localhost:4008/v1/messages
```

The `-k` flag ignores certificate warnings for self-signed certificates.