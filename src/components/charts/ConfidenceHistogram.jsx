import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

export default function ConfidenceHistogram({ transactions }) {
  const buckets = Array.from({ length: 10 }, (_, index) => ({ bin: `${index / 10}-${(index + 1) / 10}`, count: 0 }));
  transactions.forEach((txn) => {
    const score = Math.max(0, Math.min(0.999, Number(txn.confidence_score || 0)));
    buckets[Math.floor(score * 10)].count += 1;
  });
  return (
    <div className="chart-panel">
      <div className="section-label">CONFIDENCE DISTRIBUTION</div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={buckets}>
          <CartesianGrid stroke="#1a1a1a" />
          <XAxis dataKey="bin" stroke="#666" tick={{ fontSize: 8 }} />
          <YAxis stroke="#666" tick={{ fontSize: 8 }} />
          <Bar dataKey="count" fill="var(--accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
