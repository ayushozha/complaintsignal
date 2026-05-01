import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, code = "bad_request") {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}
