// Page: Settings
import { useEffect, useState } from 'react';
import { getConfig, getModelHealth, getRecentTransactions, reviewTransaction, updateThreshold, API_BASE_URL } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatCurrency } from '../utils/format';

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getConfig(), getModelHealth(), getRecentTransactions(5, true)])
      .then(([cfg, h, txns]) => { setConfig(cfg); setHealth(h); setReviews(txns); window.localStorage.setItem('sentriq_sound', String(cfg.alerts.sound)); })
      .catch(() => setError('/api/config'))
      .finally(() => setLoading(false));
  }, []);

  const setThreshold = async (threshold) => {
    setConfig({ ...config, threshold });
    await updateThreshold(threshold);
  };

  const toggleAlert = (key) => {
    const next = { ...config, alerts: { ...config.alerts, [key]: !config.alerts[key] } };
    setConfig(next);
    if (key === 'sound') window.localStorage.setItem('sentriq_sound', String(next.alerts.sound));
  };

  const act = async (txnId, action) => {
    await reviewTransaction(txnId, action);
    setReviews((items) => items.filter((txn) => txn.txn_id !== txnId));
  };

  if (loading) return <div className="page-content"><LoadingState /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  return (
    <div className="page-content settings-page">
      <section className="settings-section">
        <div className="section-label">Fraud Detection Config</div>
        <input type="range" min="0.1" max="0.9" step="0.05" value={config.threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        <div className="settings-hint">THRESHOLD: {config.threshold.toFixed(2)} · LOW RISK ← 0.1 ··· 0.35 ··· 0.9 → HIGH SENSITIVITY</div>
      </section>
      <section className="settings-section">
        <div className="section-label">Alert Toggles</div>
        {['fraud', 'drift', 'slowdown', 'volume', 'sound'].map((key) => <Toggle key={key} label={`${key} alerts`} checked={config.alerts[key]} onClick={() => toggleAlert(key)} />)}
      </section>
      <section className="settings-section">
        <div className="section-label">System Status</div>
        <div className="detail-grid">
          <div>Database connection</div><div className="safe-text">CONNECTED · fraudguard.db</div>
          <div>Model status</div><div className={health.is_mock ? 'amber-text' : 'safe-text'}>{health.is_mock ? 'MOCK MODEL ACTIVE' : 'REAL MODEL LOADED'}</div>
          <div>Scheduler status</div><div>RUNNING · next retrain: Sunday 00:00</div>
          <div>API endpoint</div><div>{API_BASE_URL}</div>
        </div>
      </section>
      <section className="settings-section">
        <div className="section-label">Appearance</div>
        <button onClick={() => document.documentElement.style.setProperty('--bg-base', '#f5f5f5')}>Light</button>
        <button onClick={() => document.documentElement.style.setProperty('--bg-base', '#0e0e0e')}>Dark</button>
        <button onClick={() => document.body.style.fontSize = '12px'}>Small</button>
        <button onClick={() => document.body.style.fontSize = '16px'}>Large</button>
      </section>
      <section className="settings-section">
        <div className="section-label">Manual Review Workflow</div>
        {reviews.map((txn) => <div className="review-workflow-row" key={txn.txn_id}><span>{txn.txn_id}</span><span>{formatCurrency(txn.amount)}</span><button onClick={() => act(txn.txn_id, 'approve')}>APPROVE</button><button onClick={() => act(txn.txn_id, 'reject')}>REJECT</button><button onClick={() => act(txn.txn_id, 'escalate')}>ESCALATE</button></div>)}
      </section>
    </div>
  );
}

function Toggle({ label, checked, onClick }) {
  return <button className="toggle-row" onClick={onClick}><span>{label}</span><i className={checked ? 'on' : ''}><b /></i></button>;
}
