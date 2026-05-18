import { z } from "zod";

export const ALLOWED_EMAIL_DOMAIN = "bpsu.edu.ph";

/**
 * Zod schema for BPSU-restricted email addresses.
 * Use this anywhere we validate email input for new user accounts.
 *
 * Valid: juan.cruz@bpsu.edu.ph
 * Invalid: juan@gmail.com, juan@bpsu.com, juan.cruz@bpsu.edu (missing .ph)
 */
export const bpsuEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .refine(
    (email) => email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
    {
      message: `Email must use the BPSU domain (@${ALLOWED_EMAIL_DOMAIN})`,
    }
  );