# Venoa Consults — Firebase V7 Core Setup

## Implemented in code

1. **Restricted Super Admin**
   - Public Admin registration does not exist.
   - Username is fixed to `admin`.
   - The actual password is never stored in GitHub, HTML, JavaScript, Firestore, or Vercel source.
   - Firebase Authentication owns the password.
   - Firestore and Storage rules authorize only the verified VCS Super Admin email.

2. **Creator authentication**
   - Email/password registration.
   - Mandatory Firebase email verification before the creator application unlocks.
   - Google sign-in.
   - Password reset.
   - Creator profile-photo upload to Firebase Storage.
   - Creator self-service account deletion with re-authentication.

3. **Persistent Firebase data**
   - Firestore collections for creatorProfiles, creatorApplications, creators, brands, reels, digitalPages, campaigns, campaignApplications, leads, portfolioLeads, auditLogs and settings.
   - Firebase Storage paths for creator profile images and portfolio files.
   - No browser-local-storage database is used by V7.

4. **Super Admin operations**
   - Creator review / approval / rejection.
   - Creator edit, public/private visibility and data deletion.
   - Brand CRUD.
   - Reel/video CRUD with Instagram Reel embed links.
   - Digital Page CRUD.
   - Campaign CRUD.
   - Lead management.
   - Portfolio management.
   - Audit log.

## One-time Firebase Console actions required

These cannot be performed by public website code and should remain one-time console operations.

### Authentication

Enable:
- Email/Password
- Google

Add authorized domains:
- `venoaconsults.com`
- `www.venoaconsults.com`
- the active Vercel preview/production domains used for testing

Create the single Super Admin Firebase Authentication account using the VCS Super Admin email. Do **not** create any public Admin-registration flow.

The Super Admin chooses/owns the password directly in Firebase. If the password needs to change, use Firebase password reset. Never commit it to source control.

### Firestore and Storage

Create/enable Cloud Firestore and Cloud Storage, then deploy:

```bash
firebase deploy --only firestore:rules,storage
```

The repository contains `firebase.json`, `firestore.rules`, and `storage.rules`.

## Security model

- Creator email verification is an authentication requirement, not creator approval.
- `APPROVED` does not automatically mean public.
- Public creator publication requires recorded public-profile consent and a Super Admin action.
- Private fields such as phone, email, date of birth, commercials and internal data are not rendered on the public website.
- Admin password is never embedded in client source.
- Public website content remains visible even if Firebase is temporarily unavailable; the routing safety shell is independent from Firebase modules.
