import { NextRequest, NextResponse } from "next/server";

type PendingItem = { id: string; name?: string; location?: string; [k: string]: any };

const STORE: PendingItem[] = (globalThis as any).__HOTBOOK_PENDING_STORE__ ||= [];

function normalize(s: any) {
  if (!s) return "";
  return String(s).trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, location } = body || {};

    let removedCount = 0;

    if (id) {
      const idx = STORE.findIndex((i) => String(i.id) === String(id));
      if (idx !== -1) {
        STORE.splice(idx, 1);
        removedCount++;
      }
    }

    if (name || location) {
      const nName = normalize(name);
      const nLoc = normalize(location);
      // Remove any entries matching both name+location (if provided) or one of them
      for (let i = STORE.length - 1; i >= 0; i--) {
        const it = STORE[i];
        const itName = normalize(it.name);
        const itLoc = normalize(it.location);
        let match = false;
        if (nName && nLoc) {
          match = itName === nName && itLoc === nLoc;
        } else if (nName) {
          match = itName === nName;
        } else if (nLoc) {
          match = itLoc === nLoc;
        }
        if (match) {
          STORE.splice(i, 1);
          removedCount++;
        }
      }
    }

    // deletion performed; avoid logging to console in production

    return NextResponse.json({ success: true, removed: removedCount });
  } catch (err) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
