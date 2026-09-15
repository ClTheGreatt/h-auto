import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  cloudinaryThumbnailUrl,
  fetchGrowthLogPhoto,
  MAX_GROWTH_REPORT_PHOTO_FETCHES,
  prepareGrowthLogPhotoEvidence,
  selectGrowthLogPhotos,
  trustedCloudinaryUrl,
} from "./growth-log-media";

const CLOUD = "fixture-cloud";
const base = `https://res.cloudinary.com/${CLOUD}/image/upload/v123/h-auto/growth-logs/photo.jpg`;
const second = `https://res.cloudinary.com/${CLOUD}/image/upload/v124/h-auto/observations/photo.png`;
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6a+E/wI+GmsfC3wdf3/w78KXt9daNZz3F1c6JbSSzSNAjM7sUJZiSSSeSTRRRXPQ/gw9F+RtW/iy9Wf/Z",
  "base64"
);
const validJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==",
  "base64"
);
const invalidPng = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const localPng = () => readFile(path.join(process.cwd(), "public", "branding", "bpsu-seal.png"));

function jpegWithDimensions(width: number, height: number): Buffer {
  const resized = Buffer.from(validJpeg);
  const sof = resized.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(sof >= 0, "fixture must contain a JPEG SOF marker");
  resized.writeUInt16BE(height, sof + 5);
  resized.writeUInt16BE(width, sof + 7);
  return resized;
}

function mockFetch(response: Response, seen?: string[]) {
  return (async (url: RequestInfo | URL) => {
    seen?.push(String(url));
    return response;
  }) as typeof fetch;
}

test("only configured project Cloudinary HTTPS image delivery URLs are trusted", () => {
  assert.equal(trustedCloudinaryUrl(base, CLOUD), base);
  assert.equal(trustedCloudinaryUrl(second, CLOUD), second);
  const rejected = [
    base.replace("https:", "http:"),
    base.replace("res.cloudinary.com", "other.cloudinary.com"),
    base.replace("res.cloudinary.com", "localhost"),
    base.replace("res.cloudinary.com", "127.0.0.1"),
    base.replace("https://", "https://user:secret@"),
    base.replace("/image/upload/", "/video/upload/"),
    base.replace("/h-auto/growth-logs/", "/someone-else/"),
    base.replace("/image/upload/", "/image/fetch/"),
    base.replace("photo.jpg", "photo.jpg?next=https://evil.example"),
    base.replace("photo.jpg", "photo.jpg#fragment"),
    base.replace("photo.jpg", "..%2fsecret.jpg"),
    "data:image/png;base64,abcd",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "blob:https://example.com/abcd",
    "not a url",
  ];
  for (const url of rejected) assert.equal(trustedCloudinaryUrl(url, CLOUD), null, url);
  assert.equal(trustedCloudinaryUrl(base, ""), null);
  assert.equal(trustedCloudinaryUrl(base, "../wrong"), null);
});

test("thumbnail URL inserts an aspect-preserving bounded transformation", () => {
  const thumbnail = cloudinaryThumbnailUrl(base, CLOUD);
  assert.match(thumbnail, /\/image\/upload\/c_limit,w_600,h_450,q_auto:good,f_jpg\/v123\//);
  assert.equal(new URL(thumbnail).hostname, "res.cloudinary.com");
});

test("selection preserves stored order and total photo count", () => {
  for (const count of [0, 1, 3, 5]) {
    const urls = Array.from({ length: count }, (_, index) => `photo-${index}`);
    const result = selectGrowthLogPhotos(urls);
    assert.deepEqual(result.selected, urls.slice(0, 3));
    assert.equal(result.totalCount, count);
    assert.equal(result.remainingCount, Math.max(0, count - 3));
  }
});

test("JPEG thumbnails are accepted for both JPEG and PNG original upload URLs", async () => {
  const png = await localPng();
  const seen: string[] = [];
  const jpg = await fetchGrowthLogPhoto(base, {
    cloudName: CLOUD,
    fetcher: mockFetch(new Response(validJpeg, { headers: { "content-type": "image/jpeg" } }), seen),
  });
  const image = await fetchGrowthLogPhoto(second, {
    cloudName: CLOUD,
    fetcher: mockFetch(new Response(validJpeg, { headers: { "content-type": "image/jpeg" } }), seen),
  });
  const rejectedPng = await fetchGrowthLogPhoto(second, {
    cloudName: CLOUD,
    fetcher: mockFetch(new Response(png, { headers: { "content-type": "image/png" } })),
  });
  assert.match(jpg.src ?? "", /^data:image\/jpeg;base64,/);
  assert.match(image.src ?? "", /^data:image\/jpeg;base64,/);
  assert.deepEqual(rejectedPng, {});
  assert.equal(seen.length, 2);
  assert.ok(seen.every((url) => url.includes("c_limit,w_600,h_450,q_auto:good,f_jpg")));
});

test("JPEG parser enforces the transformed width and height bounds", async () => {
  for (const [width, height, accepted] of [
    [600, 450, true],
    [601, 450, false],
    [600, 451, false],
  ] as const) {
    const result = await fetchGrowthLogPhoto(base, {
      cloudName: CLOUD,
      fetcher: mockFetch(new Response(Uint8Array.from(jpegWithDimensions(width, height)), { headers: { "content-type": "image/jpeg" } })),
    });
    assert.equal(Boolean(result.src), accepted, `${width}x${height}`);
  }
});

test("untrusted URLs, redirects, non-images, bad signatures, and byte limits become unavailable", async () => {
  let calls = 0;
  const countingFetch = (async () => {
    calls++;
    return new Response(validJpeg, { headers: { "content-type": "image/jpeg" } });
  }) as typeof fetch;
  assert.deepEqual(await fetchGrowthLogPhoto("https://evil.example/photo.jpg", { cloudName: CLOUD, fetcher: countingFetch }), {});
  assert.equal(calls, 0);

  const cases = [
    new Response(null, { status: 302, headers: { location: "https://evil.example/photo.jpg" } }),
    new Response(null, { status: 404 }),
    new Response(validJpeg, { headers: { "content-type": "text/html" } }),
    new Response(invalidPng, { headers: { "content-type": "image/jpeg" } }),
    new Response(invalidPng, { headers: { "content-type": "image/png" } }),
    new Response(validJpeg, { headers: { "content-type": "application/octet-stream" } }),
    new Response(validJpeg, { headers: { "content-type": "image/jpeg", "content-length": "1000" } }),
    new Response(validJpeg, { headers: { "content-type": "image/jpeg" } }),
    new Response(jpeg, { headers: { "content-type": "image/jpeg" } }),
  ];
  for (let index = 0; index < cases.length; index++) {
    const result = await fetchGrowthLogPhoto(base, {
      cloudName: CLOUD,
      fetcher: mockFetch(cases[index]),
      maxBytes: index === 6 ? 100 : index === 7 ? 4 : 1_500_000,
    });
    assert.deepEqual(result, {}, `rejected case ${index}`);
  }
});

test("rejected response bodies are cancelled without replacing unavailable results", async () => {
  const cases = [
    { status: 404, headers: { "content-type": "image/jpeg" } },
    { status: 302, headers: { "content-type": "image/jpeg", location: "https://evil.example" } },
    { status: 200, headers: { "content-type": "image/jpeg", "content-length": "1000" } },
    { status: 200, headers: { "content-type": "text/html" } },
  ];
  for (const { status, headers } of cases) {
    let cancelled = 0;
    const responseHeaders = new Headers();
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) responseHeaders.set(name, value);
    }
    const body = new ReadableStream<Uint8Array>({
      cancel() { cancelled++; },
    });
    const result = await fetchGrowthLogPhoto(base, {
      cloudName: CLOUD,
      maxBytes: 100,
      fetcher: mockFetch(new Response(body, { status, headers: responseHeaders })),
    });
    assert.deepEqual(result, {});
    assert.equal(cancelled, 1, `status ${status}`);
  }

  let overflowCancelled = 0;
  const overflowing = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(validJpeg); },
    cancel() { overflowCancelled++; },
  });
  assert.deepEqual(await fetchGrowthLogPhoto(base, {
    cloudName: CLOUD,
    maxBytes: 10,
    fetcher: mockFetch(new Response(overflowing, { headers: { "content-type": "image/jpeg" } })),
  }), {});
  assert.equal(overflowCancelled, 1);

  let validCancelled = 0;
  const accepted = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(validJpeg); controller.close(); },
    cancel() { validCancelled++; },
  });
  const valid = await fetchGrowthLogPhoto(base, {
    cloudName: CLOUD,
    fetcher: mockFetch(new Response(accepted, { headers: { "content-type": "image/jpeg" } })),
  });
  assert.ok(valid.src);
  assert.equal(validCancelled, 0);

  const cancellationThrows = new ReadableStream<Uint8Array>({
    cancel() { throw new Error("cancel failed"); },
  });
  assert.deepEqual(await fetchGrowthLogPhoto(base, {
    cloudName: CLOUD,
    fetcher: mockFetch(new Response(cancellationThrows, { status: 404 })),
  }), {});
});

test("timeout and one failed photo do not stop valid photos", async () => {
  const hanging = (async (_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })) as typeof fetch;
  assert.deepEqual(await fetchGrowthLogPhoto(base, { cloudName: CLOUD, fetcher: hanging, timeoutMs: 5 }), {});

  const rows = [{ imageCount: 3, imageUrls: [base, "https://evil.example/photo.jpg", second] }];
  const evidence = await prepareGrowthLogPhotoEvidence(rows, {
    cloudName: CLOUD,
    fetcher: (async () => new Response(validJpeg, { headers: { "content-type": "image/jpeg" } })) as typeof fetch,
  });
  assert.equal(evidence[0].length, 3);
  assert.ok(evidence[0][0].src);
  assert.deepEqual(evidence[0][1], {});
  assert.ok(evidence[0][2].src);
});

test("preparation fetches at most three per log and at most four concurrently", async () => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    active++;
    peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, 4));
    active--;
    return new Response(validJpeg, { headers: { "content-type": "image/jpeg" } });
  }) as typeof fetch;
  const evidence = await prepareGrowthLogPhotoEvidence(
    Array.from({ length: 4 }, () => ({ imageCount: 5, imageUrls: [base, base, base, base, base] })),
    { cloudName: CLOUD, fetcher }
  );
  assert.equal(calls, 12);
  assert.equal(peak, 4);
  assert.ok(evidence.every((entry) => entry.length === 3));
});

test("report-wide budget processes fewer, exactly, or more than 48 ordered candidates", async () => {
  assert.equal(MAX_GROWTH_REPORT_PHOTO_FETCHES, 48);
  for (const rowCount of [2, 16, 17]) {
    const urls = Array.from({ length: rowCount }, (_, rowIndex) =>
      Array.from({ length: 3 }, (_, photoIndex) => base.replace("photo.jpg", `photo-${rowIndex}-${photoIndex}.jpg`))
    );
    const rows = urls.map((imageUrls) => ({ imageCount: 3, imageUrls }));
    const seen: string[] = [];
    let active = 0;
    let peak = 0;
    const fetcher = (async (url: RequestInfo | URL) => {
      seen.push(String(url));
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return new Response(validJpeg, { headers: { "content-type": "image/jpeg" } });
    }) as typeof fetch;
    const evidence = await prepareGrowthLogPhotoEvidence(rows, { cloudName: CLOUD, fetcher });
    const candidates = urls.flat();
    const expected = candidates.slice(0, MAX_GROWTH_REPORT_PHOTO_FETCHES)
      .map((url) => cloudinaryThumbnailUrl(url, CLOUD));
    assert.equal(seen.length, expected.length, `${rowCount} logs`);
    assert.deepEqual([...seen].sort(), [...expected].sort());
    assert.ok(peak <= 4);
    assert.equal(evidence.flat().filter((photo) => Boolean(photo.src)).length, expected.length);
    assert.equal(evidence.flat().filter((photo) => photo.omittedFromPdfLimit).length, candidates.length - expected.length);
    if (rowCount === 17) {
      assert.deepEqual(evidence[15].map((photo) => Boolean(photo.src)), [true, true, true]);
      assert.deepEqual(evidence[16], Array.from({ length: 3 }, () => ({ omittedFromPdfLimit: true })));
    }
  }
});

test("budget omissions remain distinct from selected fetch failures", async () => {
  const rows = Array.from({ length: 17 }, (_, index) => ({
    imageCount: 3,
    imageUrls: Array.from({ length: 3 }, (_, photo) => base.replace("photo.jpg", `photo-${index}-${photo}.jpg`)),
  }));
  const failedUrl = cloudinaryThumbnailUrl(rows[0].imageUrls[1], CLOUD);
  let calls = 0;
  const fetcher = (async (url: RequestInfo | URL) => {
    calls++;
    return new Response(String(url) === failedUrl ? invalidPng : validJpeg, {
      headers: { "content-type": "image/jpeg" },
    });
  }) as typeof fetch;
  const evidence = await prepareGrowthLogPhotoEvidence(rows, { cloudName: CLOUD, fetcher });
  assert.equal(calls, 48);
  assert.deepEqual(evidence[0][1], {});
  assert.ok(evidence[0][0].src);
  assert.ok(evidence[15][2].src);
  assert.deepEqual(evidence[16][0], { omittedFromPdfLimit: true });
});
