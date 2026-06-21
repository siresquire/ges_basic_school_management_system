import { prisma } from "@/lib/db";

/** Serves the uploaded school logo (used as <img src="/logo">). */
export async function GET() {
  const logo = await prisma.imageAsset.findFirst({
    where: { kind: "LOGO", teacherId: null },
  });
  if (!logo) return new Response("No logo uploaded", { status: 404 });

  return new Response(Buffer.from(logo.bytes), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=300",
    },
  });
}
