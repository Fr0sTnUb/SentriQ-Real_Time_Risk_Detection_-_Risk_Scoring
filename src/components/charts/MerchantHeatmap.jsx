import { merchantName } from '../../utils/format';

export default function MerchantHeatmap({ transactions }) {
  const map = new Map();
  transactions.forEach((txn) => {
    const merchant = txn.merchant || merchantName(txn.txn_id);
    const entry = map.get(merchant) || { merchant, total: 0, count: 0 };
    entry.total += Number(txn.risk_score || 0);
    entry.count += 1;
    map.set(merchant, entry);
  });
  const rows = Array.from(map.values()).map((entry) => ({ ...entry, score: entry.total / entry.count }));
  return (
    <div className="chart-panel">
      <div className="section-label">MERCHANT RISK MAP</div>
      <div className="heatmap-grid">
        {rows.map((row) => (
          <div
            className="heatmap-cell"
            key={row.merchant}
            style={{ background: `rgba(255,51,51,${Math.max(0.08, row.score / 100)})` }}
          >
            <span>{row.merchant}</span>
            <b>{row.score.toFixed(0)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
