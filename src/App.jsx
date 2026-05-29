import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  AlertOctagon, 
  TrendingDown, 
  CheckCircle2, 
  CreditCard,
  Percent
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
  Legend
} from 'recharts';
import { motion } from 'framer-motion';

// --- Dummy Data ---

const chartData = [
  { time: '10:00', totalVolume: 4000, fraudVolume: 24 },
  { time: '10:05', totalVolume: 3000, fraudVolume: 13 },
  { time: '10:10', totalVolume: 2000, fraudVolume: 98 },
  { time: '10:15', totalVolume: 2780, fraudVolume: 39 },
  { time: '10:20', totalVolume: 1890, fraudVolume: 48 },
  { time: '10:25', totalVolume: 2390, fraudVolume: 38 },
  { time: '10:30', totalVolume: 3490, fraudVolume: 43 },
  { time: '10:35', totalVolume: 4100, fraudVolume: 20 },
  { time: '10:40', totalVolume: 3800, fraudVolume: 15 },
  { time: '10:45', totalVolume: 2900, fraudVolume: 110 },
  { time: '10:50', totalVolume: 3300, fraudVolume: 25 },
  { time: '10:55', totalVolume: 4500, fraudVolume: 30 },
];

const pieData = [
  { name: 'Legit', value: 124250 },
  { name: 'Fraud', value: 342 },
];

const PIE_COLORS = ['#10b981', '#f43f5e']; // emerald-500, rose-500

const recentTransactions = [
  { id: 'tx_8f92a1', timestamp: '2023-10-27T10:55:01Z', amount: 1450.00, confidence: 99.8, status: 'Legit' },
  { id: 'tx_3b47c2', timestamp: '2023-10-27T10:55:04Z', amount: 24.50, confidence: 98.2, status: 'Legit' },
  { id: 'tx_9e11d4', timestamp: '2023-10-27T10:55:08Z', amount: 8400.00, confidence: 12.4, status: 'Fraud' },
  { id: 'tx_7a22f5', timestamp: '2023-10-27T10:55:12Z', amount: 120.75, confidence: 95.1, status: 'Legit' },
  { id: 'tx_1c88e9', timestamp: '2023-10-27T10:55:15Z', amount: 3200.50, confidence: 8.7, status: 'Fraud' },
  { id: 'tx_5d99b3', timestamp: '2023-10-27T10:55:18Z', amount: 85.00, confidence: 97.4, status: 'Legit' },
];

// --- Components ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

const KPICard = ({ title, value, icon: Icon, change, changeType, accentClass }) => (
  <Card className="flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-slate-400 font-medium text-sm">{title}</h3>
      <div className={`p-2 rounded-lg ${accentClass.bg} ${accentClass.text}`}>
        <Icon size={20} />
      </div>
    </div>
    <div>
      <div className="text-3xl font-mono font-bold text-slate-100">{value}</div>
      <div className="flex items-center mt-2 space-x-1">
        <span className={`text-xs font-medium ${changeType === 'positive' ? 'text-emerald-400' : changeType === 'negative' ? 'text-rose-400' : 'text-slate-500'}`}>
          {change}
        </span>
        <span className="text-xs text-slate-500">vs last 24h</span>
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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 grid grid-cols-12 gap-6">
        
        {/* Top Navbar */}
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
          <div className="flex items-center space-x-2 mt-4 sm:mt-0 bg-slate-950 py-1.5 px-4 rounded-full border border-slate-800">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <span className="text-sm font-medium text-emerald-400">System Online - Model Active</span>
          </div>
        </div>

        {/* KPI Metrics Grid */}
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <KPICard 
              title="Total Transactions (24h)" 
              value="124,592" 
              icon={CreditCard} 
              change="+12.5%" 
              changeType="neutral"
              accentClass={{ bg: 'bg-indigo-500/10', text: 'text-indigo-400' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <KPICard 
              title="Fraud Detected" 
              value="342" 
              icon={AlertOctagon} 
              change="+5.2%" 
              changeType="negative"
              accentClass={{ bg: 'bg-rose-500/10', text: 'text-rose-500' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <KPICard 
              title="Current Fraud Rate" 
              value="0.27%" 
              icon={TrendingDown} 
              change="-0.04%" 
              changeType="positive"
              accentClass={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <KPICard 
              title="Avg Model Confidence" 
              value="96.4%" 
              icon={Percent} 
              change="+1.2%" 
              changeType="positive"
              accentClass={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }}
            />
          </motion.div>
        </div>

        {/* Visualization Row */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Area Chart - Col Span 8 */}
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
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
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

          {/* Pie Chart - Col Span 4 */}
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
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                    itemStyle={{ fontFamily: 'monospace' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              {/* Center text for donut */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-18px]">
                <div className="text-xs text-slate-400">Total</div>
                <div className="text-lg font-mono font-bold text-slate-200">124.5k</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Transaction Feed */}
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
                {recentTransactions.map((txn, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: 0.1 * idx }}
                    key={txn.id} 
                    className={`hover:bg-slate-800/30 transition-colors ${txn.status === 'Fraud' ? 'bg-rose-500/5' : ''}`}
                  >
                    <td className="p-4 whitespace-nowrap text-sm font-mono text-slate-300">
                      {new Date(txn.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-mono text-indigo-300 font-medium">
                      {txn.id}
                    </td>
                    <td className="p-4 whitespace-nowrap text-sm font-mono text-slate-200 text-right">
                      ${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-sm font-mono font-medium text-slate-300 w-12 text-right">
                          {txn.confidence.toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${txn.status === 'Fraud' ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${txn.confidence}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <Badge status={txn.status} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  );
}
