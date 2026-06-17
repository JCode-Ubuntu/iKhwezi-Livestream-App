Priority provisioning checklist — minimal steps to run iKhwezi in production

1. Provision server
   - Provider: DigitalOcean droplet (Ubuntu 22.04) or AWS EC2. Size: t3.small / 2 vCPU, 2GB RAM (increase for streaming).
   - Add domain DNS A record -> server IP.

2. Install Docker & Docker Compose
   - Commands (Ubuntu):
     sudo apt update && sudo apt install -y docker.io docker-compose
     sudo usermod -aG docker $USER

3. Postgres (managed or container)
   - Using docker-compose: postgres:15 with named volume. Set DATABASE_URL=postgres://ikhwezi:strongpass@db:5432/ikhwezi

4. Redis (socket scaling)
   - Add redis:6 container and set REDIS_URL=redis://redis:6379

5. Reverse proxy & TLS
   - Use nginx + Certbot or Cloudflare. Example: nginx reverse proxy to backend:3101 and serve frontend built assets.

6. Streaming (choose one)
   - Managed: AWS IVS (recommended for scale).
   - Self-hosted: Nginx-RTMP for ingest -> HLS, serve via CDN (CloudFront).

7. TURN (WebRTC metadata)
   - coturn on a small droplet; configure realm and credentials.

8. Storage/CDN
   - S3/Spaces for uploads; CloudFront/Spaces CDN for HLS.

9. CI/CD
   - GitHub Actions: build Docker images, push to registry, deploy to droplet or ECS.

10. Secrets & monitoring
   - Use environment variables or secrets manager. Add basic healthchecks and log shipping (Papertrail/CloudWatch).

Quick commands
- Build & run production docker-compose:
  docker-compose -f docker-compose.prod.yml up --build -d

Links
- Docker: https://docs.docker.com/engine/install/
- Postgres: https://www.postgresql.org/docs/
- Redis: https://redis.io/
- Nginx-RTMP: https://github.com/arut/nginx-rtmp-module
- AWS IVS: https://aws.amazon.com/ivs/

Notes
- This checklist focuses on minimal, reproducible infra for a medium-scale livestream app. Ask to expand any item with step-by-step commands and config templates.