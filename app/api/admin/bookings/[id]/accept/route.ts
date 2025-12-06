import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';
import nodemailer from 'nodemailer';

// Initialize Admin SDK
function initAdmin() {
  if (admin.apps.length) return admin;

  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let cred: any = null;

  if (svc) {
    try {
      cred = JSON.parse(svc);
      // Replace escaped newlines in private key with actual newlines
      if (cred.private_key) {
        cred.private_key = cred.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
    }
  } else if (svcPath) {
    try {
      const data = fs.readFileSync(svcPath, { encoding: 'utf8' });
      cred = JSON.parse(data);
    } catch (e) {
      throw new Error(`Failed to read service account at FIREBASE_SERVICE_ACCOUNT_PATH=${svcPath}`);
    }
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  }

  admin.initializeApp({ credential: admin.credential.cert(cred) });
  return admin;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return new Response(
        `<html><body style="font-family: Arial; padding: 40px; text-align: center;">
          <h2>❌ Error</h2>
          <p>Invalid booking ID</p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const adminApp = initAdmin();
    const db = adminApp.firestore();
    const bookingRef = db.collection('bookings').doc(id);
    
    // Check if booking exists
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return new Response(
        `<html><body style="font-family: Arial; padding: 40px; text-align: center;">
          <h2>❌ Error</h2>
          <p>Booking not found</p>
        </body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const bookingData = bookingSnap.data() || {};
    const currentStatus = bookingData?.status;

    // Check if already processed
    if (currentStatus === 'accepted') {
      return new Response(
        `<html><body style="font-family: Arial; padding: 40px; text-align: center;">
          <h2>✓ Already Accepted</h2>
          <p>This booking was already accepted.</p>
          <p style="margin-top: 20px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin" style="color: #4A70A9;">View Dashboard</a></p>
        </body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (currentStatus === 'rejected') {
      return new Response(
        `<html><body style="font-family: Arial; padding: 40px; text-align: center;">
          <h2>⚠️ Already Rejected</h2>
          <p>This booking was already rejected.</p>
          <p style="margin-top: 20px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin" style="color: #4A70A9;">View Dashboard</a></p>
        </body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Update booking status
    await bookingRef.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedBy: 'hotel-email',
    });

    // Send acceptance email to guest
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
      });

      const acceptanceEmailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #34d399); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #10b981; }
            .status-badge { display: inline-block; background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Booking Confirmed!</h1>
              <p>Your reservation has been accepted</p>
            </div>
            <div class="content">
              <p>Hi ${bookingData.userName || 'Guest'},</p>
              <p>Great news! <strong>${bookingData.hotelName}</strong> has accepted your booking.</p>
              
              <center>
                <span class="status-badge">✓ CONFIRMED</span>
              </center>
              
              <div class="booking-details">
                <h2 style="color: #10b981; margin-top: 0;">Booking Details</h2>
                <div class="detail-row">
                  <span class="detail-label">Hotel:</span>
                  <span>${bookingData.hotelName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Check-in:</span>
                  <span>${bookingData.checkIn}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Check-out:</span>
                  <span>${bookingData.checkOut}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Guests:</span>
                  <span>${bookingData.guests}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Rooms:</span>
                  <span>${bookingData.rooms}</span>
                </div>
                <div class="detail-row" style="border: none;">
                  <span class="detail-label">Total:</span>
                  <span style="font-size: 20px; color: #10b981; font-weight: bold;">₱${bookingData.totalPrice?.toLocaleString()}</span>
                </div>
              </div>
              
              <p>We look forward to welcoming you!</p>
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">If you have any questions, please contact the hotel directly.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: bookingData.userEmail,
        subject: `✓ Booking Confirmed - ${bookingData.hotelName}`,
        html: acceptanceEmailHTML,
      });
    } catch (emailError) {
      console.error('Failed to send acceptance email:', emailError);
      // Continue anyway - booking was updated
    }

    // Return success page
    return new Response(
      `<html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f9fafb; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            h2 { color: #10b981; margin: 0 0 10px 0; }
            p { color: #6b7280; line-height: 1.6; }
            .booking-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #374151; }
            a { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #4A70A9; color: white; text-decoration: none; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h2>Booking Accepted!</h2>
            <p>The booking has been successfully accepted.</p>
            
            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">Hotel:</span>
                <span>${bookingData.hotelName || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Guest:</span>
                <span>${bookingData.userName || bookingData.userEmail || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Check-in:</span>
                <span>${bookingData.checkIn || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Check-out:</span>
                <span>${bookingData.checkOut || 'N/A'}</span>
              </div>
              <div class="detail-row" style="border: none;">
                <span class="detail-label">Total:</span>
                <span style="font-weight: bold; color: #10b981;">₱${bookingData.totalPrice?.toLocaleString() || 'N/A'}</span>
              </div>
            </div>
            
            <p style="font-size: 14px;">The guest will be notified of the acceptance.</p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin">View Dashboard</a>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error accepting booking:', error);
    return new Response(
      `<html><body style="font-family: Arial; padding: 40px; text-align: center;">
        <h2>❌ Error</h2>
        <p>Failed to accept booking. Please try again or contact support.</p>
        <p style="color: #6b7280; font-size: 14px;">${error instanceof Error ? error.message : String(error)}</p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
