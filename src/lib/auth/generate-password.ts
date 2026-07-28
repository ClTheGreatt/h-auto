import { randomInt } from "crypto";

// Generates a temporary login credential (welcome email / bulk import),
// not a user-chosen long-term password — every caller that uses this also
// sets mustChangePassword, so it's expected to be rotated on first login.
//
// Format: Hauto-XXXX-XXXX — 8 random characters from a 32-character
// alphabet, split into two groups of 4 by a hyphen. 32^8 = 2^40 possible
// combinations for the random portion.
//
// The alphabet deliberately excludes I, O, 0, 1, and all lowercase: these
// are the characters most often confused with each other (I/l/1, O/0) when
// someone is transcribing a password by hand from a printed or exported
// credentials CSV, rather than copy-pasting it.
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const TEMP_PASSWORD_DIGITS = "23456789";

const RANDOM_CHAR_COUNT = 8;
const GROUP_SIZE = 4;

function randomAlphabetChar(): string {
  // crypto.randomInt(0, n) is unbiased (Node rejects out-of-range draws
  // internally rather than using modulo), unlike `randomBytes(...)  % n`.
  return TEMP_PASSWORD_ALPHABET[randomInt(0, TEMP_PASSWORD_ALPHABET.length)];
}

export function generateTempPassword(): string {
  const chars = Array.from({ length: RANDOM_CHAR_COUNT }, randomAlphabetChar);

  // Guarantee at least one digit among the 8 random characters. If none
  // landed on one, overwrite a random position (not necessarily the
  // first, so the digit's position isn't predictable) with a random digit.
  if (!chars.some((c) => TEMP_PASSWORD_DIGITS.includes(c))) {
    const position = randomInt(0, chars.length);
    chars[position] = TEMP_PASSWORD_DIGITS[randomInt(0, TEMP_PASSWORD_DIGITS.length)];
  }

  const group1 = chars.slice(0, GROUP_SIZE).join("");
  const group2 = chars.slice(GROUP_SIZE, GROUP_SIZE * 2).join("");
  return `Hauto-${group1}-${group2}`;
}
