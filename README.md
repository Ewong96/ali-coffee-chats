# ALI Coffee Chats

A small scheduling app for the ALI eboard. Board members paint their weekly availability, students pick any open time, and the app assigns the least-booked available member and puts a Google Calendar event on that member's calendar with the student as a guest. Google emails both invites.

## How it works

| Who | Where | What they do |
| --- | --- | --- |
| Students | `/` | Pick their class year, then see merged availability for the booking window (currently Sept 7–19, 2026) from members who chat with that year. Pick a 30-minute slot, enter name + email. No login. |
| Eboard | `/member` | Sign in with Google (allow-listed emails only). Set name, role, default meeting spot or Zoom link, and which class years they will chat with. Paint a weekly grid; add per-date overrides; see and cancel upcoming chats; leave feedback on past chats (attended, program, 1–5 fit rating, notes); log chats that happened outside the site. |
| Admin | `/admin` | Add or remove eboard emails, see all upcoming chats, and view or download (CSV) all chat feedback. |

Matching: at booking time the app finds every member free at that slot who accepts the student's class year (weekly rule, minus per-date blocks, minus existing bookings, minus busy time on their Google Calendar) and picks the one with the fewest upcoming chats. Ties are random.

Rules live in [`src/lib/config.ts`](src/lib/config.ts): timezone (US Eastern), slot length, grid hours, the booking window dates (`BOOKING_WINDOW_START` / `BOOKING_WINDOW_END`), lead time, one active booking per student email, and the list of class years (`CLASS_YEARS`). Change the two window dates to run another round.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in AUTH_SECRET (openssl rand -base64 32) and ADMIN_EMAIL
npm run dev
```

Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `.data/`. Migrations run automatically on first request.

To try the eboard side before Google OAuth is configured, set `DEV_LOGIN=true` in `.env.local`. The login page then shows a local-only form that signs you in as any allow-listed email. This is ignored in production. Bookings made this way record a calendar error instead of creating a real event.

## Email notifications (Gmail)

When a student books, the host gets an email with the details (Google Calendar does not notify the owner of events created on their own calendar). If the calendar invite fails, the student is emailed a confirmation too. Emails are sent from a Gmail account through SMTP:

1. On the Gmail account you want to send from, turn on 2-Step Verification (Google Account → Security).
2. Go to https://myaccount.google.com/apppasswords, create an app password named "ALI Coffee Chats", and copy the 16-character code.
3. Set `GMAIL_USER` to that Gmail address and `GMAIL_APP_PASSWORD` to the code (spaces are fine, they are ignored).

If these are not set, booking still works and the skipped email is logged.

## Google Cloud setup (required for real sign-in and calendar invites)

1. Go to https://console.cloud.google.com and create a project (e.g. "ALI Coffee Chats").
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: External, fill in app name and support email. Add scopes:
   - `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.freebusy`
   
   While the app is in **Testing** mode, add every eboard member's Gmail/Workspace address under **Test users** (up to 100). Only they can sign in. Publishing the app for general use requires Google verification because the calendar scope is sensitive; for a club, testing mode is enough.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-DOMAIN/api/auth/callback/google`
5. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

Members grant calendar access the first time they sign in. The refresh token is stored so events can be created later without them being online. If a member revokes access, they see a red banner on `/member` asking them to sign in again.

## Deploying (Vercel + hosted Postgres)

1. Create a free Postgres database on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy the connection string.
2. Push this folder to GitHub and import it in [Vercel](https://vercel.com).
3. Set environment variables in Vercel:
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
   - `ADMIN_EMAIL`
   - `DATABASE_URL`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` (optional, for booking emails)
   - `AUTH_URL` = your deployed origin, e.g. `https://ali-chats.vercel.app`
4. Add the production redirect URI to the Google OAuth client (step 4 above).
5. Deploy. Migrations in `drizzle/` run automatically on first request.

Do not set `DEV_LOGIN` in production.

To test the feedback form locally you need a chat in the past. With the dev server stopped, run `node scripts/seed-past-booking.mjs` to insert one for the admin member.

## Changing the schema

Edit `src/db/schema.ts`, then:

```bash
npx drizzle-kit generate
```

This writes a new SQL file into `drizzle/`, which is applied on next startup.

## Project layout

```
src/app/page.tsx                 student booking page
src/app/book/confirmed/[id]      confirmation page
src/app/member                   eboard dashboard + login
src/app/admin                    admin page
src/app/actions/*.ts             server actions (book, member, admin)
src/lib/availability.ts          open-slot computation and matching inputs
src/lib/google.ts                Google Calendar API (token refresh, free/busy, events)
src/lib/config.ts                club settings
src/db/schema.ts                 database tables
src/auth.ts                      Auth.js config (Google, allow-list, dev login)
```
