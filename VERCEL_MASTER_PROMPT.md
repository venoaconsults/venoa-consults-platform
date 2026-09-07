# VCS VERCEL DEPLOYMENT / CODING PROMPT

Use this prompt when handing the project to an AI coding agent or developer.

---

You are deploying and finishing the **Venoa Consults (VCS) Platform** on **Vercel**, not Netlify.

## Mandatory hosting architecture

- Registrar/DNS: GoDaddy
- Production host: Vercel
- Primary domain: `https://www.venoaconsults.com`
- Apex `https://venoaconsults.com` redirects to `https://www.venoaconsults.com`
- Frontend: static HTML/CSS/vanilla JavaScript
- Server API: Vercel Node.js Functions under `/api`
- Authentication: Firebase Authentication
- Business database/CMS: private Google Sheet via Google Apps Script
- Creator/page media: Cloudinary signed uploads
- Campaign forms: Google Forms

## Do not

- do not use Netlify Functions or `/.netlify/functions/*`
- do not expose Google Sheet write access to the browser
- do not expose Firebase service-account JSON
- do not expose Apps Script shared secret
- do not expose Cloudinary API secret
- do not store passwords in Google Sheets
- do not scrape Instagram for follower counts
- do not make admin authorization client-side only

## Vercel file structure

```text
/
  index.html
  about.html
  services.html
  creators.html
  pages.html
  join.html
  join-page.html
  start-campaign.html
  login.html
  portal.html
  admin.html
  privacy.html
  creator-terms.html
  terms.html
  vercel.json
  package.json
  api/
    public-data.js
    submit-creator.js
    submit-page.js
    submit-lead.js
    creator-dashboard.js
    admin-dashboard.js
    admin-action.js
    upload-signature.js
    _lib/
      firebase.js
      appsScript.js
      http.js
  assets/
  css/
  js/
```

## API contract

Use Vercel endpoints:

- `GET /api/public-data?kind=home|creators|pages|brands`
- `POST /api/submit-creator` — verified Firebase user required
- `POST /api/submit-page` — verified Firebase user required
- `POST /api/submit-lead` — public, validate inputs and add spam/rate protection if possible
- `GET /api/creator-dashboard` — verified Firebase user required
- `GET /api/admin-dashboard` — admin required
- `POST /api/admin-action` — admin required
- `GET /api/upload-signature?type=creator|page` — verified Firebase user required

Every authenticated Vercel function must verify the Firebase ID token on the server using `firebase-admin`.

Admin access must require either:
- approved admin custom claim/role, or
- bootstrap super-admin email `venoaconsults@gmail.com`.

## Environment variables

Read server secrets only from Vercel environment variables:

```text
APPS_SCRIPT_URL
APPS_SCRIPT_SHARED_SECRET
FIREBASE_SERVICE_ACCOUNT_JSON
SUPER_ADMIN_EMAILS
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
PUBLIC_SITE_URL
```

## Runtime

Use Node.js 22.x for Vercel Functions.

## Vercel routing

Use `vercel.json` for clean URLs, the special `/join/page` and `/start-a-campaign` rewrites, and security headers.

Do not route `/api/*` to HTML.

## Functional requirements

Preserve the complete VCS product requirements from `docs/MASTER_BUILD_PROMPT.md`, including:

- verified creator accounts
- application IDs and creator IDs
- under-18 guardian workflow
- manual Instagram follower verification
- selected public creator profiles
- page partner onboarding
- VCS admin-only approval
- public live roster counts
- targeted/private campaign opportunities
- Google Forms campaign links
- audit logs
- private rates and private creator data
- brand placeholders until approved brand data is supplied

## Deployment acceptance tests

1. Static public website loads from Vercel.
2. `/api/public-data` returns Apps Script-backed data.
3. Missing Apps Script config produces a server error without leaking secrets.
4. Creator registration works through Firebase.
5. Unverified email cannot submit onboarding.
6. Verified creator can submit exactly one onboarding record.
7. Under-18 submission fails without guardian fields.
8. Non-admin cannot access admin API even if they manually browse `/admin`.
9. Super admin can review and approve creator/page applications.
10. Approval generates permanent VCS ID.
11. Public creator count changes after approval.
12. Creator does not appear publicly unless approval + public consent + publish flag are all true.
13. Targeted/invite-only campaigns are not leaked to unauthorized creators.
14. Client lead form writes to Sheet and triggers VCS notification workflow.
15. GoDaddy custom domain works on HTTPS and existing VCS email DNS records remain intact.

Do not mark the platform production-ready until every acceptance test passes.
