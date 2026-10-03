/**
 * app/page.tsx — Inbox / Home (Server Component)
 *
 * Reads the active user from the session cookie.
 * If no session exists, renders an entry screen to safely set the cookie via Server Action.
 * Fetches the inbox letter list server-side (no content/selfie in the payload).
 */

import { getActiveUser } from "@/lib/session";
import prisma from "@/lib/prisma";
import InboxClient from "./InboxClient";
import ProfileLogin from '@/components/ProfileLogin';

export default async function HomePage() {
  const activeUser = await getActiveUser();

  // ── Bootstrap: if no session, show a beautiful entry screen ─────────────
  if (!activeUser) {
    const profiles = await prisma.user.findMany({
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: 'asc' },
    });

    if (!profiles.length) {
      return (
        <div className="page-shell page-main">
          <h1 className="section-title">Profiles are not ready yet.</h1>
        </div>
      );
    }

    return <ProfileLogin profiles={profiles} />;
  }

  // ── Fetch all other users (for switcher) ──────────────────────────────────
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatarColor: true, pigeonCoins: true },
    orderBy: { name: "asc" },
  });

  // ── Fetch letters: DELIVERED only for recipient (blind delivery), all for sender ──
  const letters = await prisma.letter.findMany({
    where: {
      OR: [
        { recipientId: activeUser.id, OR: [{ status: 'DELIVERED' }, { status: 'IN_FLIGHT', deliverAt: { lte: new Date() } }] },
        { senderId: activeUser.id },
      ],
    },
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      title: true,
      paperStyle: true,
      waxSealColor: true,
      deliveryType: true,
      status: true,
      deliverAt: true,
      openedAt: true,
      distanceKm: true,
      flightDurationSec: true,
      pigeonNote: true,
      destAddress: true,
      createdAt: true,
      sender: { select: { id: true, name: true, avatarColor: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return (
    <InboxClient
      activeUser={activeUser}
      allUsers={allUsers}
      letters={JSON.parse(JSON.stringify(letters.map((letter) => ({
        ...letter,
        status: letter.status === 'IN_FLIGHT' && letter.deliverAt <= now
          ? 'DELIVERED' : letter.status,
      }))))}
    />
  );
}
