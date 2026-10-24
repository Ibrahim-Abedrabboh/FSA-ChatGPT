CREATE TABLE a7_projects (
 id uuid PRIMARY KEY,owner_id uuid NOT NULL,title text NOT NULL,kind text NOT NULL CHECK(kind IN ('project','collection')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE a7_cases (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES a7_projects(id),owner_id uuid NOT NULL,title text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE a7_job_versions (
 id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES a7_cases(id),owner_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),parent_id uuid REFERENCES a7_job_versions(id),note text NOT NULL,brief jsonb NOT NULL,fingerprint text NOT NULL,client_run_id text UNIQUE,dispatch_state text NOT NULL DEFAULT 'draft',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(case_id,version)
);
CREATE INDEX a7_projects_owner ON a7_projects(owner_id,created_at);
CREATE INDEX a7_versions_case ON a7_job_versions(case_id,version);
