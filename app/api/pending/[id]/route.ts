import { NextRequest, NextResponse } from "next/server";

// Access the same module-scoped store defined in parent module via import.
// Because app router creates separate modules per file, re-declare a minimal
// compatible access by reading from the parent store using globalThis if available.

type PendingItem = {
  id: string;
  [k: string]: any;
};

// Try to access shared store if present; otherwise create a fallback store per-file.
const SHARED: PendingItem[] = (globalThis as any).__HOTBOOK_PENDING_STORE__ ||= [];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = SHARED.find((i) => String(i.id) === String(id));
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idx = SHARED.findIndex((i) => String(i.id) === String(id));
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  const removed = SHARED.splice(idx, 1);
  // deletion performed; no console logging in production
  return NextResponse.json({ success: true });
}
