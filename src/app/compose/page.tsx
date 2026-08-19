/**
 * app/compose/page.tsx  (Server Component)
 *
 * Fetches active user (with coin balance) and recipient list.
 * Passes to ComposeClient for coin-based delivery.
 */

import { redirect } from 'next/navigation';
import { getActiveUser } from '@/lib/session';
import prisma from '@/lib/prisma';
import ComposeClient from './ComposeClient';

export const metadata = {
  title: 'Write a Letter | Sunset Messages',
};

export default async function ComposePage() {
  const activeUser = await getActiveUser();
  if (!activeUser) redirect('/');

  const recipients = await prisma.user.findMany({
    where: { id: { not: activeUser.id } },
    select: { id: true, name: true, avatarColor: true },
    orderBy: { name: 'asc' },
  });

  if (recipients.length === 0) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="glass rounded-3xl p-8 text-center max-w-sm">
          <div className="text-5xl mb-4">🌅</div>
          <h1
            className="font-serif text-xl font-bold mb-3"
            style={{ color: '#2B4162' }}
          >
            No one to write to
          </h1>
          <p
            className="font-sans text-sm"
            style={{ color: 'rgba(43,65,98,0.65)' }}
          >
            Run{' '}
            <code className="font-mono text-xs bg-white/40 px-1.5 py-0.5 rounded">
              npx prisma db seed
            </code>{' '}
            to create both user profiles.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ComposeClient
      activeUserId={activeUser.id}
      recipients={recipients}
      pigeonCoins={activeUser.pigeonCoins}
    />
  );
}
