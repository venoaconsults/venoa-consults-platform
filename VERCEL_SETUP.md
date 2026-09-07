# Vercel Setup — Venoa Consults

This package has been converted from Netlify Functions to **Vercel Functions**.

## Recommended deployment method: GitHub → Vercel

### 1. Create the GitHub repository

Create a private repository, for example:

`venoa-consults-platform`

Upload the **contents of this folder** to the repository root. Do not upload the ZIP as a single file.

The root should contain:

```text
index.html
vercel.json
package.json
api/
assets/
css/
js/
apps-script/
docs/
...
```

### 2. Import into Vercel

1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub repository.
4. Framework Preset: choose **Other** if Vercel does not detect one.
5. Root Directory: repository root.
6. Build Command: leave blank / no build required.
7. Output Directory: leave blank.
8. Install Command: Vercel may run `npm install` automatically because `package.json` exists.
9. Deploy.

The first deployment should produce a temporary `*.vercel.app` address.

## 3. Environment variables

In Vercel Project → **Settings → Environment Variables**, add:

- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_SHARED_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `SUPER_ADMIN_EMAILS=venoaconsults@gmail.com`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PUBLIC_SITE_URL=https://www.venoaconsults.com`

Apply them to **Production** and, while testing, **Preview**.

After changing environment variables, redeploy.

Never put the Apps Script secret, Firebase service account JSON, or Cloudinary API secret in browser code.

## 4. Firebase browser configuration

Edit:

`js/firebase-config.js`

with the Firebase **Web App config** from Firebase Console.

This is client configuration; do not put the Firebase service-account JSON in this file.

In Firebase Authentication → Settings → Authorized domains, add:

- your Vercel preview/production host while testing
- `venoaconsults.com`
- `www.venoaconsults.com`

## 5. Test the Vercel deployment before connecting GoDaddy

Verify:

- `/` loads
- `/join` loads
- `/login` loads
- `/api/public-data?kind=home` returns JSON
- creator sign-up sends Firebase verification email
- unverified creator cannot submit onboarding
- admin API rejects a non-admin user
- admin Google login works for `venoaconsults@gmail.com`
- client lead reaches Google Sheet after Apps Script is configured

## 6. Connect the GoDaddy domain

In Vercel Project → **Settings → Domains**:

1. Add `www.venoaconsults.com`.
2. Add `venoaconsults.com` too.
3. Make `www.venoaconsults.com` the primary production domain.
4. Configure the apex domain to redirect to `www`.
5. Vercel will show the exact DNS records required.

In GoDaddy → Domain → DNS:

- for `www`, add/replace the CNAME with the exact target Vercel displays;
- for the apex `@`, add/replace the A record with the exact Vercel value displayed for your project;
- preserve all MX/TXT/SPF/DKIM/DMARC records used by `info@venoaconsults.com` and `marketing@venoaconsults.com`.

Do **not** change nameservers unless you intentionally want Vercel to manage all DNS.

Vercel automatically provisions HTTPS after DNS verification.

## 7. Function region

After deployment, open Vercel Project → Settings → Functions and choose the region closest to the services/users when the option is available. For VCS, an India/Asia-adjacent region is preferable to a distant region, but verify the available region list in your Vercel account rather than hard-coding a region.

## 8. Production verification

After `www.venoaconsults.com` is active, retest:

- Firebase registration / login
- Google admin login
- Apps Script data
- Cloudinary upload signing
- client lead submission
- creator approval
- public creator counter
- page approval
- campaign access
- Google Form links

## Vercel API mapping

Old Netlify path → Vercel path:

```text
/.netlify/functions/public-data       → /api/public-data
/.netlify/functions/submit-creator    → /api/submit-creator
/.netlify/functions/submit-page       → /api/submit-page
/.netlify/functions/submit-lead       → /api/submit-lead
/.netlify/functions/creator-dashboard → /api/creator-dashboard
/.netlify/functions/admin-dashboard   → /api/admin-dashboard
/.netlify/functions/admin-action      → /api/admin-action
/.netlify/functions/upload-signature  → /api/upload-signature
```
