export const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

export const formatPercent = (value, fractionDigits = 2) =>
  `${Number(value ?? 0).toFixed(fractionDigits)}%`;

export const formatCurrency = (value) =>
  `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const merchantName = (txnId = '') => {
  const entities = ['Acme Corp', 'Global Tech', 'Local Merchant', 'Online Store', 'TechSubs Inc', 'Retail Giant', 'Cafe Latte'];
  const hash = txnId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return entities[hash % entities.length];
};

export const riskColor = (status, score) => {
  if (status === 'Fraud' || score > 70 || score > 0.7) return 'var(--danger)';
  if (score > 40 || score > 0.4) return 'var(--amber)';
  return 'var(--safe)';
};

export const riskLevel = (status, score) => {
  if (status === 'Fraud' || score > 70 || score > 0.7) return 'HIGH';
  if (score > 40 || score > 0.4) return 'MED';
  return 'LOW';
};

export const reviewStatus = (txn) => {
  if (txn.status === 'Fraud' || txn.is_fraud) return 'BLOCKED';
  if ((txn.risk_score ?? 0) >= 45) return 'REVIEW';
  return 'CLEARED';
};
