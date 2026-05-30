import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Activity,
  AlertOctagon,
  TrendingDown,
  CheckCircle2,
  CreditCard,
  Percent,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';

const API_BASE_URL = 'http://localhost:8000';
const PIE_COLORS = ['#10b981', '#f43f5e'];

const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

const formatPercent = (value, fractionDigits = 2) =>
  `${Number(value ?? 0).toFixed(fractionDigits)}%`;

const formatCurrency = (value) =>
  `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const confidencePercent = (score) =>
  Math.min(100, Math.max(0, Number(score ?? 0) * 100));

async function fetchApi(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload.success === false) {
    throw new Error(payload.detail || payload.message || 'API request failed');
  }

  return payload.data;
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

const KPICard = ({ title, value, icon: Icon, detail, detailType, accentClass }) => (
  <Card className="flex flex-col justify-between min-h-36">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-slate-400 font-medium text-sm">{title}</h3>
      <div className={`p-2 rounded-lg ${accentClass.bg} ${accentClass.text}`}>
        <Icon size={20} />
      </div>
    </div>
    <div>
      <div className="text-3xl font-mono font-bold text-slate-100">{value}</div>
      <div className="flex items-center mt-2 space-x-1">
        <span className={`text-xs font-medium ${
          detailType === 'positive'
            ? 'text-emerald-400'
            : detailType === 'negative'
              ? 'text-rose-400'
              : 'text-slate-500'
        }`}
        >
          {detail}
        </span>
      </div>
    </div>
  </Card>
);

const Badge = ({ status }) => {
  if (status === 'Fraud') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-500 border border-rose-500/50">
        <AlertOctagon size={12} className="mr-1" />
        FRAUD
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={12} className="mr-1" />
      Legit
    </span>
  );
};

function LoginScreen({ loading, loginError, loginForm, setLoginForm, onSubmit }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 flex items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <ShieldAlert className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">FraudGuard ML</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sign in</p>
          </div>
        </div>

        {loginError && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {loginError}
          </div>
        )}

        <label className="block text-sm text-slate-300 mb-2" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={loginForm.username}
          onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400"
          autoComplete="username"
          required
        />

        <label className="block text-sm text-slate-300 mb-2" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={loginForm.password}
          onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
          className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            'Login'
          )}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [kpiData, setKpiData] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [distributionData, setDistributionData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isCurrent = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [summary, hourly, distribution, recent] = await Promise.all([
          fetchApi('/api/stats/summary', token),
          fetchApi('/api/stats/hourly', token),
          fetchApi('/api/stats/distribution', token),
          fetchApi('/api/transactions/recent?limit=20', token),
        ]);

        if (!isCurrent) {
          return;
        }

        setKpiData(summary);
        setHourlyData(hourly ?? []);
        setDistributionData(distribution);
        setTransactions(recent ?? []);
        setConnectionError('');
      } catch {
        if (isCurrent) {
          setConnectionError('Backend connection lost');
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();
    const intervalId = window.setInterval(fetchDashboardData, 10000);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
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

      if (!response.ok) {
        throw new Error(`Login failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.success || !payload.data?.access_token) {
        throw new Error(payload.message || 'Login failed');
      }

      setToken(payload.data.access_token);
      setConnectionError('');
      setLoginForm({ username: '', password: '' });
    } catch {
      setLoginError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <LoginScreen
        loading={loading}
        loginError={loginError}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        onSubmit={handleLogin}
      />
    );
  }

  const chartData = hourlyData.map((point) => ({
    time: point.time,
    totalVolume: point.transaction_count,
    fraudVolume: point.fraud_count,
  }));

  const pieData = [
    { name: 'Legit', value: distributionData?.legit_count ?? 0 },
    { name: 'Fraud', value: distributionData?.fraud_count ?? 0 },
  ];
  const distributionTotal = pieData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col sm:flex-row justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
              <ShieldAlert className="text-indigo-400" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">FraudGuard ML</h1>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Live System</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            {loading && (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
            )}
            <div className={`flex items-center space-x-2 py-1.5 px-4 rounded-full border ${
              connectionError
                ? 'bg-rose-500/10 border-rose-500/40'
                : 'bg-slate-950 border-slate-800'
            }`}
            >
              <div className="relative flex h-3 w-3">
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  connectionError ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                />
              </div>
              <span className={`text-sm font-medium ${
                connectionError ? 'text-rose-300' : 'text-emerald-400'
              }`}
              >
                {connectionError || 'Backend Connected'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setToken('')}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>

        {connectionError && (
          <div className="col-span-12 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300">
            Backend connection lost
          </div>
        )}

        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <KPICard
              title="Total Transactions (24h)"
              value={formatNumber(kpiData?.total_transactions_24h)}
              icon={CreditCard}
              detail={`${formatNumber(kpiData?.transactions_per_minute)} / min`}
              detailType="neutral"
              accentClass={{ bg: 'bg-indigo-500/10', text: 'text-indigo-400' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <KPICard
              title="Fraud Detected"
              value={formatNumber(kpiData?.fraud_count_24h)}
              icon={AlertOctagon}
              detail="Last 24h"
              detailType="negative"
              accentClass={{ bg: 'bg-rose-500/10', text: 'text-rose-500' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <KPICard
              title="Current Fraud Rate"
              value={formatPercent(kpiData?.fraud_rate_percent)}
              icon={TrendingDown}
              detail="Database aggregate"
              detailType="neutral"
              accentClass={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <KPICard
              title="Avg Model Confidence"
              value={formatPercent((kpiData?.avg_confidence ?? 0) * 100, 1)}
              icon={Percent}
              detail="Prediction mean"
              detailType="positive"
              accentClass={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }}
            />
          </motion.div>
        </div>

        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="col-span-1 lg:col-span-8 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center">
              <Activity className="mr-2 text-indigo-400" size={20} />
              Transaction Volume vs Fraud Volume (60m)
            </h3>
            <div className="h-72 w-full flex-grow">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '14px', fontFamily: 'monospace' }}
                  />
                  <Area type="monotone" dataKey="totalVolume" name="Total Vol" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="fraudVolume" name="Fraud Vol" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorFraud)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-1 lg:col-span-4 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-100 mb-2 text-center">
              Classification Distribution
            </h3>
            <div className="h-72 w-full flex-grow flex flex-col justify-center items-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                    itemStyle={{ fontFamily: 'monospace' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-18px]">
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-lg font-mono font-bold text-slate-200">{formatNumber(distributionTotal)}</div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="col-span-12 overflow-hidden !p-0">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="text-lg font-semibold text-slate-100 flex items-center">
              Live Transaction Feed
              <span className="ml-3 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-400">Real-time</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <th className="p-4 font-medium">Timestamp</th>
                  <th className="p-4 font-medium">Txn ID</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium text-center">Model Confidence</th>
                  <th className="p-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {transactions.map((txn, idx) => {
                  const confidence = confidencePercent(txn.confidence_score);

                  return (
                    <motion.tr
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(0.5, 0.03 * idx) }}
                      key={txn.txn_id}
                      className={`hover:bg-slate-800/30 transition-colors ${txn.status === 'Fraud' ? 'bg-rose-500/5' : ''}`}
                    >
                      <td className="p-4 whitespace-nowrap text-sm font-mono text-slate-300">
                        {new Date(txn.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="p-4 whitespace-nowrap text-sm font-mono text-indigo-300 font-medium">
                        {txn.txn_id}
                      </td>
                      <td className="p-4 whitespace-nowrap text-sm font-mono text-slate-200 text-right">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-sm font-mono font-medium text-slate-300 w-12 text-right">
                            {confidence.toFixed(1)}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${txn.status === 'Fraud' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <Badge status={txn.status} />
                      </td>
                    </motion.tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-sm text-slate-500" colSpan={5}>
                      {loading ? 'Loading transactions...' : 'No transactions found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
