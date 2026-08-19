/**
 * scripts/generate-vapid.mjs
 *
 * Generates a fresh VAPID key pair and prints the values to stdout.
 * Run once:  node scripts/generate-vapid.mjs
 * Then copy the output into your .env file.
 */

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\n🔑  VAPID Keys generated — paste these into your .env:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:you@yourdomain.com"`);
console.log(`CRON_SECRET="$(openssl rand -hex 32)"  ← replace with a real random value\n`);
console.log('⚠️  Keep VAPID_PRIVATE_KEY and CRON_SECRET secret — never commit them to git.\n');
