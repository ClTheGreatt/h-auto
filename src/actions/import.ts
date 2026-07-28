"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { commitImportRows } from "@/lib/imports/commit";
import type { ImportRowType } from "@/lib/validations/import";

type RawRow = Record<string, unknown>;

export async function commitImport(
  type: ImportRowType,
  rawRows: RawRow[],
  fileName: string
) {
  const session = await requireAdmin();
  // requireAdmin() already guarantees session.user (redirects otherwise),
  // so this is unreachable in practice — kept anyway to preserve the
  // exact original return-type union ({ error: string } | success shape)
  // that the UI's `if ("error" in res)` type-narrowing depends on.
  if (!session?.user) return { error: "Not authenticated" };

  const { created, credentials, failed, totalProcessed } =
    await commitImportRows({
      rows: rawRows,
      importType: type,
      actorId: session.user.id,
      fileName,
    });

  revalidatePath("/dashboard/users");

  return {
    success: created,
    credentials,
    failed,
    totalProcessed,
  };
}
