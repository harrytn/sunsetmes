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
      <main className="page-shell page-main">
        <div className="panel panel--warm" style={{ maxWidth: 620 }}>
          <h1 className="section-title">No one to write to</h1>
          <p className="body-copy">
            Run{' '}
            <code>
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
