# Sunset Messages

A two-person letter app for Sun and Moon. Letters use standard (14 days), express (7 days), or distance-based pigeon delivery. The displayed pigeon success rate is the chance of arriving on time. A failed roll adds 25% to the flight time; the letter still arrives.

The interface uses a warm paper palette, editorial typography, and an original sunset illustration made with CSS. The owner's reference images are not shipped in the app.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, distinct `SUN_PASSCODE` and `MOON_PASSCODE`, and the push notification keys if needed. Keep `.env` private.
3. Apply the schema with `npx prisma migrate deploy`. For a fresh database, seed the two profiles with `npx prisma db seed`.
4. Start with `npm run dev`.

Existing installations with a database created using `prisma db push` have a baseline migration. The connected Neon database was brought into sync and the baseline was marked as applied on October 3, 2026. Do not run the old initial migration against it.

## Privacy and delivery

Each profile requires its own passcode. Session cookies are signed with `SESSION_SECRET`. The letter body and written postal addresses are encrypted in the browser. Letter subjects, delivery dates, sender and recipient identities, and route distance are readable metadata. For new pigeon letters, GPS coordinates and the entered destination are used to calculate delivery but are not stored in the letter record. The destination lookup is sent to OpenStreetMap.

Encryption keys are stored per profile in the browser. Back up each profile's key from the app before moving to another device. Restoring a backup restores the matching public and private key.

The inbox shows a letter once its scheduled arrival time passes, even if the delivery checker has not run. `vercel.json` schedules one daily checker at 21:00 UTC, around 22:00 Lagos time. It sends one inbox reminder per profile when the user did not visit that Lagos day, or when an unread letter arrived after their visit. Vercel Hobby may run the job later within the scheduled hour. Set `CRON_SECRET` and all three VAPID values in production. Each profile must enable browser notifications on its device.

The daily note rotates through 40 one-word prompts at midnight UTC. Both profiles receive the same prompt and can see each other's answer at any time. Old question answers remain available through the PDF download; a local archive is saved under `output/pdf/` and excluded from Git.
