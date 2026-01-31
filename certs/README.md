# SSL Certificates for Development

This directory contains self-signed SSL certificates for HTTPS development.

## Files

- `localhost-cert.pem` - Self-signed SSL certificate
- `localhost-key.pem` - Private key for the certificate

## Certificate Details

- **Subject:** CN=localhost
- **SAN:** localhost, \*.localhost, 127.0.0.1, ::1
- **Valid for:** 365 days
- **Key size:** 4096 bits RSA

## Usage

These certificates are for **development only**. They are self-signed and will
trigger browser security warnings. For production, use certificates from a
trusted Certificate Authority (CA).

### Trusting the Certificate (macOS)

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/localhost-cert.pem
```

### Trusting the Certificate (Linux)

```bash
# Copy certificate to system trust store
sudo cp certs/localhost-cert.pem /usr/local/share/ca-certificates/localhost.crt
sudo update-ca-certificates
```

### Trusting the Certificate (Windows)

1. Double-click `localhost-cert.pem`
2. Click "Install Certificate"
3. Select "Current User" or "Local Machine"
4. Select "Place all certificates in the following store"
5. Click "Browse" and select "Trusted Root Certification Authorities"
6. Click "Next" and "Finish"

## Regenerating Certificates

If certificates expire or need to be regenerated:

```bash
openssl req -x509 -newkey rsa:4096 -keyout certs/localhost-key.pem -out certs/localhost-cert.pem -days 365 -nodes -subj "/C=AU/ST=NSW/L=Sydney/O=MRE Development/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:::1"
```

## Security Note

**DO NOT** commit private keys to version control. The `.gitignore` file should
exclude `*.pem` files. These certificates are for local development only.
