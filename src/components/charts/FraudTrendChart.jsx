import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function FraudTrendChart({ data }) {
  return (
    <div className="chart-panel">
      <div className="section-label">FRAUD TREND · 24H</div>
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 8 }} />
          <YAxis stroke="#666" tick={{ fontSize: 8 }} />
          <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }} />
          <Area dataKey="fraud_count" stroke="var(--danger)" fill="rgba(255,51,51,.15)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
