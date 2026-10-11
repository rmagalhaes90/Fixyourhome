import { NextResponse } from "next/server";
import { accountFromRequest } from "../../../lib/accounts";

export async function GET(request: Request) {
  try {
    const account = await accountFromRequest(request);
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ account: null });
  }
}
