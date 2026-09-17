# BLOCKER: AWS S3 activation — operator actions required

The backend is now S3-ready (reads, writes, deletes, presigned URLs).
To activate object storage, add these to your `.env` (local) / server
`.env` (production), then recreate the backend:

```
S3_BUCKET=ikhwezi-media                # your bucket name
S3_REGION=af-south-1                   # closest region (Cape Town) or us-east-1
S3_ACCESS_KEY_ID=AKIA...               # IAM user key (programmatic access only)
S3_SECRET_ACCESS_KEY=...               # IAM secret
# OPTIONAL but recommended (CDN/bucket public base for long-lived URLs):
STORAGE_PUBLIC_URL=https://ikhwezi-media.s3.af-south-1.amazonaws.com
# (if unset, reads use 1-hour presigned URLs — works with fully private buckets)
```

## 1. Create the bucket (AWS Console or CLI)

```
aws s3api create-bucket --bucket ikhwezi-media --region af-south-1 \
  --create-bucket-configuration LocationConstraint=af-south-1
aws s3api put-public-block --bucket ikhwezi-media --public-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

(Keep the bucket fully private if you did not set STORAGE_PUBLIC_URL —
reads then use presigned URLs.)

## 2. Create an IAM user with least-privilege access

Policy limited to the single bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::ikhwezi-media/uploads/*"
    }
  ]
}
```

Create an access key for this user (Console: IAM → Users → Security
credentials → Create access key; choose "Application running outside AWS").

## 3. Verify

Restart the stack (`docker compose up -d backend` after env change),
then check the health posture:

```
curl http://localhost:3002/api/health
# → "media": { "storageType": "s3", "objectStorage": true, ... }
```

Upload a video in the app; the S3 copy is made in the background
(local file stays canonical). Requests to /storage/uploads/<file>
will 302 to the bucket/presigned URL when the S3 copy exists.

## Cost control

- Versioning OFF for the uploads prefix (uploads are replaceable media,
  not data of record — the DB + backups own durability).
- Consider a lifecycle rule to transition uploads/* to
  Intelligent-Tiering or delete after N days per product needs.
- The bucket is region-priced; af-south-1 costs slightly more than
  us-east-1 — pick based on user latency (SA users → af-south-1).
