import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (username === "syn" && password === "password11") {
    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
