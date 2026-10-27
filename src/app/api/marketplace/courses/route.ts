import { NextRequest, NextResponse } from "next/server";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search") || url.searchParams.get("q");
    const priceType = url.searchParams.get("price_type") || url.searchParams.get("price");

    const courses = await dbAdapter.getCourses({
      category: category || undefined,
      search: search || undefined,
      priceType: (priceType as any) || undefined,
    });

    return NextResponse.json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch marketplace courses" },
      { status: 500 }
    );
  }
}
