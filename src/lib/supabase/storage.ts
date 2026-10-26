import { getSupabaseAdminClient } from "./server";

export const MEDIA_BUCKET = "course-media";

export async function uploadMediaFile(
  path: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    // Offline simulated storage fallback
    return { url: `/media/simulated/${path}`, error: null };
  }

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) {
    return { url: null, error: error.message };
  }

  const { data: signedData, error: signError } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24); // 24 hour URL

  if (signError) {
    return { url: null, error: signError.message };
  }

  return { url: signedData.signedUrl, error: null };
}

export async function getMediaSignedUrl(
  path: string,
  expiresInSeconds: number = 3600
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { url: `/media/simulated/${path}`, error: null };
  }

  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl, error: null };
}
