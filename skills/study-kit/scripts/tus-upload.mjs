#!/usr/bin/env node
// Upload resumable (TUS) video lên Supabase Storage — dùng khi mạng yếu (curl PUT hay đứt).
// Optional: cần `npm i tus-js-client`. Chunk 6MB (bắt buộc với endpoint resumable Supabase).
//
// Dùng:
//   SUPABASE_URL=... SUPABASE_TOKEN=<user JWT> \
//   node tus-upload.mjs --bucket videos --object "<owner_id>/<lesson_id>/video.mp4" --file ./video.mp4
//
// SUPABASE_TOKEN = access token của phiên user (JWT). Với luồng study-kit thông thường, đường B
// mặc định là `request_video_upload` + `curl -X PUT` lên signed URL — script này chỉ là phương án
// dự phòng cho file lớn / mạng chập chờn khi có sẵn token.

import { createReadStream, statSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    bucket: { type: "string" },
    object: { type: "string" },
    file: { type: "string" },
    contentType: { type: "string", default: "video/mp4" },
  },
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const TOKEN = process.env.SUPABASE_TOKEN;
if (!SUPABASE_URL || !TOKEN || !values.bucket || !values.object || !values.file) {
  console.error("Thiếu tham số: cần SUPABASE_URL, SUPABASE_TOKEN (env) + --bucket --object --file");
  process.exit(1);
}

let tus;
try {
  tus = await import("tus-js-client");
} catch {
  console.error("Chưa cài tus-js-client. Chạy: npm i tus-js-client");
  process.exit(1);
}

const file = createReadStream(values.file);
const size = statSync(values.file).size;

await new Promise((resolve, reject) => {
  const upload = new tus.Upload(file, {
    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    uploadLengthDeferred: false,
    uploadSize: size,
    chunkSize: 6 * 1024 * 1024, // 6MB — bắt buộc
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "x-upsert": "true",
    },
    metadata: {
      bucketName: values.bucket,
      objectName: values.object,
      contentType: values.contentType,
      cacheControl: "3600",
    },
    onError: reject,
    onProgress: (sent, total) => {
      process.stdout.write(`\r${((sent / total) * 100).toFixed(1)}%  `);
    },
    onSuccess: () => {
      process.stdout.write("\nXong.\n");
      resolve();
    },
  });
  upload.findPreviousUploads().then((prev) => {
    if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
    upload.start();
  });
});
