/**
 * prisma/seed.ts  –  Sun & Moon edition (Economy Overhaul)
 *
 * Seeds the two profiles only. Letters are composed through the UI.
 * Run with:  npx prisma db seed
 */

import 'dotenv/config';
import { PrismaClient, TransactionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌅  Seeding Sunset Messages — Sun & Moon (Economy Overhaul)…');

  // ── ☀️  User A: Sun ───────────────────────────────────────────────────────
  const sun = await prisma.user.upsert({
    where: { email: 'sun@sunset.local' },
    update: {},
    create: {
      email: 'sun@sunset.local',
      name: 'Sun',
      avatarColor: '#FF512F',
      pigeonCoins: 100,
    },
  });

  // ── 🌙  User B: Moon ──────────────────────────────────────────────────────
  const moon = await prisma.user.upsert({
    where: { email: 'moon@sunset.local' },
    update: {},
    create: {
      email: 'moon@sunset.local',
      name: 'Moon',
      avatarColor: '#8AA3C2',
      pigeonCoins: 100,
    },
  });

  // ── Opening faucet transactions (idempotent) ──────────────────────────────
  for (const user of [sun, moon]) {
    const exists = await prisma.transaction.findFirst({
      where: { userId: user.id, type: TransactionType.FAUCET_REFILL },
    });
    if (!exists) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          amount: 100,
          type: TransactionType.FAUCET_REFILL,
          description: 'Welcome gift – starting balance of 100 PigeonCoins 🐦',
        },
      });
    }
  }

  console.log(`\n✅  Seeded users:`);
  console.log(`   ☀️  ${sun.name}  (${sun.email})  – ${sun.pigeonCoins} PigeonCoins`);
  console.log(`   🌙  ${moon.name} (${moon.email}) – ${moon.pigeonCoins} PigeonCoins`);
  console.log(`\n📝  Compose letters through the UI after RSA keys are initialised.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
