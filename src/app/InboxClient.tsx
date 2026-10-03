'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import UserSwitcher from '@/components/UserSwitcher';
import NotificationPrompt from '@/components/NotificationPrompt';
import DailyMoodWidget from '@/components/DailyMoodWidget';
import LegacyLetterRecovery from '@/components/LegacyLetterRecovery';
import { recordDailyVisit } from '@/lib/daily-visit';

type Profile = { id: string; name: string; email: string; avatarColor: string; pigeonCoins: number };
type Letter = {
  id: string; senderId: string; recipientId: string; title: string;
  deliveryType: 'STANDARD' | 'EXPRESS' | 'PIGEON';
  status: 'IN_FLIGHT' | 'DELIVERED' | 'DRAFT' | 'LOST' | 'RETURNED';
  deliverAt: string; openedAt: string | null; createdAt: string;
  sender: { name: string }; recipient: { name: string };
};

function letterStatus(letter: Letter, isOutbox: boolean) {
  if (letter.status === 'RETURNED' || letter.status === 'LOST') return 'Returned';
  if (new Date(letter.deliverAt).getTime() > Date.now()) return 'On its way';
  if (letter.openedAt) return 'Opened';
  return isOutbox ? 'Delivered' : 'Unread';
}

function LetterRow({ letter, isOutbox }: { letter: Letter; isOutbox: boolean }) {
  const person = isOutbox ? letter.recipient.name : letter.sender.name;
  const status = letterStatus(letter, isOutbox);
  return <Link className="letter-item" href={`/letter/${letter.id}`}>
    <span className="letter-item__mark" aria-hidden="true">{person.slice(0, 1).toUpperCase()}</span>
    <span style={{ minWidth: 0 }}>
      <span className="eyebrow" style={{ fontSize: 11 }}>{isOutbox ? `To ${person}` : `From ${person}`} · {letter.deliveryType.toLowerCase()}</span>
      <span className="letter-item__title" style={{ display: 'block' }}>{letter.title}</span>
      <span className="letter-item__meta">{new Date(letter.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
    </span>
    <span className="letter-item__status">{status}</span>
  </Link>;
}

export default function InboxClient({ activeUser, allUsers, letters, legacyLetterCount }: { activeUser: Profile; allUsers: Profile[]; letters: Letter[]; legacyLetterCount: number }) {
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');
  const [coins, setCoins] = useState(activeUser.pigeonCoins);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);

  const inbox = letters.filter(letter => letter.recipientId === activeUser.id);
  const outbox = letters.filter(letter => letter.senderId === activeUser.id);
  const unread = inbox.filter(letter => !letter.openedAt).length;
  const visible = tab === 'inbox' ? inbox : outbox;

  useEffect(() => {
    void recordDailyVisit(activeUser.id).then(result => {
      if (!result) return;
      setCoins(result.pigeonCoins);
      if (result.granted) setCheckinMessage(result.message ?? `You received ${result.granted} PigeonCoins today.`);
    }).catch(() => {});
  }, [activeUser.id]);

  return <div style={{ minHeight: '100dvh' }}>
    <header className="site-header safe-top">
      <div className="page-shell site-header__inner">
        <div className="brand"><span className="brand__name">Sunset Messages</span><span className="brand__tag">Letters worth waiting for</span></div>
        <div className="header-actions">
          <span className="small-copy" style={{ marginRight: 8 }}>{coins} PigeonCoins</span>
          <UserSwitcher activeUserId={activeUser.id} users={allUsers} />
        </div>
      </div>
    </header>

    <main className="page-shell page-main">
      <section className="inbox-hero">
        <div className="inbox-hero__copy">
          <p className="eyebrow">The Sunset Post · Private correspondence</p>
          <h1 className="display-title" style={{ maxWidth: 690 }}>Words that arrive in their own time.</h1>
          <p className="body-copy" style={{ marginBottom: 0 }}>{unread ? `${unread} unread ${unread === 1 ? 'letter is' : 'letters are'} waiting for you.` : 'Take a moment. Your next letter will be here when it arrives.'}</p>
          <Link href="/compose" className="action action--primary">Write a letter <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="inbox-hero__art" aria-hidden="true"><span className="inbox-hero__art-label">POSTMARK<br />SUNSET / 26</span><span className="inbox-hero__art-sun" /><span className="inbox-hero__art-line" /><span className="inbox-hero__art-caption">from here<br />to you.</span></div>
      </section>

      {checkinMessage && <p role="status" className="status-note" style={{ marginBottom: 16 }}>{checkinMessage}</p>}
      <NotificationPrompt activeUserId={activeUser.id} />
      {legacyLetterCount > 0 && <LegacyLetterRecovery key={activeUser.id} activeUserId={activeUser.id} />}

      <div className="inbox-grid">
        <section style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
            <div><p className="eyebrow">The post</p><h2 className="section-title">Your letters</h2></div>
            <div className="tab-row" role="tablist" aria-label="Letters">
              <button className="tab" role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}>Inbox {inbox.length}</button>
              <button className="tab" role="tab" aria-selected={tab === 'outbox'} onClick={() => setTab('outbox')}>Sent {outbox.length}</button>
            </div>
          </div>
          {visible.length ? <div className="letter-list">{visible.map(letter => <LetterRow key={letter.id} letter={letter} isOutbox={tab === 'outbox'} />)}</div>
            : <div className="panel panel--quiet"><h3 className="section-title" style={{ fontSize: 25 }}>{tab === 'inbox' ? 'Nothing here yet' : 'Your first letter starts here'}</h3><p className="body-copy">{tab === 'inbox' ? 'Letters sent to you will appear when their journey is complete.' : 'Write something you would like your person to keep.'}</p>{tab === 'outbox' && <Link className="text-link" href="/compose">Write a letter</Link>}</div>}
        </section>
        <aside style={{ minWidth: 0 }}><DailyMoodWidget activeUserId={activeUser.id} /></aside>
      </div>
    </main>
  </div>;
}
