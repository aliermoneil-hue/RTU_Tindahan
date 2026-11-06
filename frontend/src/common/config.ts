/* ============================================================
   CONFIG — mirrors the prototype's js/0-config.js
   ============================================================

   Email settings for the sign-up code (EmailJS).
   1. Make an EmailJS account and connect an email service.
   2. Make an email template. Set "To email" to {{to_email}}.
   3. Paste your Service ID, Template ID and Public Key below.

   While these three are empty, the app runs in DEMO MODE:
   no email is sent and the code is shown on screen.
   ============================================================ */

// VARIABLE: MAIL
// HOLDS: The three EmailJS settings used to email the sign-up code.
// DEFAULT: All three empty -> demo mode (no email sent).
// USED BY: sendMail() (to be wired up in auth/sign-up flow).
export const MAIL = {
  serviceId: '',
  templateId: '',
  publicKey: '',
};

// VARIABLE: SITE
// HOLDS: Public site details for the footer and Need Help section.
// Every value starts empty on purpose. Fill in real, approved details.
// USED BY: Footer, landing page Need Help section.
export const SITE = {
  contactEmail: '',
  contactNote: '',
  privacyUrl: '',
  termsUrl: '',
};

/**
 * sendMail — sends the 6-digit sign-up code via EmailJS.
 * Mirrors the prototype's sendMail() in js/0-config.js.
 *
 * @param to - student's RTU email
 * @param name - first name for the greeting
 * @param code - the 6-digit code
 * @returns { demo: true } when EmailJS is not configured (demo mode)
 *         { demo: false } when email was actually sent
 */
export async function sendMail(to: string, name: string, code: string): Promise<{ demo: boolean }> {
  if (!MAIL.serviceId || !MAIL.templateId || !MAIL.publicKey) {
    return { demo: true };
  }

  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: MAIL.serviceId,
      template_id: MAIL.templateId,
      user_id: MAIL.publicKey,
      template_params: { to_email: to, to_name: name, otp: code, expires: '5 minutes' },
    }),
  });

  if (!r.ok) throw new Error('mail failed: ' + r.status);
  return { demo: false };
}
