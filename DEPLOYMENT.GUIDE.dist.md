# iKHWEZI Deployment Guide

## Overview

This guide covers deploying iKHWEZI to production environments including AWS Lightsail, Docker, and web hosting platforms.

## Table of Contents

1. [Quick Start](#quick-start)
2. [AWS Lightsail Deployment](#aws-lightsail-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Web Hosting Deployment](#web-hosting-deployment)
5. [Configuration](#configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Docker & Docker Compose (or AWS Lightsail account)
- Git
- Domain name (optional but recommended)
- 2GB RAM minimum, 20GB storage

### Clone Repository

```bash
git clone https://github.com/yourusername/iKhwezi-Livestream-App.git
cd iKhwezi-Livestream-App
```

### Setup Environment

```bash
cp .env.dist .env
# Edit .env with your configuration
nano .env
```

### Launch Application

```bash
docker-compose -f docker-compose.dist.yml up -d
```

Access at: `http://localhost:8080`

---

## AWS Lightsail Deployment

### Using CloudFormation (Recommended)

1. **Go to AWS CloudFormation Console**
   - Click "Create Stack"
   - Choose "Upload a template file"
   - Upload `cloudformation-template.dist.json`

2. **Configure Stack Parameters**
   - Instance Type: `medium` (recommended for production)
   - Availability Zone: Choose nearest to you
   - Domain Name: Your domain
   - Enable Backups: `true`

3. **Review and Create**
   - Click "Create Stack"
   - Wait for stack creation to complete (5-10 minutes)

4. **Post-Deployment**
   - Get the instance Public IP from stack outputs
   - Point your domain DNS to the IP
   - SSH into instance to verify deployment

### Manual Deployment to Lightsail

1. **Create Lightsail Instance**
   - Go to AWS Lightsail Console
   - Create Instance (Ubuntu 20.04)
   - Choose instance plan (medium recommended)
   - Attach static IP address

2. **SSH into Instance**
   ```bash
   ssh -i path/to/key.pem ubuntu@your-instance-ip
   ```

3. **Run Deployment Script**
   ```bash
   curl -O https://raw.githubusercontent.com/yourusername/iKhwezi-Livestream-App/master/deploy.sh.dist
   chmod +x deploy.sh.dist
   
   # Configure environment
   export DOMAIN=your-domain.com
   export AWS_REGION=us-east-1
   
   ./deploy.sh.dist
   ```

4. **Configure Domain**
   - Point DNS A record to instance IP
   - Wait for DNS propagation (5-30 minutes)

---

## Docker Deployment

### Local Docker

```bash
# Build images
docker-compose -f docker-compose.dist.yml build

# Start services
docker-compose -f docker-compose.dist.yml up -d

# View logs
docker-compose -f docker-compose.dist.yml logs -f

# Stop services
docker-compose -f docker-compose.dist.yml down
```

### Docker Registry Deployment

1. **Push to Registry**
   ```bash
   # Build and tag
   docker build -t your-registry/ikhwezi-frontend:v1.0 frontend/
   docker build -t your-registry/ikhwezi-backend:v1.0 backend/
   
   # Push
   docker push your-registry/ikhwezi-frontend:v1.0
   docker push your-registry/ikhwezi-backend:v1.0
   ```

2. **Update Compose File**
   ```yaml
   frontend:
     image: your-registry/ikhwezi-frontend:v1.0
   backend:
     image: your-registry/ikhwezi-backend:v1.0
   ```

---

## Web Hosting Deployment

### Shared Hosting (cPanel/Plesk)

1. **Install Docker (if available)**
   - Contact hosting provider for Docker support
   - Or use pre-built images from registry

2. **Upload Files**
   - Upload source code via SFTP
   - Configure environment variables

3. **Build & Deploy**
   - Follow Docker deployment steps
   - Configure reverse proxy to forward traffic

### VPS Deployment

```bash
# SSH into VPS
ssh root@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone and deploy
git clone https://github.com/yourusername/iKhwezi-Livestream-App.git
cd iKhwezi-Livestream-App
cp .env.dist .env
nano .env
docker-compose -f docker-compose.dist.yml up -d
```

---

## Configuration

### Environment Variables (.env)

Key variables to configure:

```bash
# Application
NODE_ENV=production
JWT_SECRET=your-secret-key-here
ADMIN_KEY=your-admin-key-here
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com:8080

# Database
DB_TYPE=sqlite
DB_PATH=/app/storage/ikhwezi.db

# Streaming
RTMP_SERVER=rtmp://your-domain.com:1935/live
HLS_URL=https://your-domain.com:8081/hls

# AWS (Optional)
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret
```

### Secrets Management

**Using Environment File:**
```bash
# Store in secure config management
# - AWS Secrets Manager
# - HashiCorp Vault
# - 1Password

# Load into deployment
export $(cat .env | xargs)
docker-compose up
```

---

## SSL/TLS Setup

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update && apt-get install -y certbot

# Generate Certificate
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com

# Certificates stored at:
# /etc/letsencrypt/live/your-domain.com/
```

### Using AWS Certificate Manager

1. Go to AWS Certificate Manager
2. Request public certificate
3. Verify domain
4. Attach to Load Balancer

### Configure Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }

    location /hls {
        proxy_pass http://localhost:8081;
        proxy_buffering off;
        add_header Cache-Control no-cache;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Monitoring & Maintenance

### Health Check

```bash
# Check all containers
docker-compose -f docker-compose.dist.yml ps

# View logs
docker-compose -f docker-compose.dist.yml logs backend
docker-compose -f docker-compose.dist.yml logs frontend

# Check endpoint
curl http://localhost:3001/api/health
```

### Performance Monitoring

```bash
# Docker stats
docker stats --no-stream

# CPU/Memory usage
docker top ikhwezi-backend-prod
docker top ikhwezi-frontend-prod
```

### Log Aggregation

```bash
# Collect logs
docker-compose -f docker-compose.dist.yml logs --tail=1000 > logs-backup.txt

# Send to external logging service (e.g., Datadog, ELK)
```

---

## Backup & Recovery

### Database Backup

```bash
# Manual backup
docker exec ikhwezi-backend-prod \
  cp /app/storage/ikhwezi.db /app/storage/ikhwezi.db.backup

# Backup to host
docker cp ikhwezi-backend-prod:/app/storage/ikhwezi.db ./backups/ikhwezi.db

# To AWS S3
aws s3 cp ./backups/ikhwezi.db s3://your-backup-bucket/
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v backend-storage-prod:/data \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/backend-storage.tar.gz -C /data .
```

### Restore from Backup

```bash
# Restore database
docker cp ./backups/ikhwezi.db ikhwezi-backend-prod:/app/storage/

# Restart service
docker-compose -f docker-compose.dist.yml restart backend
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.dist.yml logs backend

# Common issues:
# - Port already in use: Change port in .env
# - Database corruption: Replace database file
# - Memory issues: Increase Docker memory limit
```

### High Memory Usage

```bash
# Limit service memory
# Edit docker-compose.dist.yml memory limits

# Restart
docker-compose -f docker-compose.dist.yml restart
```

### Connection Issues

```bash
# Check port exposure
netstat -tlnp | grep LISTEN

# Verify firewall
sudo ufw status

# Allow ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1935/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
```

### DNS Not Resolving

```bash
# Test resolution
nslookup your-domain.com
dig your-domain.com

# Wait for propagation (up to 48 hours)
# Verify DNS records point to correct IP
```

---

## Support & Documentation

- **GitHub Issues**: https://github.com/yourusername/iKhwezi-Livestream-App/issues
- **Documentation**: README.md in repository
- **Community**: GitHub Discussions

## License

iKHWEZI © 2026. All rights reserved.
