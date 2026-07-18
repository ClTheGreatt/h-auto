// Course is a free-text field (see user-form.tsx), so admins may enter a
// full program name, an abbreviation, or anything in between. This only
// abbreviates recognized patterns; anything else passes through unchanged
// rather than inventing an abbreviation.
const KNOWN_COURSES: { pattern: RegExp; abbreviation: string }[] = [
  { pattern: /information technology/i, abbreviation: "BSIT" },
  { pattern: /computer science/i, abbreviation: "BSCS" },
  { pattern: /agriculture/i, abbreviation: "BS Agriculture" },
];

const MAJOR_PATTERN = /\bmajor\s+in\s+(.+)$/i;

export function abbreviateCourse(courseName: string): string {
  const trimmed = courseName.trim();
  if (!trimmed) return trimmed;

  const majorMatch = trimmed.match(MAJOR_PATTERN);
  const specialization = majorMatch?.[1]?.trim();
  const base = majorMatch ? trimmed.slice(0, majorMatch.index).trim() : trimmed;

  const known = KNOWN_COURSES.find((k) => k.pattern.test(base));
  const abbreviation = known ? known.abbreviation : base;

  return specialization ? `${abbreviation} · ${specialization}` : abbreviation;
}
