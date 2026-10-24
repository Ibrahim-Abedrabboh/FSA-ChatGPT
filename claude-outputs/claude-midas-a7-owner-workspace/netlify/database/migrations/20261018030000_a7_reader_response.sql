-- Nullable, bounded checkpoint. Existing receipts and reservations are untouched.
ALTER TABLE a7_paid_operations ADD COLUMN reader_response JSONB;
ALTER TABLE a7_paid_operations ADD COLUMN reader_response_sha256 TEXT;
ALTER TABLE a7_paid_operations ADD CONSTRAINT a7_reader_response_size
  CHECK (reader_response IS NULL OR octet_length(reader_response::text) <= 262144);
