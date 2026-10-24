CREATE TABLE a7_result_assets (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,version_id uuid NOT NULL REFERENCES a7_job_versions(id),run_id text NOT NULL,output_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('scene')),drive_file_id text NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),px text,file_name text,reviewed boolean NOT NULL,approved_at timestamptz,recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(version_id,output_id,sha256)
);
CREATE INDEX a7_result_assets_version ON a7_result_assets(owner_id,version_id);
