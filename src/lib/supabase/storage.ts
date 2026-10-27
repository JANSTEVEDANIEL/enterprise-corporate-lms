import { getSupabaseAdminClient } from "./server";

export const BUCKET_COURSE_MATERIALS = "course-materials";
export const BUCKET_LESSON_VIDEOS = "lesson-videos";
export const BUCKET_COURSE_MEDIA = "course-media";
export const MEDIA_BUCKET = BUCKET_COURSE_MATERIALS;

/**
 * Uploads supplementary materials (PDF, ZIP, slides, documents) to the public bucket.
 */
export async function uploadCourseMaterial(
  path: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string | null; path: string; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { url: `/media/simulated/${path}`, path, error: null };
  }

  const { error } = await client.storage
    .from(BUCKET_COURSE_MATERIALS)
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) {
    return { url: null, path, error: error.message };
  }

  const { data } = client.storage.from(BUCKET_COURSE_MATERIALS).getPublicUrl(path);
  return { url: data.publicUrl, path, error: null };
}

/**
 * Uploads lesson video files to the private bucket.
 */
export async function uploadLessonVideo(
  path: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ path: string; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { path, error: null };
  }

  const { error } = await client.storage
    .from(BUCKET_LESSON_VIDEOS)
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) {
    return { path, error: error.message };
  }

  return { path, error: null };
}

/**
 * Generates a signed streaming URL for a private video file, ensuring
 * that callers have already cleared the Creator Content Privacy Shield.
 */
export async function getVideoSignedUrl(
  path: string,
  expiresInSeconds: number = 3600
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { url: `/media/simulated/${path}`, error: null };
  }

  const { data, error } = await client.storage
    .from(BUCKET_LESSON_VIDEOS)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.signedUrl, error: null };
}

/**
 * Retrieves the public URL for a course material file.
 */
export function getCourseMaterialPublicUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ldnvbephtdnignivbgra.supabase.co";
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_COURSE_MATERIALS}/${path}`;
}

/**
 * Legacy compatible upload helper used across existing endpoints and tests.
 */
export async function uploadMediaFile(
  path: string,
  fileBuffer: Buffer,
  contentType: string,
  bucketName: string = BUCKET_COURSE_MATERIALS
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { url: `/media/simulated/${path}`, error: null };
  }

  const { error } = await client.storage
    .from(bucketName)
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) {
    return { url: null, error: error.message };
  }

  if (bucketName === BUCKET_COURSE_MATERIALS || bucketName === BUCKET_COURSE_MEDIA) {
    const { data } = client.storage.from(bucketName).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  const { data: signedData, error: signError } = await client.storage
    .from(bucketName)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (signError) {
    return { url: null, error: signError.message };
  }

  return { url: signedData.signedUrl, error: null };
}

/**
 * Legacy compatible signed URL helper.
 */
export async function getMediaSignedUrl(
  path: string,
  expiresInSeconds: number = 3600,
  bucketName: string = BUCKET_LESSON_VIDEOS
): Promise<{ url: string | null; error: string | null }> {
  return getVideoSignedUrl(path, expiresInSeconds);
}
