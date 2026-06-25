// Page: Transactions
import { useEffect, useMemo, useState } from 'react';
import { getRecentTransactions } from '../services/api';
import TransactionDrawer from '../components/TransactionDrawer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatCurrency, merchantName, reviewStatus } from '../utils/format';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', kind: 'All', from: '', to: '', merchant: '' });

  useEffect(() => {
    getRecentTransactions(100).then(setTransactions).catch(() => setError('/api/transactions/recent')).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      const merchant = merchantName(txn.txn_id).toLowerCase();
      const date = txn.timestamp ? txn.timestamp.slice(0, 10) : '';
      const kindOk = filters.kind === 'All' || txn.status === filters.kind;
      return kindOk
        && txn.txn_id.toLowerCase().includes(filters.search.toLowerCase())
        && (!filters.from || date >= filters.from)
        && (!filters.to || date <= filters.to)
        && merchant.includes(filters.merchant.toLowerCase());
    });
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 15));
  const rows = filtered.slice((page - 1) * 15, page * 15);

  const exportCsv = () => {
    const headers = ['Timestamp', 'Txn ID', 'Amount', 'Merchant', 'Risk Score', 'Prediction', 'Status'];
    const csv = [headers, ...filtered.map((txn) => [
      txn.timestamp,
      txn.txn_id,
      txn.amount,
      merchantName(txn.txn_id),
      txn.risk_score,
      txn.status,
      reviewStatus(txn),
    ])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sentriq-transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page-content"><LoadingState /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  return (
    <div className="page-content">
      <section className="bento-card investigation-panel flex-col">
        <div className="toolbar-row">
          <input placeholder="Search Txn ID" value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
          <select value={filters.kind} onChange={(e) => { setFilters({ ...filters, kind: e.target.value }); setPage(1); }}><option>All</option><option>Fraud</option><option>Legit</option></select>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <input placeholder="Merchant" value={filters.merchant} onChange={(e) => setFilters({ ...filters, merchant: e.target.value })} />
          <button onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="table-wrapper">
          <table className="queue-table investigation-table">
            <thead><tr><th>Timestamp</th><th>Txn ID</th><th>Amount</th><th>Merchant</th><th>Risk Score</th><th>Prediction</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((txn) => (
                <tr key={txn.txn_id} onClick={() => setSelectedTxn(txn)} className={`queue-row ${txn.status === 'Fraud' ? 'fraud-row' : ''}`}>
                  <td className="num-val">{new Date(txn.timestamp).toLocaleString()}</td>
                  <td className="num-val">{txn.txn_id}</td>
                  <td className="num-val">{formatCurrency(txn.amount)}</td>
                  <td>{merchantName(txn.txn_id)}</td>
                  <td className="num-val">{txn.risk_score}</td>
                  <td>{txn.status}</td>
                  <td><span className={`status-badge status-${reviewStatus(txn).toLowerCase()}`}>{reviewStatus(txn)}</span></td>
                  <td><button className="review-btn">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination-row">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </section>
      <TransactionDrawer transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
    </div>
  );
}
