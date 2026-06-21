import { prisma } from "@/lib/db";

// Logos and signatures are stored directly in the database: they are tiny
// (KBs), which keeps the app on free hosting with no separate file storage,
// and they survive redeploys (Vercel's filesystem is wiped on each deploy).

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"];

export type UploadedImage = { bytes: Uint8Array<ArrayBuffer>; mime: string };

/**
 * Reads and validates an uploaded image from a form.
 * Returns an error code string ("missing" | "toobig" | "badtype") on failure.
 */
export async function readImageFile(
  formData: FormData,
  field: string,
  maxKB: number
): Promise<UploadedImage | "missing" | "toobig" | "badtype"> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return "missing";
  if (file.size > maxKB * 1024) return "toobig";
  if (!IMAGE_MIMES.includes(file.type)) return "badtype";
  return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type };
}

/** Inline data URL for rendering a stored image in server-rendered pages. */
export function dataUrl(
  asset: { bytes: Uint8Array; mime: string } | null | undefined
): string | null {
  if (!asset) return null;
  return `data:${asset.mime};base64,${Buffer.from(asset.bytes).toString("base64")}`;
}

// HEAD_SIGNATURE_PRIMARY = Headteacher (KG & Primary); HEAD_SIGNATURE_JHS = JHS Headmaster/Headmistress.
type SingletonKind = "LOGO" | "HEAD_SIGNATURE_PRIMARY" | "HEAD_SIGNATURE_JHS";

export async function getSingletonImage(kind: SingletonKind) {
  return prisma.imageAsset.findFirst({ where: { kind, teacherId: null } });
}

export async function setSingletonImage(kind: SingletonKind, image: UploadedImage) {
  const existing = await prisma.imageAsset.findFirst({
    where: { kind, teacherId: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.imageAsset.update({
      where: { id: existing.id },
      data: { bytes: image.bytes, mime: image.mime },
    });
  } else {
    await prisma.imageAsset.create({
      data: { kind, bytes: image.bytes, mime: image.mime },
    });
  }
}

export async function deleteSingletonImage(kind: SingletonKind) {
  await prisma.imageAsset.deleteMany({ where: { kind, teacherId: null } });
}

export async function hasLogo(): Promise<boolean> {
  const logo = await prisma.imageAsset.findFirst({
    where: { kind: "LOGO", teacherId: null },
    select: { id: true },
  });
  return logo !== null;
}
