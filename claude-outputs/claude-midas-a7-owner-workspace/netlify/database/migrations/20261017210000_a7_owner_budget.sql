-- New tables only. Existing job/history and private files are unchanged.
CREATE TABLE a7_owner_budgets (
  client_run_id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL,
  run_id TEXT,
  limit_micro_usd BIGINT NOT NULL CHECK (limit_micro_usd BETWEEN 250000 AND 5000000),
  committed_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (committed_micro_usd >= 0),
  pricing_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE a7_paid_operations (
  operation_key TEXT PRIMARY KEY,
  client_run_id TEXT NOT NULL REFERENCES a7_owner_budgets(client_run_id),
  run_id TEXT NOT NULL,
  node_name TEXT NOT NULL,
  model TEXT NOT NULL,
  output_id TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  permit UUID NOT NULL,
  pricing JSONB NOT NULL,
  reserved_micro_usd BIGINT NOT NULL CHECK (reserved_micro_usd > 0),
  accounted_micro_usd BIGINT NOT NULL CHECK (accounted_micro_usd >= 0),
  status TEXT NOT NULL CHECK (status IN ('reserved','completed','uncertain','owner_reconciled')),
  settle_sha256 TEXT,
  usage JSONB,
  receipt_ref TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX a7_paid_operations_job ON a7_paid_operations(client_run_id, created_at);
CREATE TABLE a7_budget_audit (
  event_id UUID PRIMARY KEY,
  client_run_id TEXT NOT NULL REFERENCES a7_owner_budgets(client_run_id),
  operation_key TEXT,
  event TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
