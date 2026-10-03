# Sunset Messages

A two-person letter app for Sun and Moon. Letters use standard (14 days), express (7 days), or distance-based pigeon delivery. The displayed pigeon success rate is the chance of arriving on time. A failed roll adds 25% to the flight time; the letter still arrives.

The interface uses a warm paper palette, editorial typography, and an original sunset illustration made with CSS. The owner's reference images are not shipped in the app.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, distinct `SUN_PASSCODE` and `MOON_PASSCODE`, and the push notification keys if needed. Keep `.env` private.
3. Apply the schema with `npx prisma migrate deploy`. For a fresh database, seed the two profiles with `npx prisma db seed`.
4. Start with `npm run dev`.

Each Vercel project has its own environment variables, even when projects deploy the same Git repository. Configure `SUN_PASSCODE`, `MOON_PASSCODE`, and `SESSION_SECRET` in Production on every project whose website or existing home-screen icon is still used, then redeploy that project. The sign-in screen identifies the selected profile and current website. Missing sign-in settings are reported as configuration errors rather than incorrect passwords.

Existing installations with a database created using `prisma db push` have a baseline migration. The connected Neon database was brought into sync and the baseline was marked as applied on October 3, 2026. Do not run the old initial migration against it.

## Privacy and delivery

Each profile requires its own passcode. Session cookies are signed with `SESSION_SECRET`. New letter text and written postal addresses are stored as readable text in the database so either profile can open them without a device key. Anyone with database access can read this letter text. Older encrypted letters are automatically restored when the original browser's saved key is available: the app tries both participants' wrapped keys against every saved key, including the original shared key. The server authenticates and decodes the original letter before saving a permanent readable copy, while preserving the ciphertext and read status. A saved key backup can also be used once. Restoration on either participant's original browser makes the recovered letter readable on all devices. Private keys are never uploaded, generated or replaced during recovery. Safari and installed home-screen apps may use separate storage; recovery must first run in the original browser and website address. Without either participant's original key or a matching backup, ciphertext cannot be recovered. For new pigeon letters, GPS coordinates and the entered destination are used to calculate delivery but are not stored in the letter record. The destination lookup is sent to OpenStreetMap.

The inbox shows a letter once its scheduled arrival time passes, even if the delivery checker has not run. `vercel.json` schedules one daily checker at 21:00 UTC, around 22:00 Lagos time. It sends one inbox reminder per profile when the user did not visit that Lagos day, or when an unread letter arrived after their visit. Vercel Hobby may run the job later within the scheduled hour. Set `CRON_SECRET` and all three VAPID values in production. Each profile must enable browser notifications on its device.

The daily note rotates through 40 one-word prompts at midnight UTC. Both profiles receive the same prompt and can see each other's answer at any time. Old question answers remain available through the PDF download; a local archive is saved under `output/pdf/` and excluded from Git.
