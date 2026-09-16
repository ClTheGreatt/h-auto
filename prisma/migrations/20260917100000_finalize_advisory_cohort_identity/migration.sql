-- Phase B requires every deployed advisory to have an exact cohort identity.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "FacultySectionAdvisory"
        WHERE "course" IS NULL
    ) THEN
        RAISE EXCEPTION 'Phase B blocked: FacultySectionAdvisory contains unresolved NULL course rows.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "FacultySectionAdvisory"
        WHERE "course" IS NOT NULL
        GROUP BY "facultyId", "course", "section"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Phase B blocked: FacultySectionAdvisory contains duplicate faculty, course, and section identities.';
    END IF;
END $$;

-- Establish the final exact cohort identity before removing Phase A protection.
CREATE UNIQUE INDEX "FacultySectionAdvisory_facultyId_course_section_key"
ON "FacultySectionAdvisory"("facultyId", "course", "section");

CREATE INDEX "FacultySectionAdvisory_course_section_idx"
ON "FacultySectionAdvisory"("course", "section");

DROP INDEX "FacultySectionAdvisory_facultyId_section_key";
DROP INDEX "FacultySectionAdvisory_section_idx";
