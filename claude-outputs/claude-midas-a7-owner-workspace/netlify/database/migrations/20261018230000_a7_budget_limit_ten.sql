-- Allow a job ceiling up to USD 10 (lib/a7-limits.mjs MAX_JOB_BUDGET_USD). Widening only: existing rows
-- already satisfy the new range, and the lower bound is unchanged.
ALTER TABLE a7_owner_budgets DROP CONSTRAINT a7_owner_budgets_limit_micro_usd_check;
ALTER TABLE a7_owner_budgets ADD CONSTRAINT a7_owner_budgets_limit_micro_usd_check CHECK (limit_micro_usd BETWEEN 250000 AND 10000000);
