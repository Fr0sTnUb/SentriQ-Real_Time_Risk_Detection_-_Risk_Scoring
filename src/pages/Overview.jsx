// Page: Overview
import { useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { getHourly, getModelHealth, getRecentTransactions, getSummary, WS_BASE_URL } from '../services/api';
import { formatCurrency, formatNumber, formatPercent, riskColor, riskLevel } from '../utils/format';
import TransactionDrawer from '../components/TransactionDrawer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useNotifications } from '../context/NotificationContext';

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addNotification } = useNotifications();

  const loadData = async () => {
    try {
      setError('');
      const [summaryData, hourlyData, recentData, healthData] = await Promise.all([
        getSummary(),
        getHourly(),
        getRecentTransactions(50),
        getModelHealth(),
      ]);
      setSummary(summaryData);
      setHourly(hourlyData ?? []);
      setTransactions(recentData ?? []);
      setHealth(healthData);
    } catch {
      setError('/api/stats/summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    let pollId;
    let socket;
    try {
      socket = new WebSocket(`${WS_BASE_URL}/ws/live-feed`);
      socket.onmessage = (event) => {
        const txn = JSON.parse(event.data);
        setTransactions((items) => [txn, ...items].slice(0, 20));
        if (txn.status === 'Fraud' || Number(txn.risk_score) >= 70) {
          addNotification('danger', `NEW HIGH RISK TXN · ${txn.txn_id}`);
          if (window.localStorage.getItem('sentriq_sound') === 'true') {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.start();
            window.setTimeout(() => osc.stop(), 150);
          }
        }
      };
      socket.onerror = () => {
        pollId = window.setInterval(loadData, 10000);
      };
    } catch {
      pollId = window.setInterval(loadData, 10000);
    }
    return () => {
      if (socket) socket.close();
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  if (loading) return <div className="page-content"><LoadingState rows={6} /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  const fraudRate = summary?.fraud_rate_percent ?? 0;
  const latest = hourly[hourly.length - 1] || {};
  const totalVol = latest.transaction_count || 0;
  const fraudVol = latest.fraud_count || 0;
  const legitVol = totalVol - fraudVol;
  const miniMetrics = [
    ['Total Predictions Today', formatNumber(health?.total_predictions ?? summary?.total_transactions_24h)],
    ['Fraud Prevented ($)', formatCurrency((summary?.fraud_count_24h ?? 0) * 137.5)],
    ['Avg API Response Time', `${Math.round(health?.avg_latency_ms ?? 42)}ms`],
    ['Transactions Per Second', `${((summary?.total_transactions_24h ?? 0) / 86400).toFixed(2)} txn/s`],
    ['Active Alerts', formatNumber((fraudRate > 5 ? 1 : 0) + (health?.is_mock ? 1 : 0))],
  ];

  return (
    <div className="page-content overview-grid">
      <section className="bento-card col-left flex-col">
        <div className="section-label">System Risk Monitor</div>
        <div className="mini-metric-row">
          {miniMetrics.map(([label, value]) => (
            <div className="mini-metric" key={label}><span>{value}</span><em>{label}</em></div>
          ))}
        </div>
        <div className="hero-monitor">
          <div className="pulse-ring" />
          <div className="pulse-ring delay-a" />
          <div className="pulse-ring delay-b" />
          <div className="hero-center">
            <span className="hero-value">{formatPercent(fraudRate, 1)}</span>
            <span className="section-label">Fraud Rate</span>
          </div>
        </div>
        <div className="kpi-cluster">
          <div className="kpi-item"><div className="section-label">24H Volume</div><div className="num-val">{formatNumber(summary?.total_transactions_24h)}</div></div>
          <div className="kpi-item"><div className="section-label danger-text">Flagged</div><div className="num-val danger-text">{formatNumber(summary?.fraud_count_24h)}</div></div>
          <div className="kpi-item"><div className="section-label accent-text">Avg Conf</div><div className="num-val accent-text">{formatPercent((summary?.avg_confidence ?? 0) * 100, 1)}</div></div>
        </div>
        <div className="flow-bars-container">
          <div className="section-label">Live Flow Streams</div>
          <div className="flow-bar-row"><span className="flow-label safe-text">Legit</span><div className="flow-track"><div className="flow-fill safe-bg" style={{ width: `${Math.max(5, legitVol * 10)}%` }} /></div><span className="flow-val">{legitVol}</span></div>
          <div className="flow-bar-row"><span className="flow-label danger-text">Flagged</span><div className="flow-track"><div className="flow-fill danger-bg" style={{ width: `${Math.max(2, fraudVol * 10)}%` }} /></div><span className="flow-val">{fraudVol}</span></div>
        </div>
      </section>
      <section className="bento-card col-top-right flex-col">
        <div className="panel-title"><span className="section-label">Review Queue</span><button onClick={loadData}><RefreshCw size={14} /></button></div>
        <TransactionTable transactions={transactions.slice(0, 12)} onSelect={setSelectedTxn} />
      </section>
      <section className="bento-card col-bottom-right flex-col">
        <div className="section-label">Live Feed</div>
        <div className="ticker-feed">
          {transactions.map((txn) => <div key={`tick-${txn.txn_id}`} className="ticker-item" onClick={() => setSelectedTxn(txn)}><div className="ticker-dot" style={{ background: riskColor(txn.status, Number(txn.risk_score)) }} /><div className="num-val mono-dim">{new Date(txn.timestamp).toLocaleTimeString([], { hour12: false })}</div><div className="num-val push-right">{formatCurrency(txn.amount)}</div></div>)}
        </div>
      </section>
      <TransactionDrawer transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
    </div>
  );
}

function TransactionTable({ transactions, onSelect }) {
  return (
    <div className="table-wrapper">
      <table className="queue-table">
        <thead><tr><th>Time</th><th>ID</th><th>Amount</th><th>Risk</th><th /></tr></thead>
        <tbody>
          {transactions.map((txn) => {
            const score = Number(txn.risk_score ?? 0);
            return (
              <tr key={txn.txn_id} onClick={() => onSelect(txn)} className="queue-row">
                <td className="num-val mono-dim">{new Date(txn.timestamp).toLocaleTimeString([], { hour12: false })}</td>
                <td className="num-val copy-cell">{txn.txn_id.slice(0, 8)} <Copy size={10} /></td>
                <td className="num-val">{formatCurrency(txn.amount)}</td>
                <td><span className="pill-badge" style={{ color: riskColor(txn.status, score), borderColor: riskColor(txn.status, score) }}>{riskLevel(txn.status, score)}</span></td>
                <td><button className="review-btn">Review</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
