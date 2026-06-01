import { NextResponse } from "next/server";
import { getAllTags } from "@/lib/store";

export async function GET() {
  const tags = await getAllTags();
  return NextResponse.json(tags);
}
