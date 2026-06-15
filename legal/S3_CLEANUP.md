S3 cleanup instructions — remove test media before publishing

Bucket: ikhwezi-s3-bucket-327448506785-eu-west-1-an

Important: these commands permanently delete objects. Review the listed objects before deleting.

1. List recent objects (preview):
   aws s3 ls s3://ikhwezi-s3-bucket-327448506785-eu-west-1-an --recursive | sort | tail -n 200

2. List objects with a test prefix (common patterns):
   aws s3api list-objects-v2 --bucket ikhwezi-s3-bucket-327448506785-eu-west-1-an --prefix "test/" --query 'Contents[].{Key:Key,Size:Size}' --output table

3. Dry-run delete with --dryrun (using aws s3 rm doesn't support dryrun; use aws s3api delete-objects with a generated manifest):
   # Generate JSON with keys to delete (example for prefix 'test/')
   aws s3api list-objects-v2 --bucket ikhwezi-s3-bucket-327448506785-eu-west-1-an --prefix "test/" --query 'Contents[].Key' --output text | \
     awk '{print "{\"Key\": \""$0"\"},"}' > del-keys.txt
   # Convert to proper JSON array and wrap with {"Objects":[ ... ]}

4. Safe bulk delete (recommended):
   # Create a file keys.txt listing object keys, one per line
   aws s3 rm s3://ikhwezi-s3-bucket-327448506785-eu-west-1-an --recursive --exclude "*" --include "test/*"

5. Delete by pattern (careful):
   # Delete all .mp4 under 'uploads/tests/'
   aws s3 rm s3://ikhwezi-s3-bucket-327448506785-eu-west-1-an --recursive --exclude "*" --include "uploads/tests/*.mp4"

6. Confirm deletion:
   aws s3 ls s3://ikhwezi-s3-bucket-327448506785-eu-west-1-an --recursive | grep -E "test/|uploads/tests/" || echo "No matching objects found"

7. Database cleanup (RDS Postgres example):
   -- Connect to Postgres and run (adjust table/column names):
   DELETE FROM media WHERE is_test = true;
   DELETE FROM uploads WHERE filename LIKE '%test%';

8. Notes
- Always backup before bulk deletes. Consider moving test media to an 'archive/' prefix instead of permanent deletion.
- Run these commands on your machine with AWS CLI configured for the correct profile/region (export AWS_PROFILE and AWS_DEFAULT_REGION=eu-west-1).
