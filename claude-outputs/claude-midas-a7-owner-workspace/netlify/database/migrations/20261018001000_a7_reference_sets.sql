ALTER TABLE a7_version_references ADD COLUMN reference_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE a7_version_references DROP CONSTRAINT a7_version_references_pkey;
ALTER TABLE a7_version_references ADD PRIMARY KEY(version_id,reference_id);
ALTER TABLE a7_version_references ADD UNIQUE(version_id,role,sha256);
ALTER TABLE a7_version_references DROP CONSTRAINT a7_version_references_role_check;
ALTER TABLE a7_version_references ADD CHECK(role IN ('product','room','other_view','look','previous','spec'));
