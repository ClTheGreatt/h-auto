import { validateStageReferenceImage } from "./stage-reference-image";

export type StageImageRecord = {
  id: string;
  cropId: string;
  referenceImageUrl: string | null;
  referenceImagePublicId: string | null;
};

type UploadedImage = { url: string; publicId: string };

export type StageMediaDependencies = {
  authorize: () => Promise<void>;
  findStage: (stageId: string) => Promise<StageImageRecord | null>;
  upload: (file: File) => Promise<UploadedImage>;
  updateImageIfCurrent: (
    stage: StageImageRecord,
    image: { referenceImageUrl: string | null; referenceImagePublicId: string | null }
  ) => Promise<number>;
  deleteImage: (publicId: string) => Promise<void>;
  logCleanupFailure?: (message: string, error: unknown) => void;
};

export const STAGE_REFERENCE_IMAGE_CONFLICT =
  "The stage reference image changed while this request was in progress. Please refresh and try again.";

export type StageMediaResult = {
  success?: true;
  error?: string;
  url?: string;
  cleanupWarning?: string;
};

async function authorizedStage(
  dependencies: StageMediaDependencies,
  cropId: string,
  stageId: string
): Promise<StageImageRecord | StageMediaResult> {
  await dependencies.authorize();
  const stage = await dependencies.findStage(stageId);
  if (!stage) return { error: "Stage not found" };
  if (stage.cropId !== cropId) {
    return { error: "This stage does not belong to the selected crop" };
  }
  return stage;
}

export async function replaceStageReferenceImage(
  dependencies: StageMediaDependencies,
  cropId: string,
  stageId: string,
  file: File
): Promise<StageMediaResult> {
  const stage = await authorizedStage(dependencies, cropId, stageId);
  if (!("id" in stage)) return stage;

  const validationError = await validateStageReferenceImage(file);
  if (validationError) return { error: validationError.error };

  let uploaded: UploadedImage;
  try {
    uploaded = await dependencies.upload(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Image upload failed" };
  }

  try {
    const updatedCount = await dependencies.updateImageIfCurrent(stage, {
      referenceImageUrl: uploaded.url,
      referenceImagePublicId: uploaded.publicId,
    });
    if (updatedCount === 0) {
      try {
        await dependencies.deleteImage(uploaded.publicId);
      } catch (cleanupError) {
        dependencies.logCleanupFailure?.(
          `Failed to clean up stale uploaded stage image ${uploaded.publicId}`,
          cleanupError
        );
      }
      return { error: STAGE_REFERENCE_IMAGE_CONFLICT };
    }
  } catch (error) {
    try {
      await dependencies.deleteImage(uploaded.publicId);
    } catch (cleanupError) {
      dependencies.logCleanupFailure?.(
        `Failed to clean up newly uploaded stage image ${uploaded.publicId}`,
        cleanupError
      );
    }
    return { error: error instanceof Error ? error.message : "Could not save image" };
  }

  let cleanupWarning: string | undefined;
  if (stage.referenceImagePublicId && stage.referenceImagePublicId !== uploaded.publicId) {
    try {
      await dependencies.deleteImage(stage.referenceImagePublicId);
    } catch (error) {
      cleanupWarning = "The new image was saved, but the previous asset could not be cleaned up.";
      dependencies.logCleanupFailure?.(
        `Failed to clean up replaced stage image ${stage.referenceImagePublicId}`,
        error
      );
    }
  }

  return { success: true, url: uploaded.url, cleanupWarning };
}

export async function removeStageReferenceImage(
  dependencies: StageMediaDependencies,
  cropId: string,
  stageId: string
): Promise<StageMediaResult> {
  const stage = await authorizedStage(dependencies, cropId, stageId);
  if (!("id" in stage)) return stage;

  if (!stage.referenceImageUrl && !stage.referenceImagePublicId) {
    return { success: true };
  }

  const updatedCount = await dependencies.updateImageIfCurrent(stage, {
    referenceImageUrl: null,
    referenceImagePublicId: null,
  });
  if (updatedCount === 0) {
    return { error: STAGE_REFERENCE_IMAGE_CONFLICT };
  }

  let cleanupWarning: string | undefined;
  if (stage.referenceImagePublicId) {
    try {
      await dependencies.deleteImage(stage.referenceImagePublicId);
    } catch (error) {
      cleanupWarning = "The image was removed, but its stored asset could not be cleaned up.";
      dependencies.logCleanupFailure?.(
        `Failed to clean up removed stage image ${stage.referenceImagePublicId}`,
        error
      );
    }
  }

  return { success: true, cleanupWarning };
}

export async function cleanupStageReferenceImages(
  publicIds: string[],
  deleteImage: (publicId: string) => Promise<void>,
  logCleanupFailure: (message: string, error: unknown) => void = console.error
): Promise<string | undefined> {
  let failed = false;
  for (const publicId of publicIds) {
    try {
      await deleteImage(publicId);
    } catch (error) {
      failed = true;
      logCleanupFailure(`Failed to clean up deleted-stage image ${publicId}`, error);
    }
  }
  return failed
    ? "The crop was saved, but one or more removed-stage assets could not be cleaned up."
    : undefined;
}

export async function commitStageChangesAndCleanup(
  commit: () => Promise<void>,
  getPublicIds: () => string[],
  deleteImage: (publicId: string) => Promise<void>,
  logCleanupFailure?: (message: string, error: unknown) => void
): Promise<string | undefined> {
  await commit();
  return cleanupStageReferenceImages(getPublicIds(), deleteImage, logCleanupFailure);
}
