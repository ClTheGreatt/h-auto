import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deleteStageReferenceImageFromCloudinary,
  isStageReferencePublicId,
} from "../cloudinary";
import {
  MAX_STAGE_REFERENCE_IMAGE_BYTES,
  MAX_STAGE_REFERENCE_IMAGE_MB,
  STAGE_REFERENCE_IMAGE_SIZE_COPY,
} from "./stage-reference-constants";
import { validateStageReferenceImage } from "./stage-reference-image";
import {
  commitStageChangesAndCleanup,
  removeStageReferenceImage,
  replaceStageReferenceImage,
  STAGE_REFERENCE_IMAGE_CONFLICT,
  type StageMediaDependencies,
  type StageImageRecord,
} from "./stage-reference-media";

const jpegBytes = [0xff, 0xd8, 0xff, 0xe0];
const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webpBytes = [
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

function imageFile(type: string, bytes: number[], size = bytes.length): File {
  return {
    type,
    size,
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => Uint8Array.from(bytes.slice(start, end)).buffer,
    }),
  } as File;
}

function dependencies(
  overrides: Partial<StageMediaDependencies> = {}
): {
  dependencies: StageMediaDependencies;
  events: string[];
  updates: Array<{
    stageId: string;
    expected: StageImageRecord;
    image: { referenceImageUrl: string | null; referenceImagePublicId: string | null };
  }>;
} {
  const events: string[] = [];
  const updates: Array<{
    stageId: string;
    expected: StageImageRecord;
    image: { referenceImageUrl: string | null; referenceImagePublicId: string | null };
  }> = [];
  return {
    events,
    updates,
    dependencies: {
      authorize: async () => {
        events.push("authorize");
      },
      findStage: async () => ({
        id: "stage-1",
        cropId: "crop-1",
        referenceImageUrl: null,
        referenceImagePublicId: null,
      }),
      upload: async () => {
        events.push("upload:new");
        return {
          url: "https://res.cloudinary.com/demo/image/upload/new.jpg",
          publicId: "h-auto/stage-references/new",
        };
      },
      updateImageIfCurrent: async (stage, image) => {
        events.push("update");
        updates.push({ stageId: stage.id, expected: stage, image });
        return 1;
      },
      deleteImage: async (publicId) => {
        events.push(`delete:${publicId}`);
      },
      ...overrides,
    },
  };
}

function authorizeRole(role: string) {
  return async () => {
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      throw new Error("Forbidden");
    }
  };
}

test("10. Super Admin can pass the media action authorization boundary", async () => {
  const fixture = dependencies({ authorize: authorizeRole("SUPER_ADMIN") });
  const result = await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.equal(result.success, true);
});

test("11. Admin can pass the media action authorization boundary", async () => {
  const fixture = dependencies({ authorize: authorizeRole("ADMIN") });
  const result = await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.equal(result.success, true);
});

test("12. Faculty is rejected at the media action authorization boundary", async () => {
  const fixture = dependencies({ authorize: authorizeRole("FACULTY") });
  await assert.rejects(
    replaceStageReferenceImage(
      fixture.dependencies,
      "crop-1",
      "stage-1",
      imageFile("image/jpeg", jpegBytes)
    ),
    /Forbidden/
  );
});

test("13. Student is rejected at the media action authorization boundary", async () => {
  const fixture = dependencies({ authorize: authorizeRole("STUDENT_FARMER") });
  await assert.rejects(
    removeStageReferenceImage(fixture.dependencies, "crop-1", "stage-1"),
    /Forbidden/
  );
});

test("14. a nonexistent stage is rejected", async () => {
  const fixture = dependencies({ findStage: async () => null });
  const result = await removeStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "missing-stage"
  );
  assert.equal(result.error, "Stage not found");
});

test("15. a stage from another crop is rejected", async () => {
  const fixture = dependencies();
  const result = await removeStageReferenceImage(
    fixture.dependencies,
    "other-crop",
    "stage-1"
  );
  assert.match(result.error ?? "", /does not belong/);
});

test("16. a valid JPEG signature is accepted", async () => {
  assert.equal(await validateStageReferenceImage(imageFile("image/jpeg", jpegBytes)), null);
});

test("17. a valid PNG signature is accepted", async () => {
  assert.equal(await validateStageReferenceImage(imageFile("image/png", pngBytes)), null);
});

test("18. a valid WebP signature is accepted", async () => {
  assert.equal(await validateStageReferenceImage(imageFile("image/webp", webpBytes)), null);
});

test("19. a MIME type spoof is rejected by file signature", async () => {
  const result = await validateStageReferenceImage(imageFile("image/png", jpegBytes));
  assert.match(result?.error ?? "", /contents/);
});

test("20. GIF is unsupported for stage references", async () => {
  const result = await validateStageReferenceImage(
    imageFile("image/gif", [0x47, 0x49, 0x46, 0x38])
  );
  assert.match(result?.error ?? "", /JPEG, PNG, or WebP/);
});

test("21. SVG is unsupported for stage references", async () => {
  const result = await validateStageReferenceImage(
    imageFile("image/svg+xml", [0x3c, 0x73, 0x76, 0x67])
  );
  assert.match(result?.error ?? "", /JPEG, PNG, or WebP/);
});

test("22. the shared 3 MB cap accepts the boundary, rejects larger files, and supplies UI copy", async () => {
  assert.equal(MAX_STAGE_REFERENCE_IMAGE_MB, 3);
  assert.equal(MAX_STAGE_REFERENCE_IMAGE_BYTES, 3 * 1024 * 1024);
  assert.equal(STAGE_REFERENCE_IMAGE_SIZE_COPY, "Maximum 3 MB.");
  assert.equal(
    await validateStageReferenceImage(
      imageFile("image/jpeg", jpegBytes, MAX_STAGE_REFERENCE_IMAGE_BYTES)
    ),
    null
  );
  const result = await validateStageReferenceImage(
    imageFile("image/jpeg", jpegBytes, MAX_STAGE_REFERENCE_IMAGE_BYTES + 1)
  );
  assert.match(result?.error ?? "", /too large/);
});

test("23. an arbitrary public ID cannot be deleted", async () => {
  assert.equal(isStageReferencePublicId("h-auto/growth-logs/photo"), false);
  assert.equal(isStageReferencePublicId("h-auto/stage-references/../photo"), false);
  await assert.rejects(
    deleteStageReferenceImageFromCloudinary("h-auto/growth-logs/photo"),
    /outside the stage-reference folder/
  );
});

test("24. upload stores both the secure URL and public ID", async () => {
  const fixture = dependencies();
  await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.deepEqual(fixture.updates[0], {
    stageId: "stage-1",
    expected: {
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: null,
      referenceImagePublicId: null,
    },
    image: {
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/new.jpg",
      referenceImagePublicId: "h-auto/stage-references/new",
    },
  });
});

test("25. replacement returns and persists the new reference", async () => {
  const fixture = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
  });
  const result = await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.equal(result.url, "https://res.cloudinary.com/demo/image/upload/new.jpg");
  assert.equal(fixture.updates[0].image.referenceImagePublicId, "h-auto/stage-references/new");
});

test("26. successful replacement attempts old-asset cleanup after the DB update", async () => {
  const fixture = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
  });
  await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.deepEqual(fixture.events, [
    "authorize",
    "upload:new",
    "update",
    "delete:h-auto/stage-references/old",
  ]);

  const cleanupFailure = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
    deleteImage: async () => {
      throw new Error("Cloudinary unavailable");
    },
    logCleanupFailure: () => undefined,
  });
  const warningResult = await replaceStageReferenceImage(
    cleanupFailure.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.equal(warningResult.success, true);
  assert.match(warningResult.cleanupWarning ?? "", /previous asset/);
  assert.equal(cleanupFailure.updates.length, 1);
});

test("27. a failed DB replace attempts cleanup of the new upload", async () => {
  const fixture = dependencies({
    updateImageIfCurrent: async () => {
      fixture.events.push("update:failed");
      throw new Error("DB failed");
    },
  });
  const result = await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );
  assert.equal(result.error, "DB failed");
  assert.equal(fixture.events.at(-1), "delete:h-auto/stage-references/new");
});

test("28. removal clears DB fields before attempting asset cleanup", async () => {
  const fixture = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
  });
  const result = await removeStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1"
  );
  assert.equal(result.success, true);
  assert.deepEqual(fixture.updates[0].image, {
    referenceImageUrl: null,
    referenceImagePublicId: null,
  });
  assert.deepEqual(fixture.events.slice(-2), [
    "update",
    "delete:h-auto/stage-references/old",
  ]);

  const cleanupFailure = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
    deleteImage: async () => {
      throw new Error("Cloudinary unavailable");
    },
    logCleanupFailure: () => undefined,
  });
  const warningResult = await removeStageReferenceImage(
    cleanupFailure.dependencies,
    "crop-1",
    "stage-1"
  );
  assert.equal(warningResult.success, true);
  assert.match(warningResult.cleanupWarning ?? "", /stored asset/);
  assert.deepEqual(cleanupFailure.updates[0].image, {
    referenceImageUrl: null,
    referenceImagePublicId: null,
  });
});

test("29. removed-stage asset cleanup starts only after a successful DB commit", async () => {
  const events: string[] = [];
  await commitStageChangesAndCleanup(
    async () => {
      events.push("commit");
    },
    () => ["h-auto/stage-references/removed"],
    async () => {
      events.push("cleanup");
    }
  );
  assert.deepEqual(events, ["commit", "cleanup"]);

  events.length = 0;
  await assert.rejects(
    commitStageChangesAndCleanup(
      async () => {
        events.push("commit:failed");
        throw new Error("DB failed");
      },
      () => ["h-auto/stage-references/removed"],
      async () => {
        events.push("cleanup");
      }
    )
  );
  assert.deepEqual(events, ["commit:failed"]);
});

test("30. crop archival does not invoke stage-reference deletion", () => {
  const actions = readFileSync("src/actions/crops.ts", "utf8");
  const archiveBlock = actions.slice(
    actions.indexOf("export async function archiveCrop"),
    actions.indexOf("export async function togglePreset")
  );
  assert.equal(archiveBlock.includes("deleteStageReferenceImageFromCloudinary"), false);
});

test("38. signature validation reads only the required 12-byte prefix", async () => {
  let requestedSlice: [number | undefined, number | undefined] | undefined;
  const file = {
    type: "image/webp",
    size: MAX_STAGE_REFERENCE_IMAGE_BYTES,
    slice: (start?: number, end?: number) => {
      requestedSlice = [start, end];
      return { arrayBuffer: async () => Uint8Array.from(webpBytes).buffer };
    },
  } as File;

  assert.equal(await validateStageReferenceImage(file), null);
  assert.deepEqual(requestedSlice, [0, 12]);
});

test("39. concurrent replacements let one owner win and compensate the stale upload", async () => {
  let state = {
    referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
    referenceImagePublicId: "h-auto/stage-references/old",
  };
  let uploadNumber = 0;
  const deleted: string[] = [];
  const fixture = dependencies({
    findStage: async () => ({ id: "stage-1", cropId: "crop-1", ...state }),
    upload: async () => {
      uploadNumber += 1;
      return {
        url: `https://res.cloudinary.com/demo/image/upload/new-${uploadNumber}.jpg`,
        publicId: `h-auto/stage-references/new-${uploadNumber}`,
      };
    },
    updateImageIfCurrent: async (expected, image) => {
      if (
        state.referenceImageUrl !== expected.referenceImageUrl ||
        state.referenceImagePublicId !== expected.referenceImagePublicId
      ) {
        return 0;
      }
      state = {
        referenceImageUrl: image.referenceImageUrl!,
        referenceImagePublicId: image.referenceImagePublicId!,
      };
      return 1;
    },
    deleteImage: async (publicId) => {
      deleted.push(publicId);
    },
  });

  const [requestA, requestB] = await Promise.all([
    replaceStageReferenceImage(
      fixture.dependencies,
      "crop-1",
      "stage-1",
      imageFile("image/jpeg", jpegBytes)
    ),
    replaceStageReferenceImage(
      fixture.dependencies,
      "crop-1",
      "stage-1",
      imageFile("image/jpeg", jpegBytes)
    ),
  ]);

  assert.equal(requestA.success, true);
  assert.equal(requestB.error, STAGE_REFERENCE_IMAGE_CONFLICT);
  assert.equal(state.referenceImagePublicId, "h-auto/stage-references/new-1");
  assert.deepEqual(deleted.sort(), [
    "h-auto/stage-references/new-2",
    "h-auto/stage-references/old",
  ]);
  assert.equal(deleted.includes("h-auto/stage-references/new-1"), false);
});

test("40. a stale remove cannot clear or delete a newer canonical image", async () => {
  const deleted: string[] = [];
  let state = {
    referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
    referenceImagePublicId: "h-auto/stage-references/old",
  };
  const fixture = dependencies({
    findStage: async () => ({ id: "stage-1", cropId: "crop-1", ...state }),
    updateImageIfCurrent: async (expected) => {
      state = {
        referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/newer.jpg",
        referenceImagePublicId: "h-auto/stage-references/newer",
      };
      return expected.referenceImagePublicId === state.referenceImagePublicId ? 1 : 0;
    },
    deleteImage: async (publicId) => {
      deleted.push(publicId);
    },
  });

  const result = await removeStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1"
  );

  assert.equal(result.error, STAGE_REFERENCE_IMAGE_CONFLICT);
  assert.equal(state.referenceImagePublicId, "h-auto/stage-references/newer");
  assert.deepEqual(deleted, []);
});

test("41. deleted-stage cleanup resolves the public ID captured by the committed deletion", async () => {
  let deletedRowPublicIds: string[] = [];
  const cleaned: string[] = [];

  await commitStageChangesAndCleanup(
    async () => {
      deletedRowPublicIds = ["h-auto/stage-references/replacement"];
    },
    () => deletedRowPublicIds,
    async (publicId) => {
      cleaned.push(publicId);
    }
  );

  assert.deepEqual(cleaned, ["h-auto/stage-references/replacement"]);
});

test("42. deletion winning first makes replacement compensate its upload", async () => {
  const deleted: string[] = [];
  const fixture = dependencies({
    findStage: async () => ({
      id: "stage-1",
      cropId: "crop-1",
      referenceImageUrl: "https://res.cloudinary.com/demo/image/upload/old.jpg",
      referenceImagePublicId: "h-auto/stage-references/old",
    }),
    updateImageIfCurrent: async () => 0,
    deleteImage: async (publicId) => {
      deleted.push(publicId);
    },
  });

  const result = await replaceStageReferenceImage(
    fixture.dependencies,
    "crop-1",
    "stage-1",
    imageFile("image/jpeg", jpegBytes)
  );

  assert.equal(result.error, STAGE_REFERENCE_IMAGE_CONFLICT);
  assert.deepEqual(deleted, ["h-auto/stage-references/new"]);
});
