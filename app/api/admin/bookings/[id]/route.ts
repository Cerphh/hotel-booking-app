import admin from 'firebase-admin';
import { NextResponse } from 'next/server';
import fs from 'fs';

// Initialize Admin SDK using service account JSON from env var
function initAdmin() {
  if (admin.apps.length) return admin;

  // Prefer full JSON in env var, but allow a path to a JSON file for local dev
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let cred: any = null;

  if (svc) {
    try {
      cred = JSON.parse(svc);
    } catch (e) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable (invalid JSON)');
    }
  } else if (svcPath) {
    try {
      const data = fs.readFileSync(svcPath, { encoding: 'utf8' });
      cred = JSON.parse(data);
    } catch (e) {
      throw new Error(`Failed to read or parse service account at FIREBASE_SERVICE_ACCOUNT_PATH=${svcPath}`);
    }
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not set. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH.');
  }

  admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    const body = await req.json();
    const action = body?.action;
    if (!action || (action !== 'accept' && action !== 'reject')) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 });
    }

    const adminApp = initAdmin();
    const db = adminApp.firestore();

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};
    if (action === 'accept') {
      update.status = 'accepted';
      update.acceptedBy = body?.adminEmail || 'server';
      update.acceptedAt = now;
    } else {
      update.status = 'rejected';
      update.rejectedBy = body?.adminEmail || 'server';
      update.rejectedAt = now;
    }

    await db.collection('bookings').doc(id).set(update, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Admin bookings API error:', err?.message || err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
