-- CreateTable
CREATE TABLE "FacultySectionAdvisory" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacultySectionAdvisory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacultySectionAdvisory_section_idx" ON "FacultySectionAdvisory"("section");

-- CreateIndex
CREATE UNIQUE INDEX "FacultySectionAdvisory_facultyId_section_key" ON "FacultySectionAdvisory"("facultyId", "section");

-- AddForeignKey
ALTER TABLE "FacultySectionAdvisory" ADD CONSTRAINT "FacultySectionAdvisory_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
