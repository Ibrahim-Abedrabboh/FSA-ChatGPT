-- Automatic names: a reference CAT-YYMM-NN per product (case), assigned once and never reused.
-- Display only; A7/n8n/budget identities (owner-<uuid>, claude-a7-<uuid>) are unchanged.
ALTER TABLE a7_cases ADD COLUMN ref text, ADD COLUMN category text;
CREATE TABLE a7_case_ref_counters (
 owner_id uuid NOT NULL,prefix text NOT NULL,last_value integer NOT NULL CHECK(last_value>0),PRIMARY KEY(owner_id,prefix)
);
-- Existing products: category from the case title and the first version's product type (same rules as
-- lib/a7-naming.mjs), month from the case creation time in Asia/Amman, numbered in creation order.
WITH src AS (
 SELECT c.id,c.owner_id,c.created_at,lower(c.title||' '||COALESCE((SELECT v.brief->>'product' FROM a7_job_versions v WHERE v.case_id=c.id ORDER BY v.version LIMIT 1),'')) AS t FROM a7_cases c WHERE c.ref IS NULL
),coded AS (
 SELECT id,owner_id,created_at,CASE
  WHEN t ~ 'office' THEN 'OFF'
  WHEN t ~ 'lamp|lighting|chandelier|pendant|sconce|ceiling light|wall light|floor light|table light' THEN 'LGT'
  WHEN t ~ 'towel|bathrobe|robe|rug|carpet|cushion|pillow|throw|curtain|textile|linen|bedding|duvet|blanket|quilt|bed sheet' THEN 'TEX'
  WHEN t ~ 'dining|buffet|sideboard|serving trolley' THEN 'DIN'
  WHEN t ~ 'bed|mattress|headboard|nightstand|night stand|dresser|wardrobe|chest of drawers' THEN 'BED'
  WHEN t ~ 'sofa|sectional|couch|loveseat|love seat|chaise|ottoman|recliner|pouf|settee' THEN 'SOF'
  WHEN t ~ 'chair|stool|bench' THEN 'CHR'
  WHEN t ~ 'table|desk|console|nesting' THEN 'TAB'
  WHEN t ~ 'cabinet|shelf|shelves|bookcase|tv unit|storage|cupboard|display unit' THEN 'STO'
  WHEN t ~ 'vase|dish|bowl|tray|mirror|clock|frame|candle|decor|figurine|accessor|plate|dinnerware|ashtray|jewel|bookend|wall art|painting|flower|sculpture|ornament|basket' THEN 'ACC'
  ELSE 'GEN' END AS code FROM src
),numbered AS (
 SELECT id,owner_id,code,code||'-'||to_char(created_at AT TIME ZONE 'Asia/Amman','YYMM') AS prefix,
  row_number() OVER (PARTITION BY owner_id,code,to_char(created_at AT TIME ZONE 'Asia/Amman','YYMM') ORDER BY created_at,id) AS n FROM coded
)
UPDATE a7_cases c SET category=numbered.code,ref=numbered.prefix||'-'||CASE WHEN numbered.n<10 THEN '0' ELSE '' END||numbered.n::text FROM numbered WHERE c.id=numbered.id;
INSERT INTO a7_case_ref_counters(owner_id,prefix,last_value)
 SELECT owner_id,substring(ref from '^[A-Z]{3}-[0-9]{4}'),count(*) FROM a7_cases WHERE ref IS NOT NULL GROUP BY 1,2;
CREATE UNIQUE INDEX a7_cases_owner_ref ON a7_cases(owner_id,ref) WHERE ref IS NOT NULL;
