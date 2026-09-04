import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { serviceClient } from "./supabase.js";

const bucket = config.storageBucket;

// Path chuẩn do server tự dựng — KHÔNG bao giờ nhận từ client.
export const videoPath = (ownerId: string, lessonId: string) => `${ownerId}/${lessonId}/video.mp4`;
export const thumbPath = (ownerId: string, lessonId: string) => `${ownerId}/${lessonId}/thumb.jpg`;

export async function createSignedUpload(path: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await serviceClient().storage.from(bucket).createSignedUploadUrl(path, {
    upsert: true,
  });
  if (error || !data) throw new Error(`createSignedUpload: ${error?.message}`);
  return { signedUrl: data.signedUrl, token: data.token };
}

export interface ObjectInfo {
  size: number;
  contentType: string | null;
}

// Metadata object qua list folder (tránh phụ thuộc .info không có ở mọi phiên bản).
export async function getObjectInfo(path: string): Promise<ObjectInfo | null> {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await serviceClient().storage.from(bucket).list(folder, { search: name });
  if (error) throw new Error(`getObjectInfo: ${error.message}`);
  const found = data?.find((o) => o.name === name);
  if (!found) return null;
  const meta = (found.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: meta.size ?? 0, contentType: meta.mimetype ?? null };
}

export async function downloadTo(path: string, destPath: string): Promise<void> {
  const { data, error } = await serviceClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`downloadTo: ${error?.message}`);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
}

export async function uploadFrom(path: string, localPath: string, contentType: string): Promise<void> {
  const body = await readFile(localPath);
  const { error } = await serviceClient()
    .storage.from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`uploadFrom: ${error.message}`);
}
