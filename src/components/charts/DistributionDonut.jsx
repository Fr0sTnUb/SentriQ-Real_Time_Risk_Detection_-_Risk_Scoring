import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatPercent } from '../../utils/format';

export default function DistributionDonut({ data }) {
  const total = (data?.fraud_count || 0) + (data?.legit_count || 0);
  const pct = total ? (data.fraud_count / total) * 100 : 0;
  const chartData = [
    { name: 'Fraud', value: data?.fraud_count || 0 },
    { name: 'Legit', value: data?.legit_count || 0 },
  ];
  return (
    <div className="chart-panel donut-panel">
      <div className="section-label">FRAUD VS LEGIT</div>
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={55} outerRadius={82} paddingAngle={2}>
            <Cell fill="var(--danger)" />
            <Cell fill="#1a1a1a" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center hero-value">{formatPercent(pct, 1)}</div>
    </div>
  );
}
