import type { Prisma } from "@prisma/client";

export const BASE_ASSIGNABLE_STUDENT_WHERE = {
  role: "STUDENT_FARMER",
  status: "ACTIVE",
  graduatedAt: null,
} as const satisfies Prisma.UserWhereInput;
