import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export default function FraudByHourChart({ data }) {
  const grouped = Array.from({ length: 24 }, (_, hour) => ({ hour, fraud_count: 0 }));
  data.forEach((item) => {
    const hour = Number(String(item.time).split(':')[0]);
    if (!Number.isNaN(hour)) grouped[hour].fraud_count += item.fraud_count || 0;
  });
  return (
    <div className="chart-panel">
      <div className="section-label">FRAUD BY HOUR</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={grouped}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis dataKey="hour" stroke="#666" tick={{ fontSize: 8 }} />
          <YAxis stroke="#666" tick={{ fontSize: 8 }} />
          <Bar dataKey="fraud_count" fill="var(--danger)" barSize={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
