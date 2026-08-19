// prisma.config.ts
// Prisma 7 – schema path configuration only.
// The database connection URL is passed directly to the PrismaPg adapter
// at runtime in src/lib/prisma.ts and prisma/seed.ts.
// The datasource.url() is NOT needed here for `prisma generate`.

import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});