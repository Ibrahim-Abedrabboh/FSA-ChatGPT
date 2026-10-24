-- Edit phase 2.5: when a version's dispatch state last changed, so a send without a recorded receipt is checked
-- against A7 only after it can no longer be in flight. Additive; existing rows keep NULL and fall back to created_at.
ALTER TABLE a7_job_versions ADD COLUMN dispatch_changed_at timestamptz;
