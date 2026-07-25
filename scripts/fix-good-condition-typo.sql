-- One-off data fix: "Good Conditon" -> "Good Condition" typo in GrowthLog text.
--
-- DO NOT RUN THIS AGAINST PRODUCTION DIRECTLY.
-- Review the SELECT output first, then run against a Neon backup branch,
-- confirm the result, and only then apply to production if you're satisfied.
--
-- This typo was not found in prisma/seed.ts or anywhere else in the
-- repository source, so it must have been typed directly into a real
-- growth log via the UI (observations or notes field) rather than seeded.

-- 1. Preview affected rows before changing anything.
SELECT id, "plotId", "userId", observations, notes, "createdAt"
FROM "GrowthLog"
WHERE observations LIKE '%Good Conditon%'
   OR notes LIKE '%Good Conditon%';

-- 2. Apply the fix (run only after reviewing step 1's output).
UPDATE "GrowthLog"
SET observations = REPLACE(observations, 'Good Conditon', 'Good Condition')
WHERE observations LIKE '%Good Conditon%';

UPDATE "GrowthLog"
SET notes = REPLACE(notes, 'Good Conditon', 'Good Condition')
WHERE notes LIKE '%Good Conditon%';

-- 3. Verify no instances remain.
SELECT id, observations, notes
FROM "GrowthLog"
WHERE observations LIKE '%Good Conditon%'
   OR notes LIKE '%Good Conditon%';
