import sharp from "sharp";

// Display-copy generation only (Task 2.2) — the ORIGINAL upload is never
// touched by this; it stays exactly what's stored and served for Day
// Works vision extraction and Variation Package embedding (which has its
// own separate, larger downscale-at-generation-time logic — unrelated to
// this file). This purely produces a small preview for thread/grid
// thumbnails so casual scrolling doesn't have to download a full 10-20MB
// phone photo just to show a 64px square.
const THUMBNAIL_MAX_DIMENSION = 800;
const THUMBNAIL_QUALITY = 78;

export async function generateThumbnail(original: Uint8Array): Promise<Uint8Array> {
  const buffer = await sharp(original)
    .rotate() // apply EXIF orientation before stripping metadata via resize
    .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // any PNG alpha channel flattens to white, not JPEG's default black
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer();
  return new Uint8Array(buffer);
}
