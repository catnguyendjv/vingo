import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Canonical authoring guide — tool get_authoring_guide trả nguyên văn.
// Đọc từ content/authoring-guide.md cạnh package (giữ 1 nguồn sự thật, sửa không cần build).
const GUIDE_PATH = fileURLToPath(new URL("../content/authoring-guide.md", import.meta.url));

let cached: string | null = null;

export function getAuthoringGuide(): string {
  if (cached === null) cached = readFileSync(GUIDE_PATH, "utf8");
  return cached;
}
