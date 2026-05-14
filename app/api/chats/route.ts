import { NextResponse } from "next/server";
import { broadcast } from "@/lib/events";
import { createChat, getChats } from "@/lib/store";

export async function GET() {
  const chats = await getChats();
  return NextResponse.json(chats);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Chat name is required" }, { status: 400 });
  }

  const chat = await createChat({
    name,
    avatar: body.avatar,
    avatarType: body.avatarType
  });

  broadcast({ type: "chat-created", chat });
  return NextResponse.json(chat, { status: 201 });
}
