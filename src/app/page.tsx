/**
 * app/page.tsx — Inbox / Home (Server Component)
 *
 * Reads the active user from the session cookie.
 * If no session exists, renders an entry screen to safely set the cookie via Server Action.
 * Fetches the inbox letter list server-side (no content/selfie in the payload).
 */

import { getActiveUser, setActiveUserCookie } from "@/lib/session";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import InboxClient from "./InboxClient";

export default async function HomePage() {
  const activeUser = await getActiveUser();

  // ── Bootstrap: if no session, show a beautiful entry screen ─────────────
  if (!activeUser) {
    const firstUser = await prisma.user.findFirst({ orderBy: { name: "asc" } });

    if (!firstUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#8AA3C2] to-[#FFD194]">
          <h1 className="text-2xl text-[#2B4162] font-serif">Database not seeded.</h1>
        </div>
      );
    }

    // Next.js Server Action: Safely sets the cookie when the button is clicked
    async function startApp() {
      "use server";
      await setActiveUserCookie(firstUser!.id);
      redirect("/");
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#8AA3C2] to-[#FFD194] px-4 text-center">
        <h1 className="text-4xl text-[#2B4162] font-serif mb-4 drop-shadow-sm">Sunset Messages</h1>
        <p className="text-[#2B4162] font-sans mb-8 opacity-80 max-w-xs">
          Welcome! Tap below to enter your inbox.
        </p>
        <form action={startApp}>
          <button
            type="submit"
            className="px-8 py-4 bg-[#FF512F] text-[#FDF5E6] font-sans font-bold text-lg rounded-full shadow-[0_10px_30px_-10px_rgba(255,81,47,0.5)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            Enter Inbox
          </button>
        </form>
      </div>
    );
  }

  // ── Fetch all other users (for switcher) ──────────────────────────────────
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatarColor: true, pigeonCoins: true },
    orderBy: { name: "asc" },
  });

  // ── Fetch letters for both Inbox and Outbox (NO content fields) ────────
  const letters = await prisma.letter.findMany({
    where: {
      OR: [
        { recipientId: activeUser.id, status: { not: 'RETURNED' } },
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
      pigeonSurvived: true,
      pigeonNote: true,
      destAddress: true,
      createdAt: true,
      sender: { select: { id: true, name: true, avatarColor: true } },
      recipient: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <InboxClient
      activeUser={activeUser}
      allUsers={allUsers}
      letters={JSON.parse(JSON.stringify(letters))}
    />
  );
}