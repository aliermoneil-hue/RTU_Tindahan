/* ============================================================
   CONFIG — public site details
   ============================================================
   Email is no longer handled here. The 6-digit sign-up code is
   sent by the Django backend (see apps/accounts/verification.py)
   and POST /api/v1/auth/register/. There is exactly one email
   path in this project now.
   ============================================================ */

// VARIABLE: SITE
// HOLDS: Public site details for the footer and Need Help section.
// Every value starts empty on purpose. Fill in real, approved details.
// USED BY: Footer, landing page Need Help section (not wired yet).
export const SITE = {
  contactEmail: '',
  contactNote: '',
  privacyUrl: '',
  termsUrl: '',
};
