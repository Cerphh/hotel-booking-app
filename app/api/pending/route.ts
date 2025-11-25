import { NextRequest, NextResponse } from "next/server";

// In-memory pending store — ephemeral. Not suitable for multi-instance or production.
type PendingItem = {
  id: string;
  name?: string;
  location?: string;
  price?: number;
  roomsAvailable?: number;
  image?: string;
  amenities?: string[];
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  [k: string]: any;
};

// Shared store on globalThis so sibling route modules can access the same array
const STORE: PendingItem[] = (globalThis as any).__HOTBOOK_PENDING_STORE__ ||= [];

export async function GET() {
  return NextResponse.json(STORE);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const item: PendingItem = { id, createdAt: new Date().toISOString(), ...body };
    STORE.unshift(item);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
