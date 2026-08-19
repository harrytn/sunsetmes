'use client';

/**
 * components/DailyQuestionWidget.tsx
 *
 * Inline card placed at the top of the inbox. Handles 4 states:
 *   1. Unanswered — show question + textarea
 *   2. Waiting    — user answered, partner hasn't
 *   3. Grading    — both answered, rate the partner's answer (0–5 stars)
 *   4. Rewarded   — grading complete, show reward summary
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionData {
  question: { id: string; text: string; date: string };
  myAnswer: { id: string; text: string } | null;
  partnerAnswer: { id: string; text: string; grade: number | null; userId: string } | null;
  state: 'unanswered' | 'waiting' | 'grading' | 'rewarded';
  partner: { id: string; name: string; avatarColor: string } | null;
}

export default function DailyQuestionWidget() {
  const [data, setData] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [rewardInfo, setRewardInfo] = useState<{ grade: number; reward: number; partnerName: string } | null>(null);

  const fetchQuestion = useCallback(async () => {
    try {
      const res = await fetch('/api/questions/today');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — widget is not critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuestion();
  }, [fetchQuestion]);

  async function handleSubmitAnswer() {
    if (!data || !answerText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/questions/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: data.question.id, text: answerText.trim() }),
      });
      if (res.ok) {
        setAnswerText('');
        await fetchQuestion();
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitGrade(grade: number) {
    if (!data?.partnerAnswer) return;
    setSelectedGrade(grade);
    setSubmitting(true);
    try {
      const res = await fetch('/api/questions/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: data.partnerAnswer.id, grade }),
      });
      if (res.ok) {
        const result = await res.json();
        setRewardInfo({
          grade,
          reward: result.reward,
          partnerName: result.partnerName,
        });
        await fetchQuestion();
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !data) return null;

  const state = rewardInfo ? 'rewarded' : data.state;
  const partnerName = data.partner?.name ?? 'Partner';

  return (
    <div className="px-4 mb-3">
      <motion.div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,209,148,0.35) 0%, rgba(138,163,194,0.25) 100%)',
          border: '1px solid rgba(26,139,157,0.2)',
          backdropFilter: 'blur(12px)',
        }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        {/* Header bar */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span className="text-lg">💭</span>
          <span
            className="font-sans text-[10px] font-bold tracking-widest uppercase"
            style={{ color: 'rgba(43,65,98,0.5)' }}
          >
            Daily Question
          </span>
        </div>

        {/* Question text */}
        <div className="px-4 pb-3">
          <p className="font-serif text-sm font-semibold leading-snug" style={{ color: '#2B4162' }}>
            {data.question.text}
          </p>
        </div>

        {/* State content */}
        <AnimatePresence mode="wait">
          {/* ── STATE 1: Unanswered ─────────────────────────────────────────── */}
          {state === 'unanswered' && (
            <motion.div
              key="unanswered"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4"
            >
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Your answer…"
                className="w-full px-3 py-2.5 rounded-xl font-sans text-sm outline-none resize-none border"
                style={{
                  background: 'rgba(253,245,230,0.8)',
                  color: '#2B4162',
                  borderColor: 'rgba(26,139,157,0.2)',
                  minHeight: 72,
                }}
                rows={3}
                maxLength={500}
              />
              <motion.button
                className="mt-2 w-full py-2.5 rounded-xl font-sans text-sm font-semibold text-white"
                style={{
                  background: answerText.trim()
                    ? 'linear-gradient(135deg, #1A8B9D 0%, #2B4162 100%)'
                    : 'rgba(43,65,98,0.2)',
                }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmitAnswer}
                disabled={!answerText.trim() || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Answer'}
              </motion.button>
            </motion.div>
          )}

          {/* ── STATE 2: Waiting ────────────────────────────────────────────── */}
          {state === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4"
            >
              <div className="flex items-center gap-3 py-3">
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ background: '#1A8B9D' }}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <p className="font-sans text-sm" style={{ color: 'rgba(43,65,98,0.6)' }}>
                  Waiting for <strong style={{ color: '#2B4162' }}>{partnerName}</strong> to answer…
                </p>
              </div>
              {data.myAnswer && (
                <div
                  className="mt-1 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(26,139,157,0.06)' }}
                >
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'rgba(43,65,98,0.4)' }}>
                    Your answer
                  </p>
                  <p className="font-sans text-xs italic" style={{ color: 'rgba(43,65,98,0.6)' }}>
                    &ldquo;{data.myAnswer.text}&rdquo;
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── STATE 3: Grading ────────────────────────────────────────────── */}
          {state === 'grading' && data.partnerAnswer && (
            <motion.div
              key="grading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4"
            >
              <div
                className="px-3 py-3 rounded-xl mb-3"
                style={{ background: 'rgba(253,245,230,0.7)', border: '1px solid rgba(26,139,157,0.15)' }}
              >
                <p className="font-sans text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'rgba(43,65,98,0.4)' }}>
                  {partnerName}&apos;s answer
                </p>
                <p className="font-serif text-sm leading-relaxed" style={{ color: '#2B4162' }}>
                  &ldquo;{data.partnerAnswer.text}&rdquo;
                </p>
              </div>

              <p className="font-sans text-xs font-semibold mb-2" style={{ color: 'rgba(43,65,98,0.5)' }}>
                Rate their answer:
              </p>
              <div className="flex gap-1.5 justify-center">
                {[0, 1, 2, 3, 4, 5].map((g) => (
                  <motion.button
                    key={g}
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-sans text-sm font-bold border"
                    style={{
                      background:
                        selectedGrade === g
                          ? '#1A8B9D'
                          : 'rgba(253,245,230,0.8)',
                      color: selectedGrade === g ? 'white' : '#2B4162',
                      borderColor:
                        selectedGrade === g ? '#1A8B9D' : 'rgba(26,139,157,0.2)',
                    }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSubmitGrade(g)}
                    disabled={submitting}
                  >
                    {g === 0 ? '0' : '★'.repeat(g)}
                  </motion.button>
                ))}
              </div>
              <p className="font-sans text-[10px] text-center mt-2" style={{ color: 'rgba(43,65,98,0.35)' }}>
                They earn grade × 10 PigeonCoins
              </p>
            </motion.div>
          )}

          {/* ── STATE 4: Rewarded ───────────────────────────────────────────── */}
          {state === 'rewarded' && (
            <motion.div
              key="rewarded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pb-4 text-center"
            >
              <div className="text-3xl mb-2">
                {rewardInfo
                  ? '★'.repeat(rewardInfo.grade) + '☆'.repeat(5 - rewardInfo.grade)
                  : data.partnerAnswer?.grade != null
                    ? '★'.repeat(data.partnerAnswer.grade) + '☆'.repeat(5 - data.partnerAnswer.grade)
                    : '✅'}
              </div>
              <p className="font-sans text-sm font-semibold" style={{ color: '#2B4162' }}>
                {rewardInfo
                  ? `${rewardInfo.partnerName} earned ${rewardInfo.reward} PigeonCoins!`
                  : 'Ratings submitted!'}
              </p>
              <p className="font-sans text-xs mt-1" style={{ color: 'rgba(43,65,98,0.45)' }}>
                Come back tomorrow for a new question 💭
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
