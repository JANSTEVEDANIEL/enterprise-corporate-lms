import { NextRequest, NextResponse } from "next/server";
import { uploadMediaFile } from "@/lib/supabase/storage";
import { randomUUID } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. Multipart Form Data Upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const typeHint = (formData.get("type") as string) || "DOCUMENT";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided in form data" },
          { status: 400 }
        );
      }

      const originalName = file.name || "upload.bin";
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const isVideo = typeHint === "VIDEO" || file.type.startsWith("video/");
      const ext = originalName.includes(".") ? originalName.split(".").pop() : (isVideo ? "mp4" : "bin");
      const bucketName = isVideo ? "lesson-videos" : "course-materials";
      const storageKey = isVideo
        ? `videos/${randomUUID().slice(0, 8)}_${Date.now()}.${ext}`
        : `materials/${randomUUID().slice(0, 8)}_${Date.now()}.${ext}`;

      const { url, error } = await uploadMediaFile(
        storageKey,
        buffer,
        file.type || (isVideo ? "video/mp4" : "application/octet-stream"),
        bucketName
      );

      if (error && !url) {
        return NextResponse.json({ success: false, error }, { status: 500 });
      }

      let detectedType: "PDF" | "ZIP" | "DOCUMENT" | "OTHER" = "OTHER";
      const lower = originalName.toLowerCase();
      if (lower.endsWith(".pdf")) detectedType = "PDF";
      else if (lower.endsWith(".zip") || lower.endsWith(".tar") || lower.endsWith(".gz")) detectedType = "ZIP";
      else if (lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".txt") || lower.endsWith(".md")) detectedType = "DOCUMENT";

      return NextResponse.json({
        success: true,
        url: url || `/media/simulated/${storageKey}`,
        name: originalName,
        size_bytes: file.size || buffer.length,
        file_type: detectedType,
      });
    }

    // 2. Direct JSON configuration (e.g. video URL or external link)
    const body = await request.json().catch(() => ({}));
    const { url, name, size_bytes = 0, file_type } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing required field: url" },
        { status: 400 }
      );
    }

    let detectedType: "PDF" | "ZIP" | "DOCUMENT" | "OTHER" = file_type || "OTHER";
    const lower = url.toLowerCase();
    if (lower.endsWith(".pdf")) detectedType = "PDF";
    else if (lower.endsWith(".zip")) detectedType = "ZIP";
    else if (lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".md")) detectedType = "DOCUMENT";

    const fileName = name || url.split("/").pop()?.split("?")[0] || "downloadable-resource";

    return NextResponse.json({
      success: true,
      url,
      name: fileName,
      size_bytes: Number(size_bytes) || 1048576,
      file_type: detectedType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process media upload" },
      { status: 500 }
    );
  }
}
