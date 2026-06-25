import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export default function VolumeOverlayChart({ data }) {
  return (
    <div className="chart-panel">
      <div className="section-label">VOLUME OVERLAY</div>
      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 8 }} />
          <YAxis yAxisId="left" stroke="#666" tick={{ fontSize: 8 }} />
          <YAxis yAxisId="right" orientation="right" stroke="#666" tick={{ fontSize: 8 }} />
          <Bar yAxisId="left" dataKey="transaction_count" fill="#1a1a1a" />
          <Line yAxisId="right" type="monotone" dataKey="fraud_count" stroke="var(--danger)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
