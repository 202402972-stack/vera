import sharp from "sharp";
import { createHash } from "node:crypto";
import { writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db.js";
export async function saveImportImage(buffer, jobId) {
  if (buffer.length > 10 * 1024 * 1024) throw Error("IMAGE_TOO_LARGE");
  const meta = await sharp(buffer, { limitInputPixels: 40000000 }).metadata();
  if (!["jpeg", "png", "webp", "avif"].includes(meta.format))
    throw Error("IMAGE_INVALID_FORMAT");
  const output = await sharp(buffer, { limitInputPixels: 40000000 })
    .rotate()
    .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const name = createHash("sha256").update(output).digest("hex") + ".webp";
  const dir = jobId
    ? path.join(dataDir, "import-staging", jobId)
    : path.join(dataDir, "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), output, { flag: "w" });
  return { url: "/uploads/" + name, name, bytes: output.length };
}

export async function promoteImages(jobId, images) {
  for (const image of images)
    await copyFile(
      path.join(dataDir, "import-staging", jobId, image.name),
      path.join(dataDir, "uploads", image.name),
    );
  await rm(path.join(dataDir, "import-staging", jobId), {
    recursive: true,
    force: true,
  });
}
