import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Configure email transporter (using Gmail as example)
// In production, use environment variables for credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your-email@gmail.com
    pass: process.env.EMAIL_APP_PASSWORD, // App-specific password
  },
});

function generateHotelEmailHTML(data: any) {
  const { hotelName, guestName, guestEmail, checkIn, checkOut, guests, rooms, roomType, totalPrice, bookingType, hours, bookingId } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4A70A9, #8FABD4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #4A70A9; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #4A70A9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏨 New Booking Received!</h1>
          <p>You have a new reservation at ${hotelName}</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>You have received a new booking through HotBook. Please review the details below:</p>
          
          <div class="booking-details">
            <h2 style="color: #4A70A9; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span>${bookingId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Name:</span>
              <span>${guestName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Email:</span>
              <span>${guestEmail}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-in:</span>
              <span>${checkIn}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-out:</span>
              <span>${checkOut}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Booking Type:</span>
              <span>${bookingType === 'hourly' ? `Hourly (${hours} hours)` : 'Overnight'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guests:</span>
              <span>${guests}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rooms:</span>
              <span>${rooms}</span>
            </div>
            ${roomType ? `
            <div class="detail-row">
              <span class="detail-label">Room Type:</span>
              <span>${roomType}</span>
            </div>
            ` : ''}
            <div class="detail-row" style="border: none;">
              <span class="detail-label">Total Amount:</span>
              <span style="font-size: 20px; color: #4A70A9; font-weight: bold;">₱${totalPrice.toLocaleString()}</span>
            </div>
          </div>
          
          <p><strong>Action Required:</strong> Please review this booking and take action.</p>
          
          <center>
            <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
              <tr>
                <td style="padding-right: 10px;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/bookings/${bookingId}/accept" 
                     style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    ✓ Accept Booking
                  </a>
                </td>
                <td>
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/bookings/${bookingId}/reject" 
                     style="display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    ✗ Reject Booking
                  </a>
                </td>
              </tr>
            </table>
          </center>
          
          <p style="text-align: center; font-size: 12px; color: #6b7280;">Or manage bookings in your <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin" style="color: #4A70A9;">admin dashboard</a></p>
          
          <div class="footer">
            <p>This is an automated message from HotBook.</p>
            <p>If you have any questions, please contact support.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateGuestEmailHTML(data: any) {
  const { hotelName, guestName, checkIn, checkOut, guests, rooms, roomType, totalPrice, bookingType, hours, bookingId } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4A70A9, #8FABD4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #4A70A9; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .status-badge { display: inline-block; background: #fbbf24; color: #78350f; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Submitted!</h1>
          <p>Your reservation is pending confirmation</p>
        </div>
        <div class="content">
          <p>Hi ${guestName},</p>
          <p>Thank you for booking with HotBook! Your reservation has been submitted and is awaiting confirmation from <strong>${hotelName}</strong>.</p>
          
          <center>
            <span class="status-badge">⏳ PENDING CONFIRMATION</span>
          </center>
          
          <div class="booking-details">
            <h2 style="color: #4A70A9; margin-top: 0;">Your Booking Summary</h2>
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span>${bookingId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Hotel:</span>
              <span>${hotelName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-in:</span>
              <span>${checkIn}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-out:</span>
              <span>${checkOut}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Booking Type:</span>
              <span>${bookingType === 'hourly' ? `Hourly (${hours} hours)` : 'Overnight'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guests:</span>
              <span>${guests}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rooms:</span>
              <span>${rooms}</span>
            </div>
            ${roomType ? `
            <div class="detail-row">
              <span class="detail-label">Room Type:</span>
              <span>${roomType}</span>
            </div>
            ` : ''}
            <div class="detail-row" style="border: none;">
              <span class="detail-label">Total Amount:</span>
              <span style="font-size: 20px; color: #4A70A9; font-weight: bold;">₱${totalPrice.toLocaleString()}</span>
            </div>
          </div>
          
          <p><strong>What's Next?</strong></p>
          <ul>
            <li>The hotel will review your booking request</li>
            <li>You'll receive an email once it's confirmed</li>
            <li>Check your dashboard for real-time updates</li>
          </ul>
          
          <p>You can track your booking status in your dashboard at any time.</p>
          
          <div class="footer">
            <p>Thank you for choosing HotBook!</p>
            <p>Questions? Contact us at support@hotbook.com</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { type, hotelEmail, guestEmail, ...bookingData } = data;

    // Verify email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.error('Email config missing:', {
        hasUser: !!process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_APP_PASSWORD,
      });
      return NextResponse.json(
        { error: 'Email service not configured. Please set EMAIL_USER and EMAIL_APP_PASSWORD environment variables.' },
        { status: 500 }
      );
    }

    console.log('Sending email:', { type, to: type === 'hotel' ? hotelEmail : guestEmail });

    if (type === 'hotel') {
      // Send notification to hotel
      if (!hotelEmail) {
        return NextResponse.json(
          { error: 'Hotel email not provided' },
          { status: 400 }
        );
      }

      await transporter.sendMail({
        from: `"HotBook" <${process.env.EMAIL_USER}>`,
        to: hotelEmail,
        subject: `New Booking - ${bookingData.hotelName}`,
        html: generateHotelEmailHTML(bookingData),
      });

      return NextResponse.json({ success: true, message: 'Hotel notification sent' });
    } else if (type === 'guest') {
      // Send confirmation to guest
      await transporter.sendMail({
        from: `"HotBook" <${process.env.EMAIL_USER}>`,
        to: guestEmail,
        subject: `Booking Confirmation - ${bookingData.hotelName}`,
        html: generateGuestEmailHTML(bookingData),
      });

      return NextResponse.json({ success: true, message: 'Guest confirmation sent' });
    } else {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email sending error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to send email', details: errorMessage },
      { status: 500 }
    );
  }
}
