import React, { useEffect, useState } from 'react';
import {
  ShieldAlert, Activity, Users, Settings, Bell, LayoutDashboard,
  Search, RefreshCw, Copy, X, Clock, MapPin, Smartphone, Shield
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

// Mock helpers for missing backend fields
const getEntityName = (txnId) => {
  const entities = ['Acme Corp', 'Global Tech', 'Local Merchant', 'Online Store', 'TechSubs Inc', 'Retail Giant', 'Cafe Latte'];
  const hash = txnId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return entities[hash % entities.length];
};

const getFlagReasons = (txnId) => {
  const allReasons = [
    { id: 1, text: 'Multiple attempts in 5 mins', icon: Clock },
    { id: 2, text: 'Distance > 500 miles from last txn', icon: MapPin },
    { id: 3, text: 'Unrecognized device signature', icon: Smartphone },
    { id: 4, text: 'IP address associated with VPN', icon: Shield },
  ];
  const hash = txnId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const count = (hash % 3) + 1;
  const reasons = [];
  for (let i = 0; i < count; i++) {
    reasons.push(allReasons[(hash + i) % allReasons.length]);
  }
  return reasons;
};

const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);
const formatPercent = (value, fractionDigits = 2) => `${Number(value ?? 0).toFixed(fractionDigits)}%`;
const formatCurrency = (value) =>
  `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getRiskColor = (status, score) => {
  if (status === 'Fraud' || score > 0.7) return 'var(--danger)'; // #ff4444
  if (score > 0.4) return 'var(--amber)'; // #ffaa00
  return 'var(--safe)'; // #00e57a
};

const getRiskLevel = (status, score) => {
  if (status === 'Fraud' || score > 0.7) return 'HIGH';
  if (score > 0.4) return 'MED';
  return 'LOW';
};

async function fetchApi(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const payload = await response.json();
  if (payload.success === false) throw new Error(payload.detail || payload.message || 'API request failed');
  return payload.data;
}

export default function App() {
  const [token, setToken] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [kpiData, setKpiData] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [summary, hourly, recent] = await Promise.all([
        fetchApi('/api/stats/summary', token),
        fetchApi('/api/stats/hourly', token),
        fetchApi('/api/transactions/recent?limit=50', token),
      ]);
      setKpiData(summary);
      setHourlyData(hourly ?? []);
      setTransactions(recent ?? []);
    } catch (e) {
      console.error("Fetch error", e);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchDashboardData();
    const intervalId = window.setInterval(fetchDashboardData, 10000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (!response.ok) throw new Error('Login failed');
      const payload = await response.json();
      if (!payload.success) throw new Error('Login failed');
      setToken(payload.data.access_token);
      setLoginForm({ username: '', password: '' });
    } catch {
      setLoginError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (!token) {
    return (
      <div className="login-container">
        <GlobalStyles />
        <form className="login-form" onSubmit={handleLogin}>
          <ShieldAlert size={32} color="var(--accent)" />
          <h1 className="hero-value" style={{fontSize: '2rem', marginTop: '1rem', color: '#fff'}}>SentriQ</h1>
          <div className="section-label" style={{marginBottom: '2rem'}}>Analyst Login</div>
          {loginError && <div style={{color: 'var(--danger)', marginBottom: '1rem', fontSize: '12px'}}>{loginError}</div>}
          <input 
            type="text" 
            placeholder="Username" 
            value={loginForm.username}
            onChange={e => setLoginForm({...loginForm, username: e.target.value})}
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={loginForm.password}
            onChange={e => setLoginForm({...loginForm, password: e.target.value})}
            required 
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    );
  }

  const fraudRate = kpiData?.fraud_rate_percent ?? 0;
  const pulseDuration = fraudRate > 5 ? '1.5s' : '3s';

  const totalVol = hourlyData[hourlyData.length - 1]?.transaction_count || 0;
  const fraudVol = hourlyData[hourlyData.length - 1]?.fraud_count || 0;
  const legitVol = totalVol - fraudVol;

  return (
    <div className="app-container">
      <GlobalStyles />
      <svg className="noise-svg">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" stitchTiles="stitch"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)"></rect>
      </svg>
      <div className="noise-overlay" />

      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <ShieldAlert size={20} color="var(--accent)" />
        </div>
        <div className="sidebar-links">
          <button className="sidebar-btn active"><LayoutDashboard size={18} /></button>
          <button className="sidebar-btn"><Activity size={18} /></button>
          <button className="sidebar-btn"><Users size={18} /></button>
          <button className="sidebar-btn"><Settings size={18} /></button>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-btn" onClick={() => setToken('')}><Bell size={18} /></button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="main-content">
        
        {/* Top Header */}
        <header className="top-header">
          <div className="search-box">
            <Search size={14} color="var(--text-dim)" />
            <input type="text" placeholder="SEARCH TXN ID..." />
          </div>
          <div className="header-actions">
            <button className="refresh-btn" onClick={fetchDashboardData}>
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        {/* Bento Grid layout */}
        <div className="bento-grid">
          
          {/* Left Tall Column */}
          <section className="bento-card col-left flex-col">
            <div className="section-label">System Risk Monitor</div>
            
            {/* Hero Pulse Rings */}
            <div className="hero-monitor">
              <div className="pulse-ring" style={{animationDuration: pulseDuration, animationDelay: '0s'}}></div>
              <div className="pulse-ring" style={{animationDuration: pulseDuration, animationDelay: '0.5s'}}></div>
              <div className="pulse-ring" style={{animationDuration: pulseDuration, animationDelay: '1s'}}></div>
              <div className="hero-center">
                <span className="hero-value">{formatPercent(fraudRate, 1)}</span>
                <span className="section-label" style={{marginTop: '4px'}}>Fraud Rate</span>
              </div>
            </div>

            {/* KPI Cluster */}
            <div className="kpi-cluster">
              <div className="kpi-item">
                <div className="section-label">24H Volume</div>
                <div className="num-val">{formatNumber(kpiData?.total_transactions_24h)}</div>
              </div>
              <div className="kpi-item">
                <div className="section-label" style={{color: 'var(--danger)'}}>Flagged</div>
                <div className="num-val" style={{color: 'var(--danger)'}}>{formatNumber(kpiData?.fraud_count_24h)}</div>
              </div>
              <div className="kpi-item">
                <div className="section-label" style={{color: 'var(--accent)'}}>Avg Conf</div>
                <div className="num-val" style={{color: 'var(--accent)'}}>{formatPercent((kpiData?.avg_confidence??0)*100, 1)}</div>
              </div>
            </div>

            {/* Flow Bars */}
            <div className="flow-bars-container">
              <div className="section-label">Live Flow Streams</div>
              
              <div className="flow-bar-row">
                <span className="flow-label" style={{color:'var(--safe)'}}>Legit</span>
                <div className="flow-track">
                  <div className="flow-fill" style={{width: `${Math.max(5, (legitVol / Math.max(totalVol, 1)) * 100)}%`, backgroundColor: 'var(--safe)'}}>
                    <div className="flow-dot" style={{backgroundColor: 'var(--safe)', boxShadow: '0 0 8px var(--safe)'}}></div>
                  </div>
                </div>
                <span className="flow-val">{legitVol}</span>
              </div>

              <div className="flow-bar-row">
                <span className="flow-label" style={{color:'var(--danger)'}}>Flagged</span>
                <div className="flow-track">
                  <div className="flow-fill" style={{width: `${Math.max(2, (fraudVol / Math.max(totalVol, 1)) * 100)}%`, backgroundColor: 'var(--danger)'}}>
                    <div className="flow-dot" style={{backgroundColor: 'var(--danger)', boxShadow: '0 0 8px var(--danger)'}}></div>
                  </div>
                </div>
                <span className="flow-val">{fraudVol}</span>
              </div>
            </div>
          </section>

          {/* Top Right: Queue Table */}
          <section className="bento-card col-top-right">
            <div className="section-label" style={{marginBottom: '1rem'}}>Review Queue</div>
            <div className="table-wrapper">
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>ID</th>
                    <th>Entity</th>
                    <th style={{textAlign: 'right'}}>Amount</th>
                    <th style={{textAlign: 'center'}}>Risk</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 12).map((txn) => {
                    const score = Number(txn.confidence_score);
                    const rColor = getRiskColor(txn.status, score);
                    return (
                      <tr key={txn.txn_id} onClick={() => setSelectedTxn(txn)} className="queue-row">
                        <td className="num-val mono-dim">{new Date(txn.timestamp).toLocaleTimeString([],{hour12:false})}</td>
                        <td className="num-val copy-cell" onClick={(e)=>{e.stopPropagation(); copyToClipboard(txn.txn_id);}}>
                          {txn.txn_id.substring(0,8)} <Copy size={10} className="copy-icon" />
                        </td>
                        <td className="text-xs">{getEntityName(txn.txn_id)}</td>
                        <td className="num-val" style={{textAlign: 'right'}}>{formatCurrency(txn.amount)}</td>
                        <td style={{textAlign: 'center'}}>
                          <span className="pill-badge" style={{color: rColor, borderColor: rColor}}>
                            {getRiskLevel(txn.status, score)}
                          </span>
                        </td>
                        <td style={{textAlign: 'right'}}>
                          <button className="review-btn" onClick={(e)=>{e.stopPropagation(); setSelectedTxn(txn);}}>Review</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bottom Right: Ticker */}
          <section className="bento-card col-bottom-right">
             <div className="section-label" style={{marginBottom: '1rem'}}>Live Feed</div>
             <div className="ticker-feed">
                {transactions.map(txn => (
                  <div key={`tick-${txn.txn_id}`} className="ticker-item" onClick={() => setSelectedTxn(txn)}>
                    <div className="ticker-dot" style={{backgroundColor: getRiskColor(txn.status, Number(txn.confidence_score))}} />
                    <div className="num-val mono-dim">{new Date(txn.timestamp).toLocaleTimeString([],{hour12:false})}</div>
                    <div className="num-val" style={{marginLeft: 'auto'}}>{formatCurrency(txn.amount)}</div>
                  </div>
                ))}
             </div>
          </section>

        </div>
      </main>

      {/* Slide-out Drawer */}
      {selectedTxn && (
        <aside className="drawer open">
          <div className="drawer-header">
            <span className="section-label">Transaction Inspect</span>
            <button className="close-btn" onClick={() => setSelectedTxn(null)}><X size={16} /></button>
          </div>
          <div className="drawer-body">
            <div className="drawer-hero">
               <div className="drawer-score hero-value" style={{color: getRiskColor(selectedTxn.status, Number(selectedTxn.confidence_score))}}>
                 {(Number(selectedTxn.confidence_score) * 100).toFixed(1)}
               </div>
               <div className="section-label" style={{marginTop: '4px'}}>Risk Score</div>
               <div className="drawer-amount hero-value" style={{fontSize: '2rem', marginTop: '1rem', color: '#fff'}}>
                 {formatCurrency(selectedTxn.amount)}
               </div>
            </div>

            <div className="drawer-actions">
              <button className="action-btn decline">Decline</button>
              <button className="action-btn approve">Approve</button>
            </div>

            <div className="drawer-section">
               <div className="section-label mb-sm">Why Flagged</div>
               <div className="flag-list">
                 {getFlagReasons(selectedTxn.txn_id).map((r, idx) => (
                   <div key={idx} className="flag-item">
                     <r.icon size={12} color="var(--danger)" />
                     <span>{r.text}</span>
                   </div>
                 ))}
               </div>
            </div>

            <div className="drawer-section">
               <div className="section-label mb-sm">Details</div>
               <div className="detail-grid">
                 <div className="detail-lbl">ID</div>
                 <div className="detail-val num-val">{selectedTxn.txn_id.substring(0,8)}...</div>
                 <div className="detail-lbl">Time</div>
                 <div className="detail-val num-val">{new Date(selectedTxn.timestamp).toLocaleTimeString([],{hour12:false})}</div>
                 <div className="detail-lbl">Status</div>
                 <div className="detail-val" style={{color: getRiskColor(selectedTxn.status, Number(selectedTxn.confidence_score))}}>
                   {selectedTxn.status.toUpperCase()}
                 </div>
               </div>
            </div>

          </div>
        </aside>
      )}

    </div>
  );
}

const GlobalStyles = () => (
  <style>{`
    :root {
      --bg-base: #0e0e0e;
      --bg-card: #141414;
      --border: #1c1c1c;
      --accent: #dfff00;
      --danger: #ff4444;
      --amber: #ffaa00;
      --safe: #00e57a;
      --text-main: #f0f0f0;
      --text-dim: #666666;
    }

    .app-container {
      display: flex;
      height: 100vh;
      width: 100vw;
      background-color: var(--bg-base);
      color: var(--text-main);
      overflow: hidden;
      position: relative;
      font-family: 'Space Grotesk', sans-serif;
    }

    /* Fractal Noise */
    .noise-svg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.025;
      animation: breatheNoise 8s ease-in-out infinite alternate;
    }
    @keyframes breatheNoise {
      0% { opacity: 0.015; }
      100% { opacity: 0.035; }
    }

    /* Typography */
    .section-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 600;
    }
    .hero-value {
      font-family: 'DM Serif Display', serif;
      font-style: italic;
    }
    .num-val {
      font-family: 'Space Grotesk', monospace;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .mono-dim {
      color: var(--text-dim);
    }
    .text-xs { font-size: 11px; }

    /* Sidebar */
    .sidebar {
      width: 48px;
      border-right: 0.5px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem 0;
      z-index: 10;
      background: var(--bg-base);
    }
    .sidebar-logo {
      margin-bottom: 2rem;
    }
    .sidebar-links {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
    }
    .sidebar-btn {
      padding: 8px;
      border-radius: 6px;
      color: var(--text-dim);
      transition: all 0.2s;
    }
    .sidebar-btn:hover {
      color: var(--text-main);
      background: var(--bg-card);
    }
    .sidebar-btn.active {
      color: var(--accent);
      background: var(--bg-card);
    }
    .sidebar-bottom {
      margin-top: auto;
    }

    /* Main Content & Top Bar */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    .top-header {
      height: 48px;
      border-bottom: 0.5px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      background: var(--bg-base);
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .search-box input {
      background: none;
      border: none;
      color: var(--text-main);
      font-family: 'Space Grotesk', monospace;
      font-size: 11px;
      outline: none;
      width: 200px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .refresh-btn {
      color: var(--text-dim);
      transition: color 0.2s;
    }
    .refresh-btn:hover {
      color: var(--text-main);
    }

    /* Bento Grid */
    .bento-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 1.5rem;
      padding: 1.5rem;
      overflow-y: auto;
    }
    .bento-card {
      background: var(--bg-card);
      border: 0.5px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
    }
    .flex-col { flex-direction: column; }
    
    .col-left {
      grid-row: 1 / -1;
      grid-column: 1 / 2;
      gap: 2rem;
    }
    .col-top-right {
      grid-row: 1 / 2;
      grid-column: 2 / 3;
      flex-direction: column;
      overflow: hidden;
    }
    .col-bottom-right {
      grid-row: 2 / 3;
      grid-column: 2 / 3;
      flex-direction: column;
      overflow: hidden;
    }

    /* Hero Monitor */
    .hero-monitor {
      position: relative;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-ring {
      position: absolute;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 1px solid var(--accent);
      animation: pulseRing linear infinite;
    }
    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    .hero-center {
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--bg-card);
      padding: 1rem;
      border-radius: 50%;
      box-shadow: 0 0 20px var(--bg-card);
    }
    .hero-center .hero-value {
      font-size: 2.5rem;
      color: var(--text-main);
      line-height: 1;
    }

    /* KPI Cluster */
    .kpi-cluster {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .kpi-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-bottom: 0.5rem;
      border-bottom: 0.5px solid var(--border);
    }

    /* Flow Bars */
    .flow-bars-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .flow-bar-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .flow-label {
      width: 40px;
      font-size: 10px;
      font-weight: 500;
    }
    .flow-track {
      flex: 1;
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      position: relative;
    }
    .flow-fill {
      height: 100%;
      border-radius: 2px;
      position: absolute;
      left: 0; top: 0;
      transition: width 1s ease-in-out;
    }
    .flow-dot {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%) translateX(50%);
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .flow-val {
      width: 30px;
      text-align: right;
      font-size: 10px;
      color: var(--text-main);
    }

    /* Queue Table */
    .table-wrapper {
      flex: 1;
      overflow-y: auto;
    }
    .queue-table th {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      font-weight: 500;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 0.5px solid var(--border);
    }
    .queue-table td {
      padding: 12px;
      font-size: 12px;
      border-bottom: 0.5px solid rgba(28,28,28,0.5);
    }
    .queue-row {
      cursor: pointer;
      transition: background 0.2s;
    }
    .queue-row:hover {
      background: rgba(255,255,255,0.02);
    }
    .queue-row:hover .review-btn {
      opacity: 1;
    }
    .copy-cell {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .copy-icon {
      opacity: 0;
      transition: opacity 0.2s;
      color: var(--text-dim);
    }
    .queue-row:hover .copy-icon {
      opacity: 1;
    }
    .pill-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      border: 0.5px solid;
    }
    .review-btn {
      opacity: 0;
      font-size: 10px;
      text-transform: uppercase;
      border: 0.5px solid var(--border);
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .review-btn:hover {
      border-color: var(--text-dim);
      color: #fff;
    }

    /* Ticker Feed */
    .ticker-feed {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ticker-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--bg-base);
      border: 0.5px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
    }
    .ticker-item:hover {
      border-color: var(--text-dim);
    }
    .ticker-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    /* Drawer */
    .drawer {
      position: absolute;
      top: 0; right: 0;
      width: 260px;
      height: 100%;
      background: var(--bg-card);
      border-left: 0.5px solid var(--border);
      z-index: 100;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      animation: slideInDrawer 0.3s forwards;
    }
    @keyframes slideInDrawer {
      to { transform: translateX(0); }
    }
    .drawer-header {
      padding: 1.5rem;
      border-bottom: 0.5px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .close-btn {
      color: var(--text-dim);
    }
    .close-btn:hover { color: #fff; }
    .drawer-body {
      padding: 1.5rem;
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .drawer-hero {
      text-align: center;
    }
    .drawer-score {
      font-size: 4rem;
      line-height: 1;
    }
    
    .drawer-actions {
      display: flex;
      gap: 1rem;
    }
    .action-btn {
      flex: 1;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      border: 0.5px solid;
    }
    .action-btn.decline {
      color: var(--danger);
      border-color: var(--danger);
      background: rgba(255,68,68,0.1);
    }
    .action-btn.approve {
      color: var(--safe);
      border-color: var(--safe);
      background: rgba(0,229,122,0.1);
    }
    
    .mb-sm { margin-bottom: 12px; }
    
    .flag-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .flag-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg-base);
      border-left: 2px solid var(--danger);
      font-size: 11px;
      color: var(--text-main);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 12px;
      background: var(--bg-base);
      padding: 12px;
      border: 0.5px solid var(--border);
      border-radius: 4px;
    }
    .detail-lbl {
      font-size: 10px;
      color: var(--text-dim);
    }
    .detail-val {
      font-size: 11px;
      text-align: right;
    }

    /* Login */
    .login-container {
      display: flex;
      height: 100vh;
      width: 100vw;
      background: var(--bg-base);
      color: var(--text-main);
      align-items: center;
      justify-content: center;
      font-family: 'Space Grotesk', sans-serif;
    }
    .login-form {
      background: var(--bg-card);
      border: 0.5px solid var(--border);
      padding: 2.5rem;
      border-radius: 12px;
      width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .login-form input {
      width: 100%;
      background: var(--bg-base);
      border: 0.5px solid var(--border);
      color: var(--text-main);
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-family: 'Space Grotesk', monospace;
      font-size: 12px;
      outline: none;
    }
    .login-form input:focus {
      border-color: var(--text-dim);
    }
    .login-form button {
      width: 100%;
      background: var(--text-main);
      color: var(--bg-base);
      padding: 10px;
      border-radius: 4px;
      font-weight: 500;
      font-size: 12px;
      transition: opacity 0.2s;
    }
    .login-form button:hover {
      opacity: 0.9;
    }
  `}</style>
);
