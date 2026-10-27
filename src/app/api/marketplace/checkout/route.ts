import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/auth";
import { dbAdapter } from "@/lib/supabase/adapter";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveSessionUser(request);

    const url = new URL(request.url);
    const courseId = url.searchParams.get("course_id") || url.searchParams.get("courseId");
    let studentId = url.searchParams.get("student_id") || url.searchParams.get("studentId") || user.id;

    if (user.role !== "STUDENT" && !url.searchParams.get("student_id")) {
      studentId = "usr_sophia_chen";
    }

    const wallet = await dbAdapter.getWallet(studentId);
    const balanceCents = wallet?.balance_cents ?? 50000;
    const balanceDollars = Number((balanceCents / 100).toFixed(2));

    let isEnrolled = false;
    let courseData: any = null;
    let canAfford = true;

    if (courseId) {
      const course = (await dbAdapter.getCourseById(courseId)) || (await dbAdapter.getCourseBySlug(courseId));
      if (course) {
        courseData = {
          id: course.id,
          title: course.title,
          slug: course.slug,
          price_cents: course.price_cents,
          price_dollars: Number((course.price_cents / 100).toFixed(2)),
          is_published: Boolean(course.is_published),
        };
        isEnrolled = await dbAdapter.isUserEnrolled(studentId, course.id);
        canAfford = balanceCents >= course.price_cents;
      }
    }

    return NextResponse.json({
      success: true,
      student_id: studentId,
      wallet_balance_cents: balanceCents,
      wallet_balance_dollars: balanceDollars,
      course: courseData,
      is_enrolled: isEnrolled,
      can_afford: canAfford,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query wallet status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveSessionUser(request);

    const body = await request.json().catch(() => ({}));
    const { course_id, courseId } = body;
    const targetCourseId = course_id || courseId;

    if (!targetCourseId) {
      return NextResponse.json(
        { success: false, error: "MISSING_COURSE_ID", message: "Course ID is required for checkout" },
        { status: 400 }
      );
    }

    let studentId = user.id;
    if (body.student_id) {
      studentId = body.student_id;
    } else if (body.buyer_id) {
      studentId = body.buyer_id;
    } else if (user.role !== "STUDENT" && !user.id.startsWith("usr_")) {
      studentId = "usr_sophia_chen";
    }

    try {
      const checkoutResult = await dbAdapter.executeCheckout({
        studentId,
        courseId: targetCourseId,
        buyerName: user.name || "Student",
        buyerRole: (user.id === studentId ? user.role : "STUDENT") as any,
      });

      return NextResponse.json({
        success: true,
        ...checkoutResult,
      });
    } catch (err: any) {
      if (err.message === "COURSE_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "COURSE_NOT_FOUND", message: "Course could not be found" },
          { status: 404 }
        );
      }
      if (err.message === "COURSE_NOT_PUBLISHED") {
        return NextResponse.json(
          { success: false, error: "COURSE_NOT_PUBLISHED", message: "Course is in draft mode and not available for purchase" },
          { status: 400 }
        );
      }
      if (err.message === "ALREADY_ENROLLED") {
        return NextResponse.json(
          {
            success: false,
            error: "ALREADY_ENROLLED",
            message: "You are already enrolled in this course",
          },
          { status: 400 }
        );
      }
      if (err.message === "INSUFFICIENT_FUNDS") {
        const wallet = await dbAdapter.getWallet(studentId);
        const course = (await dbAdapter.getCourseById(targetCourseId)) || (await dbAdapter.getCourseBySlug(targetCourseId));
        const currentBalanceCents = wallet?.balance_cents ?? 0;
        const priceCents = course?.price_cents ?? 0;
        const diffDollars = ((priceCents - currentBalanceCents) / 100).toFixed(2);
        return NextResponse.json(
          {
            success: false,
            error: "INSUFFICIENT_FUNDS",
            message: `Insufficient wallet balance. You need $${diffDollars} more to complete this purchase.`,
            current_balance_cents: currentBalanceCents,
            current_balance_dollars: Number((currentBalanceCents / 100).toFixed(2)),
            price_cents: priceCents,
            price_dollars: Number((priceCents / 100).toFixed(2)),
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: err.message || "Failed to complete checkout" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete checkout" },
      { status: 500 }
    );
  }
}
