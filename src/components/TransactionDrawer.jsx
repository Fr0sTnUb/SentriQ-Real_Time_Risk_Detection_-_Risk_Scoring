import { X } from 'lucide-react';
import { formatCurrency, riskColor } from '../utils/format';

const reasons = [
  '[+] HIGH AMOUNT · above normal customer band',
  '[+] PCA ANOMALY · elevated model feature weight',
  '[-] KNOWN PATTERN · similar to historic legitimate flow',
];

export default function TransactionDrawer({ transaction, onClose }) {
  if (!transaction) return null;
  const score = Number(transaction.risk_score ?? transaction.confidence_score ?? 0);
  const color = riskColor(transaction.status, score);

  return (
    <aside className="drawer open">
      <div className="drawer-header">
        <span className="section-label">Transaction Inspect</span>
        <button className="close-btn" onClick={onClose} aria-label="Close transaction drawer"><X size={16} /></button>
      </div>
      <div className="drawer-body">
        <div className="drawer-hero">
          <div className="drawer-score hero-value" style={{ color }}>{Number(score).toFixed(0)}</div>
          <div className="section-label">Risk Score</div>
          <div className="drawer-amount hero-value">{formatCurrency(transaction.amount)}</div>
        </div>
        <div className="drawer-actions">
          <button className="action-btn decline">Decline</button>
          <button className="action-btn approve">Approve</button>
        </div>
        <div className="drawer-section">
          <div className="section-label mb-sm">Why Flagged</div>
          <div className="flag-list">
            {reasons.map((reason) => <div className="flag-item" key={reason}>{reason}</div>)}
          </div>
        </div>
        <div className="drawer-section">
          <div className="section-label mb-sm">Details</div>
          <div className="detail-grid">
            <div className="detail-lbl">ID</div>
            <div className="detail-val num-val">{transaction.txn_id}</div>
            <div className="detail-lbl">Time</div>
            <div className="detail-val num-val">{new Date(transaction.timestamp || transaction.created_at).toLocaleString()}</div>
            <div className="detail-lbl">Status</div>
            <div className="detail-val" style={{ color }}>{String(transaction.status || '').toUpperCase()}</div>
            <div className="detail-lbl">Model</div>
            <div className="detail-val">{transaction.model_version}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
