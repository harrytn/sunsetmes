'use client';

/**
 * components/UserSwitcher.tsx
 *
 * Floating profile switcher bar. Calls POST /api/users/switch to set the
 * HTTP-only session cookie, then reloads the page so server components
 * pick up the new active user.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  pigeonCoins: number;
}

interface Props {
  activeUserId: string;
}

export default function UserSwitcher({ activeUserId }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [switching, setSwitching] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, []);

  async function switchTo(userId: string) {
    if (userId === activeUserId || switching) return;
    setSwitching(true);
    try {
      await fetch('/api/users/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      // Full reload so Next.js server components re-render with new cookie
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  const activeUser = users.find((u) => u.id === activeUserId);
  const otherUsers = users.filter((u) => u.id !== activeUserId);

  if (!activeUser) return null;

  return (
    <div className="relative z-50">
      {/* Active user pill */}
      <motion.button
        className="flex items-center gap-2 px-3 py-1.5 rounded-full glass cursor-pointer"
        whileTap={{ scale: 0.95 }}
        onClick={() => setExpanded((e) => !e)}
        disabled={switching}
        aria-label="Switch user"
        aria-expanded={expanded}
      >
        {/* Avatar circle */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
          style={{ background: activeUser.avatarColor }}
        >
          {activeUser.name[0].toUpperCase()}
        </div>

        <div className="text-left hidden sm:block">
          <div className="font-sans text-xs font-semibold" style={{ color: '#2B4162' }}>
            {activeUser.name}
          </div>
          <div className="font-sans text-[10px]" style={{ color: 'rgba(43,65,98,0.55)' }}>
            🐦 {activeUser.pigeonCoins} coins
          </div>
        </div>

        <motion.span
          className="text-[10px] ml-0.5"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: 'rgba(43,65,98,0.5)' }}
        >
          ▾
        </motion.span>
      </motion.button>

      {/* Dropdown with other users */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute right-0 top-full mt-2 z-50 glass rounded-2xl overflow-hidden shadow-xl min-w-[180px]"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="px-3 pt-3 pb-1">
              <div
                className="font-sans text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(43,65,98,0.45)' }}
              >
                Switch Profile
              </div>
            </div>

            {otherUsers.map((u) => (
              <motion.button
                key={u.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{ background: 'transparent' }}
                whileHover={{ background: 'rgba(26,139,157,0.08)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setExpanded(false);
                  switchTo(u.id);
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ background: u.avatarColor }}
                >
                  {u.name[0].toUpperCase()}
                </div>
                <div>
                  <div
                    className="font-sans text-sm font-medium"
                    style={{ color: '#2B4162' }}
                  >
                    {u.name}
                  </div>
                  <div
                    className="font-sans text-[11px]"
                    style={{ color: 'rgba(43,65,98,0.5)' }}
                  >
                    🐦 {u.pigeonCoins} coins
                  </div>
                </div>
              </motion.button>
            ))}

            {switching && (
              <div className="px-3 py-2 text-center">
                <span
                  className="font-sans text-xs"
                  style={{ color: 'rgba(43,65,98,0.5)' }}
                >
                  Switching…
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
