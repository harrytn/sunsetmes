'use client';

import { useCallback, useEffect, useState } from 'react';

type Mood = { userId: string; word: string; user: { name: string } };
type Prompt = { question: string; number: number; total: number };

export default function DailyMoodWidget({ activeUserId }: { activeUserId: string }) {
  const [moods, setMoods] = useState<Mood[]>([]);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/moods');
      if (!response.ok) throw new Error('Could not load today’s moods.');
      const data = await response.json();
      setMoods(data.moods);
      setDate(data.date);
      setPrompt(data.prompt);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load moods.'); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!date) return;
    const timer = window.setTimeout(() => void refresh(), Math.max(0, Date.parse(date) + 86_400_000 - Date.now() + 500));
    return () => window.clearTimeout(timer);
  }, [date, refresh]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/moods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: word.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not save your mood.');
      setWord('');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your mood.'); }
    finally { setBusy(false); }
  }

  const mine = moods.find(mood => mood.userId === activeUserId);
  const other = moods.find(mood => mood.userId !== activeUserId);
  return <section className="panel daily-note" aria-label="Daily note">
    <div className="daily-note__heading"><p className="eyebrow">A daily note</p><span className="daily-note__number" aria-label={prompt ? `Question ${prompt.number} of ${prompt.total}` : undefined}>{prompt ? `${String(prompt.number).padStart(2, '0')} / ${prompt.total}` : '— / 40'}</span></div>
    <h2 className="section-title" style={{ marginBottom: 8 }}>{prompt?.question ?? 'A question for today'}</h2>
    <p className="small-copy" style={{ marginBottom: 24 }}>Answer in one word. Both of you can see each other’s answer anytime.</p>
    <div className="mood-grid" style={{ marginBottom: 22 }}>
      <div className="mood-person"><span className="small-copy">You</span><strong>{mine?.word ?? 'No word yet'}</strong></div>
      <div className="mood-person"><span className="small-copy">Your person</span><strong>{other?.word ?? 'No word yet'}</strong></div>
    </div>
    <form onSubmit={save}>
      <label className="field-label" htmlFor="mood-word">Your word</label>
      <input id="mood-word" className="field" value={word} maxLength={40} onChange={event => setWord(event.target.value)} placeholder={mine ? 'Change your answer' : 'One word only'} />
      <button className="action action--primary" style={{ marginTop: 12, width: '100%' }} disabled={busy || !/^\S{1,40}$/u.test(word.trim())}>{busy ? 'Saving…' : 'Save your word'}</button>
    </form>
    {error && <p role="alert" className="status-note status-note--error" style={{ marginTop: 12 }}>{error}</p>}
    <div style={{ borderTop: '1px solid var(--rule)', marginTop: 26, paddingTop: 18 }}>
      <p className="small-copy" style={{ margin: '0 0 8px' }}>The word resets at midnight UTC.</p>
      <button className="text-link" onClick={() => void refresh()} style={{ marginRight: 16, border: 0, background: 'none', padding: 0 }}>Refresh</button>
      <a className="text-link" href="/api/questions/export">Download old answers</a>
    </div>
  </section>;
}
