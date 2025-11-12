"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export function TermsAndConditionsDialog({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
          <DialogDescription>
            Please read our terms carefully before using Hotbook
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
            <section>
              <h3 className="font-bold text-base mb-2">1. Hotel Booking Services</h3>
              <p>
                Hotbook provides an online platform for booking hotel accommodations. By using our service, you agree to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide accurate and complete information during booking</li>
                <li>Be at least 18 years old to make reservations</li>
                <li>Accept responsibility for all charges associated with your booking</li>
                <li>Comply with hotel cancellation and modification policies</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">2. User Responsibilities</h3>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials. You agree not to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Share your login information with third parties</li>
                <li>Use the platform for unlawful purposes</li>
                <li>Engage in fraudulent or deceptive booking practices</li>
                <li>Manipulate prices or exploit system vulnerabilities</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">3. Payment and Cancellation</h3>
              <p>
                All bookings must be paid through our secure payment gateway. Payment terms:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Prices are confirmed at the time of booking</li>
                <li>Cancellations are subject to hotel-specific policies</li>
                <li>Refunds are processed within 5-7 business days</li>
                <li>Changes to bookings may incur additional fees</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">4. Privacy & Data Protection</h3>
              <p>
                Your personal data is collected and processed in accordance with our Privacy Policy:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>We collect name, email, and payment information</li>
                <li>Data is encrypted and stored securely</li>
                <li>We do not share personal data with third parties without consent</li>
                <li>You have the right to access, update, or delete your data</li>
                <li>We comply with GDPR and international data protection laws</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">5. Limitation of Liability</h3>
              <p>
                Hotbook is provided "as is" without warranties. We are not liable for:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Service interruptions or technical failures</li>
                <li>Hotel availability or service quality issues</li>
                <li>Lost profits or indirect damages</li>
                <li>Third-party actions or content</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">6. Disputes and Complaints</h3>
              <p>
                For booking disputes or complaints, please contact us at support@hotbook.com. We will respond within 48 hours.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">7. Account Termination</h3>
              <p>
                We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">8. Changes to Terms</h3>
              <p>
                We may update these terms at any time. Continued use of the platform indicates acceptance of updated terms.
              </p>
            </section>

            <section>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Last updated: November 2025
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
  );
}
