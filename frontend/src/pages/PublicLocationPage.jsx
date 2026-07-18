import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Standalone axios instance — public page must NOT send any auth token
const pub = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

export default function PublicLocationPage() {
  const { id } = useParams();

  const [loc, setLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // alert flow: 'idle' -> 'phone' -> 'otp' -> 'done'
  const [step, setStep] = useState('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    pub.get(`/alerts/public/location/${id}`)
      .then(({ data }) => setLoc(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const sendOtp = async () => {
    setErr('');
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length < 8) { setErr('Enter a valid phone number with country code'); return; }
    setBusy(true);
    try {
      await pub.post(`/alerts/public/location/${id}/otp`, { phone: clean });
      setStep('otp');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to send code');
    } finally { setBusy(false); }
  };

  const verifyAndSend = async () => {
    setErr('');
    if (!code || code.length < 4) { setErr('Enter the code from WhatsApp'); return; }
    setBusy(true);
    try {
      await pub.post(`/alerts/public/location/${id}/alert`, {
        phone: phone.replace(/[^\d]/g, ''),
        code,
        remark,
      });
      setStep('done');
    } catch (e) {
      setErr(e.response?.data?.message || 'Verification failed');
    } finally { setBusy(false); }
  };

  if (loading) return (
    <div style={S.screen}>
      <div style={S.spinner} />
    </div>
  );

  if (notFound || !loc) return (
    <div style={S.screen}>
      <div style={S.card}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📍</div>
        <h1 style={S.h1}>Location not found</h1>
        <p style={S.muted}>This QR code is invalid or the location was removed.</p>
      </div>
    </div>
  );

  const hasCoords = loc.latitude != null && loc.longitude != null;

  return (
    <div style={S.screen}>
      <div style={S.card}>
        {/* Brand strip */}
        <div style={S.brand}>
          <div style={S.logoChip}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9" />
            </svg>
          </div>
          <span style={S.brandText}>Location Details</span>
        </div>

        {loc.defaultImage ? (
          <img src={loc.defaultImage} alt={loc.name} style={S.hero} />
        ) : (
          <div style={{ ...S.hero, ...S.heroPlaceholder }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5b6b8c" strokeWidth="1.6">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <circle cx="12" cy="11" r="3" />
            </svg>
          </div>
        )}

        <h1 style={S.h1}>{loc.name}</h1>

        <div style={S.rows}>
          <Row label="Thana" value={loc.thana || '—'} />
          <Row label="District" value={loc.district || '—'} />
          <Row label="Latitude" value={hasCoords ? Number(loc.latitude).toFixed(6) : '—'} mono />
          <Row label="Longitude" value={hasCoords ? Number(loc.longitude).toFixed(6) : '—'} mono />
        </div>

        {hasCoords && (
          <a
            href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
            target="_blank" rel="noreferrer"
            style={S.mapLink}
          >
            Open in Google Maps →
          </a>
        )}

        {/* Alert flow */}
        <div style={S.alertBox}>
          {step === 'idle' && (
            <>
              <p style={S.alertHint}>See something wrong here?</p>
              <button style={S.alertBtn} onClick={() => setStep('phone')}>
                🚨 Send Alert
              </button>
            </>
          )}

          {step === 'phone' && (
            <div style={S.flow}>
              <label style={S.label}>Your WhatsApp number (with country code)</label>
              <input
                style={S.input}
                inputMode="tel"
                placeholder="e.g. 919812345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {err && <p style={S.err}>{err}</p>}
              <button style={S.alertBtn} disabled={busy} onClick={sendOtp}>
                {busy ? 'Sending…' : 'Send OTP on WhatsApp'}
              </button>
              <button style={S.linkBtn} onClick={() => { setStep('idle'); setErr(''); }}>Cancel</button>
            </div>
          )}

          {step === 'otp' && (
            <div style={S.flow}>
              <p style={S.alertHint}>Code sent to <b>+{phone.replace(/[^\d]/g, '')}</b></p>
              <label style={S.label}>Enter the 6-digit code</label>
              <input
                style={{ ...S.input, letterSpacing: 6, textAlign: 'center', fontSize: 20 }}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))}
              />
              <label style={S.label}>Remark (optional)</label>
              <textarea
                style={{ ...S.input, minHeight: 64, resize: 'vertical' }}
                placeholder="Describe the issue…"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
              {err && <p style={S.err}>{err}</p>}
              <button style={S.alertBtn} disabled={busy} onClick={verifyAndSend}>
                {busy ? 'Verifying…' : 'Verify & Send Alert'}
              </button>
              <button style={S.linkBtn} onClick={sendOtp} disabled={busy}>Resend code</button>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <p style={{ ...S.h1, fontSize: 18, margin: 0 }}>Alert sent</p>
              <p style={S.muted}>The team has been notified on WhatsApp.</p>
            </div>
          )}
        </div>

        <p style={S.footer}>Powered by FieldOps</p>
      </div>
    </div>
  );
}

const Row = ({ label, value, mono }) => (
  <div style={S.row}>
    <span style={S.rowLabel}>{label}</span>
    <span style={{ ...S.rowValue, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
  </div>
);

const S = {
  screen: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, background: 'linear-gradient(135deg,#0e0e1a,#13131f 60%,#1a1a2e)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  spinner: {
    width: 36, height: 36, border: '4px solid #4f6ef7', borderTopColor: 'transparent',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  card: {
    width: '100%', maxWidth: 440, background: '#13131f', border: '1px solid #2e2e4a',
    borderRadius: 24, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  logoChip: {
    width: 36, height: 36, borderRadius: 12, background: '#4f6ef7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandText: { color: '#cbd5e1', fontWeight: 600, fontSize: 14, letterSpacing: 0.3 },
  hero: { width: '100%', height: 180, objectFit: 'cover', borderRadius: 16, border: '1px solid #2e2e4a', marginBottom: 16 },
  heroPlaceholder: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' },
  h1: { color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 14px', lineHeight: 1.2 },
  rows: { display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 14, overflow: 'hidden', border: '1px solid #22223a' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: '#1a1a2e' },
  rowLabel: { color: '#7c8aa5', fontSize: 13 },
  rowValue: { color: '#e2e8f0', fontSize: 13, fontWeight: 600, textAlign: 'right' },
  mapLink: { display: 'inline-block', marginTop: 12, color: '#6b8cff', fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  alertBox: { marginTop: 18, padding: 16, borderRadius: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' },
  alertHint: { color: '#cbd5e1', fontSize: 13, margin: '0 0 10px', textAlign: 'center' },
  alertBtn: {
    width: '100%', padding: '12px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 15,
  },
  linkBtn: { width: '100%', marginTop: 8, padding: 8, background: 'none', border: 'none', color: '#7c8aa5', fontSize: 13, cursor: 'pointer' },
  flow: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: 600 },
  input: {
    width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #2e2e4a',
    background: '#0e0e1a', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  err: { color: '#fca5a5', fontSize: 12, margin: 0 },
  muted: { color: '#7c8aa5', fontSize: 13, margin: '4px 0 0' },
  footer: { textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 18, marginBottom: 0 },
};
