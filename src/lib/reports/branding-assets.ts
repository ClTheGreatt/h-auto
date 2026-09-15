import { readFile } from "node:fs/promises";
import path from "node:path";

export type ReportBrandingAssets = {
  bpsuSeal: Buffer;
  agricultureEmblem: Buffer;
};

let brandingAssetsPromise: Promise<ReportBrandingAssets> | undefined;

export function loadReportBrandingAssets(): Promise<ReportBrandingAssets> {
  const brandingDirectory = path.join(process.cwd(), "public", "branding");
  brandingAssetsPromise ??= Promise.all([
    readFile(path.join(brandingDirectory, "bpsu-seal.png")),
    readFile(path.join(brandingDirectory, "bpsu-abucay-agri-logo.png")),
  ]).then(([bpsuSeal, agricultureEmblem]) => ({
    bpsuSeal,
    agricultureEmblem,
  }));

  return brandingAssetsPromise;
}
