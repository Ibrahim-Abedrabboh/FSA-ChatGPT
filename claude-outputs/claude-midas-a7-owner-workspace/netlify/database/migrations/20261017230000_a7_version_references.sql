CREATE TABLE a7_version_references (
 version_id uuid NOT NULL REFERENCES a7_job_versions(id),role text NOT NULL CHECK(role IN ('product','room')),blob_key text NOT NULL,sha256 text NOT NULL,mime text NOT NULL,bytes integer NOT NULL CHECK(bytes>0),PRIMARY KEY(version_id,role)
);
ALTER TABLE a7_job_versions ADD COLUMN run_id text;
ALTER TABLE a7_job_versions ADD COLUMN direction text NOT NULL DEFAULT '';
