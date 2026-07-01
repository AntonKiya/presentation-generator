import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const DEFAULT_PRESENTATION_IMAGE_FILE = "images.jpeg";
const DEFAULT_PRESENTATION_ICON_FILE = "icon.png";
let cachedImageDataUrl: string | undefined;
let cachedIconDataUrl: string | undefined;

export function getDefaultPresentationImagePath(): string | undefined {
  return getExistingRootAssetPath(DEFAULT_PRESENTATION_IMAGE_FILE);
}

export function getDefaultPresentationIconPath(): string | undefined {
  return getExistingRootAssetPath(DEFAULT_PRESENTATION_ICON_FILE);
}

export function getDefaultPresentationImageDataUrl(): string | undefined {
  if (cachedImageDataUrl !== undefined) {
    return cachedImageDataUrl;
  }

  const imagePath = getDefaultPresentationImagePath();

  if (!imagePath) {
    return undefined;
  }

  const mimeType = resolveMimeType(imagePath);
  const base64 = readFileSync(imagePath).toString("base64");
  cachedImageDataUrl = `data:${mimeType};base64,${base64}`;

  return cachedImageDataUrl;
}

export function getDefaultPresentationIconDataUrl(): string | undefined {
  if (cachedIconDataUrl !== undefined) {
    return cachedIconDataUrl;
  }

  const iconPath = getDefaultPresentationIconPath();

  if (!iconPath) {
    return undefined;
  }

  const mimeType = resolveMimeType(iconPath);
  const base64 = readFileSync(iconPath).toString("base64");
  cachedIconDataUrl = `data:${mimeType};base64,${base64}`;

  return cachedIconDataUrl;
}

function getExistingRootAssetPath(fileName: string): string | undefined {
  const assetPath = resolve(process.cwd(), fileName);

  return existsSync(assetPath) ? assetPath : undefined;
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
