// The only format this codebase has ever written (see deactivateUser in
// src/actions/users.ts) is the underscore form. The double-colon form is
// handled defensively in case of a manual DB edit, but has never been
// produced by any code path here.
const INACTIVE_EMAIL_PATTERNS = [
  /^inactive::\d+::(.+)$/, // defensive: never written by this codebase
  /^inactive_\d+_(.+)$/, // actual format written by deactivateUser
];

/**
 * Strips the "inactive_<timestamp>_" or "inactive::<timestamp>::" prefix
 * from a deactivated user's email to restore the original.
 * Returns the original email if no prefix is found.
 */
export function stripInactivePrefix(email: string): string {
  for (const pattern of INACTIVE_EMAIL_PATTERNS) {
    const match = email.match(pattern);
    if (match) return match[1];
  }
  return email;
}

/**
 * Returns true if the email is in a deactivated (prefixed) state.
 */
export function isInactivePrefixed(email: string): boolean {
  return /^inactive(::|_)\d+(::|_)/.test(email);
}
