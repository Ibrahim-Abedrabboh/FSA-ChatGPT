-- Scenes from an approved white image (20 Oct 2026): an owner-approved white master is recorded too, so a new job can start its
-- scenes from it instead of making a new white master.
ALTER TABLE a7_result_assets DROP CONSTRAINT a7_result_assets_kind_check;
ALTER TABLE a7_result_assets ADD CONSTRAINT a7_result_assets_kind_check CHECK(kind IN ('scene','white'));
