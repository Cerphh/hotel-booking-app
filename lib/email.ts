/**
 * Email notification utility using Nodemailer
 * Sends booking notifications to hotels and confirmation emails to guests
 */

interface BookingEmailData {
  hotelName: string;
  hotelEmail?: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  roomType?: string;
  totalPrice: number;
  bookingType: string;
  hours?: number;
  bookingId: string;
}

/**
 * Send booking notification email to hotel
 */
export async function sendHotelNotification(data: BookingEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Call the API route to send email
    const response = await fetch('/api/send-booking-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'hotel',
        ...data,
      }),
    });

    const result = await response.json();
    return { success: response.ok, error: result.error };
  } catch (error) {
    console.error('Failed to send hotel notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send booking confirmation email to guest
 */
export async function sendGuestConfirmation(data: BookingEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-booking-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'guest',
        ...data,
      }),
    });

    const result = await response.json();
    return { success: response.ok, error: result.error };
  } catch (error) {
    console.error('Failed to send guest confirmation:', error);
    return { success: false, error: String(error) };
  }
}
