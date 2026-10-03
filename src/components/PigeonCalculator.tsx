'use client';

import { useState } from 'react';
import { flightDurationSeconds, haversineDistanceKm, pigeonOnTimeRate } from '@/lib/haversine';

export type PigeonResult = {
  distanceKm: number; flightDurationSec: number; successRate: number;
  senderLat: number; senderLng: number; destLat: number; destLng: number;
  destAddress: string; displayName: string;
};

function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const hours = seconds / 3600;
  return hours < 24 ? `${hours.toFixed(1)} hours` : `${(hours / 24).toFixed(1)} days`;
}

export default function PigeonCalculator({ onResult, onClear }: { onResult: (result: PigeonResult) => void; onClear: () => void }) {
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PigeonResult | null>(null);
  const [error, setError] = useState('');

  async function calculate() {
    if (!destination.trim()) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(destination.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Destination not found.');
      const senderLat = position.coords.latitude;
      const senderLng = position.coords.longitude;
      const destLat = Number(data.lat);
      const destLng = Number(data.lng);
      const distanceKm = haversineDistanceKm(senderLat, senderLng, destLat, destLng);
      const calculated: PigeonResult = {
        senderLat, senderLng, destLat, destLng, distanceKm,
        flightDurationSec: flightDurationSeconds(distanceKm),
        successRate: pigeonOnTimeRate(distanceKm),
        destAddress: destination.trim(), displayName: data.displayName,
      };
      setResult(calculated);
      onResult(calculated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not calculate the flight. Check location access and try again.');
    } finally { setBusy(false); }
  }

  function clear() { setResult(null); setDestination(''); setError(''); onClear(); }

  return <div className="form-stack" style={{ gap: 16 }}>
    <div>
      <label className="field-label" htmlFor="pigeon-destination">Destination city or address</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input id="pigeon-destination" className="field" style={{ flex: '1 1 220px', minWidth: 0 }} value={destination} onChange={event => setDestination(event.target.value)} disabled={busy || !!result} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void calculate(); } }} />
        {result ? <button className="action action--quiet" onClick={clear}>Change route</button> : <button className="action action--primary" disabled={busy || !destination.trim()} onClick={() => void calculate()}>{busy ? 'Calculating…' : 'Calculate flight'}</button>}
      </div>
      <p className="field-help">We use your location and an OpenStreetMap lookup to estimate the flight. Exact coordinates are not saved with the letter.</p>
    </div>
    {error && <p role="alert" className="status-note status-note--error">{error}</p>}
    {result && <div className="panel panel--quiet">
      <p className="eyebrow">Flight estimate</p>
      <h4 className="section-title" style={{ fontSize: 24, overflowWrap: 'anywhere' }}>{result.displayName.split(',').slice(0, 3).join(', ')}</h4>
      <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginTop: 20 }}>
        <div><span className="small-copy">Distance</span><strong style={{ display: 'block' }}>{Math.round(result.distanceKm).toLocaleString()} km</strong></div>
        <div><span className="small-copy">Flight time</span><strong style={{ display: 'block' }}>{formatDuration(result.flightDurationSec)}</strong></div>
        <div><span className="small-copy">On-time success rate</span><strong style={{ display: 'block' }}>{Math.round(result.successRate * 100)}%</strong></div>
      </div>
      <p className="small-copy" style={{ marginBottom: 0, marginTop: 18 }}>The displayed rate is the chance of arriving on time. If the roll fails, weather adds 25% to the flight time. Your letter still arrives.</p>
    </div>}
  </div>;
}
