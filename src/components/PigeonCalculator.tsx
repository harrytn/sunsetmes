'use client';

/**
 * components/PigeonCalculator.tsx
 *
 * Pigeon Post delivery calculator component.
 * Grabs GPS coordinates, geocodes the destination via /api/geocode,
 * runs the Haversine formula, and shows the flight ETA + survival odds.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PigeonResult {
  distanceKm: number;
  flightDurationSec: number;
  survivalRate: number;
  senderLat: number;
  senderLng: number;
  destLat: number;
  destLng: number;
  destAddress: string;
  displayName: string;
}

interface Props {
  onResult: (result: PigeonResult) => void;
  onClear: () => void;
}

// ─── Haversine (client-side preview only – server also validates) ──────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function survivalRate(km: number): number {
  return Math.max(0.6, 0.95 - km / 200 / 100);
}

function formatDuration(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = sec / 3600;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)} days`;
}

export default function PigeonCalculator({ onResult, onClear }: Props) {
  const [destInput, setDestInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [result, setResult] = useState<PigeonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function calculate() {
    if (!destInput.trim()) return;
    setError(null);
    setLoading(true);
    setResult(null);

    // 1. Get GPS
    setGpsLoading(true);
    let senderLat: number, senderLng: number;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      senderLat = pos.coords.latitude;
      senderLng = pos.coords.longitude;
    } catch {
      setError('Could not get your GPS location. Please allow location access and try again.');
      setLoading(false);
      setGpsLoading(false);
      return;
    }
    setGpsLoading(false);

    // 2. Geocode destination
    let destLat: number, destLng: number, displayName: string;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(destInput.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Address not found');
      }
      const data = await res.json();
      destLat = data.lat;
      destLng = data.lng;
      displayName = data.displayName;
    } catch (e) {
      setError((e as Error).message || 'Failed to geocode destination.');
      setLoading(false);
      return;
    }

    // 3. Haversine + ETA
    const distanceKm = haversineKm(senderLat, senderLng, destLat, destLng);
    const flightDurationSec = Math.round((distanceKm / 80) * 3600);
    const rate = survivalRate(distanceKm);

    const r: PigeonResult = {
      distanceKm,
      flightDurationSec,
      survivalRate: rate,
      senderLat,
      senderLng,
      destLat,
      destLng,
      destAddress: destInput.trim(),
      displayName,
    };

    setResult(r);
    setLoading(false);
    onResult(r);
  }

  function handleClear() {
    setResult(null);
    setDestInput('');
    setError(null);
    onClear();
  }

  const survivalPct = result ? Math.round(result.survivalRate * 100) : 0;
  const survivalColor =
    survivalPct >= 88 ? '#1A8B9D' : survivalPct >= 75 ? '#F09819' : '#FF512F';

  return (
    <div className="flex flex-col gap-4">
      {/* Destination input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none"
          >
            📍
          </span>
          <input
            type="text"
            value={destInput}
            onChange={(e) => setDestInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && calculate()}
            placeholder="Destination city or address…"
            className="w-full pl-9 pr-4 py-3 rounded-xl font-sans text-sm outline-none border transition-colors"
            style={{
              background: 'rgba(253,245,230,0.7)',
              color: '#2B4162',
              borderColor: 'rgba(26,139,157,0.25)',
              caretColor: '#1A8B9D',
            }}
            disabled={loading || !!result}
            aria-label="Destination address"
            id="pigeon-destination"
          />
        </div>

        {result ? (
          <motion.button
            className="px-4 py-3 rounded-xl font-sans text-sm font-medium"
            style={{ background: 'rgba(26,139,157,0.12)', color: '#1A8B9D' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClear}
          >
            Clear
          </motion.button>
        ) : (
          <motion.button
            className="px-4 py-3 rounded-xl font-sans text-sm font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #FF512F, #F09819)',
              opacity: loading || !destInput.trim() ? 0.6 : 1,
            }}
            whileTap={{ scale: 0.95 }}
            onClick={calculate}
            disabled={loading || !destInput.trim()}
            aria-label="Calculate pigeon flight"
          >
            {loading ? (gpsLoading ? '📡…' : '🗺️…') : '🐦 Fly'}
          </motion.button>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="rounded-xl px-4 py-3 text-sm font-sans"
            style={{ background: 'rgba(255,81,47,0.1)', color: '#C0391B' }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            ⚠️ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="glass rounded-2xl p-4 flex flex-col gap-3"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {/* Destination */}
            <div>
              <div
                className="font-sans text-[10px] font-semibold tracking-widest uppercase mb-0.5"
                style={{ color: 'rgba(43,65,98,0.5)' }}
              >
                Destination
              </div>
              <div className="font-sans text-sm font-medium" style={{ color: '#2B4162' }}>
                {result.displayName.split(',').slice(0, 3).join(', ')}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {/* Distance */}
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(26,139,157,0.08)' }}
              >
                <div className="text-xl mb-1">📏</div>
                <div
                  className="font-serif text-base font-bold"
                  style={{ color: '#2B4162' }}
                >
                  {result.distanceKm < 1000
                    ? `${Math.round(result.distanceKm)} km`
                    : `${(result.distanceKm / 1000).toFixed(1)}k km`}
                </div>
                <div
                  className="font-sans text-[10px]"
                  style={{ color: 'rgba(43,65,98,0.5)' }}
                >
                  distance
                </div>
              </div>

              {/* ETA */}
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(26,139,157,0.08)' }}
              >
                <div className="text-xl mb-1">🕐</div>
                <div
                  className="font-serif text-base font-bold"
                  style={{ color: '#2B4162' }}
                >
                  {formatDuration(result.flightDurationSec)}
                </div>
                <div
                  className="font-sans text-[10px]"
                  style={{ color: 'rgba(43,65,98,0.5)' }}
                >
                  flight time
                </div>
              </div>

              {/* Survival */}
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(26,139,157,0.08)' }}
              >
                <div className="text-xl mb-1">🎲</div>
                <div
                  className="font-serif text-base font-bold"
                  style={{ color: survivalColor }}
                >
                  {survivalPct}%
                </div>
                <div
                  className="font-sans text-[10px]"
                  style={{ color: 'rgba(43,65,98,0.5)' }}
                >
                  survival
                </div>
              </div>
            </div>

            {/* Risk notice */}
            {survivalPct < 80 && (
              <div
                className="rounded-xl px-3 py-2 font-sans text-xs"
                style={{
                  background: 'rgba(255,81,47,0.08)',
                  color: '#C0391B',
                }}
              >
                ⚠️ Risky flight! A lost pigeon costs{' '}
                <strong>25 PigeonCoins</strong> and the letter is saved as a draft.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
