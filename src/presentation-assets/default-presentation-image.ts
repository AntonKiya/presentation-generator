import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const DEFAULT_PRESENTATION_IMAGE_FILE = "images.jpeg";
let cachedDataUrl: string | undefined;

export function getDefaultPresentationImagePath(): string | undefined {
  const imagePath = resolve(process.cwd(), DEFAULT_PRESENTATION_IMAGE_FILE);

  return existsSync(imagePath) ? imagePath : undefined;
}

export function getDefaultPresentationImageDataUrl(): string | undefined {
  if (cachedDataUrl !== undefined) {
    return cachedDataUrl;
  }

  const imagePath = getDefaultPresentationImagePath();

  if (!imagePath) {
    return undefined;
  }

  const mimeType = resolveMimeType(imagePath);
  const base64 = readFileSync(imagePath).toString("base64");
  cachedDataUrl = `data:${mimeType};base64,${base64}`;

  return cachedDataUrl;
}

function resolveMimeType(imagePath: string): string {
  const extension = extname(imagePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  return "application/octet-stream";
}
