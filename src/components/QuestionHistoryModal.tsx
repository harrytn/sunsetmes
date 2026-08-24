'use client';

/**
 * components/QuestionHistoryModal.tsx
 *
 * Slide-over / Modal view displaying all past completed Daily Questions
 * with Sun's and Moon's answers displayed side-by-side.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnswerHistory {
  id: string;
  text: string;
  grade: number | null;
  user: {
    id: string;
    name: string;
    avatarColor: string;
  };
  createdAt: string;
}

interface QuestionHistoryItem {
  id: string;
  date: string;
  text: string;
  answers: AnswerHistory[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuestionHistoryModal({ isOpen, onClose }: Props) {
  const [history, setHistory] = useState<QuestionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/questions/history')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history ?? []);
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-[#2B4162]/40 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl overflow-hidden glass shadow-2xl"
          style={{
            background: 'linear-gradient(155deg, rgba(253,245,230,0.96) 0%, rgba(245,237,216,0.94) 100%)',
            border: '1px solid rgba(26,139,157,0.3)',
          }}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{
              background: 'rgba(138,163,194,0.15)',
              borderColor: 'rgba(26,139,157,0.15)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📜</span>
              <div>
                <h2 className="font-serif text-lg font-bold" style={{ color: '#2B4162' }}>
                  Question Archive
                </h2>
                <p className="font-sans text-xs" style={{ color: 'rgba(43,65,98,0.55)' }}>
                  Memories & answers exchanged
                </p>
              </div>
            </div>

            <motion.button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm glass cursor-pointer"
              style={{ color: '#2B4162' }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close modal"
            >
              ✕
            </motion.button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <motion.div
                  className="w-8 h-8 rounded-full border-3"
                  style={{ borderColor: '#1A8B9D', borderTopColor: 'transparent' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <p className="font-sans text-xs" style={{ color: 'rgba(43,65,98,0.6)' }}>
                  Loading memories…
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="text-5xl mb-3">💭</div>
                <h3 className="font-serif text-base font-semibold mb-1" style={{ color: '#2B4162' }}>
                  No archived questions yet
                </h3>
                <p className="font-sans text-xs max-w-xs mx-auto" style={{ color: 'rgba(43,65,98,0.55)' }}>
                  Once both Sun and Moon have answered and graded a daily question, it will appear here in your memory archive.
                </p>
              </div>
            ) : (
              history.map((item, idx) => {
                const dateFormatted = new Date(item.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <motion.div
                    key={item.id}
                    className="p-4 rounded-2xl paper-texture shadow-sm"
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(26,139,157,0.18)',
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    {/* Date badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-sans text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(26,139,157,0.12)',
                          color: '#1A8B9D',
                        }}
                      >
                        🗓️ {dateFormatted}
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="font-serif text-sm font-semibold mb-3 leading-snug" style={{ color: '#2B4162' }}>
                      &ldquo;{item.text}&rdquo;
                    </p>

                    {/* Answers Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {item.answers.map((ans) => {
                        const isSun = ans.user.name.toLowerCase().includes('sun');
                        return (
                          <div
                            key={ans.id}
                            className="p-3 rounded-xl flex flex-col justify-between"
                            style={{
                              background: isSun
                                ? 'rgba(255, 209, 148, 0.25)'
                                : 'rgba(138, 163, 194, 0.2)',
                              border: `1px solid ${isSun ? 'rgba(255, 81, 47, 0.2)' : 'rgba(43, 65, 98, 0.2)'}`,
                            }}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ background: ans.user.avatarColor }}
                                  >
                                    {ans.user.name[0]}
                                  </div>
                                  <span className="font-sans text-xs font-semibold" style={{ color: '#2B4162' }}>
                                    {ans.user.name}
                                  </span>
                                </div>

                                {ans.grade != null && (
                                  <span className="font-sans text-[11px] font-medium" style={{ color: '#F09819' }}>
                                    {'★'.repeat(ans.grade)}{'☆'.repeat(5 - ans.grade)}
                                  </span>
                                )}
                              </div>

                              <p className="font-sans text-xs leading-relaxed" style={{ color: 'rgba(43,65,98,0.85)' }}>
                                {ans.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
