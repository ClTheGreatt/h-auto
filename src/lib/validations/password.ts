import { z } from "zod";

/**
 * Central password strength requirements.
 * Used everywhere a user creates or changes a password.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordStrengthSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`)
  .refine((val) => /[A-Z]/.test(val), "Must include at least one uppercase letter")
  .refine((val) => /[a-z]/.test(val), "Must include at least one lowercase letter")
  .refine((val) => /[0-9]/.test(val), "Must include at least one number")
  .refine((val) => /[^a-zA-Z0-9]/.test(val), "Must include at least one symbol");

/**
 * Client-side password strength scorer for UI display.
 * Returns { score: 0-4, label, color }
 */
export function scorePasswordStrength(password: string) {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["red", "orange", "yellow", "blue", "green"];

  return {
    score,
    label: labels[score],
    color: colors[score],
    isValid: score === 4 && password.length >= PASSWORD_MIN_LENGTH,
  };
}
