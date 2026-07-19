import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not defined in environment variables");
  }

  return secret;
}

export type MobileTokenPayload = {
  sub: string; // user id
  email: string;
  role: string;
  tokenVersion: number;
};

export function signMobileToken(
  payload: MobileTokenPayload,
  expiresIn: SignOptions["expiresIn"] = "30d"
): string {
  return jwt.sign(payload, getAuthSecret(), { expiresIn });
}

export function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getAuthSecret());
    if (typeof decoded === "string") return null;
    return decoded as MobileTokenPayload;
  } catch {
    return null;
  }
}
