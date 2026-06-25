// Page: Model Center
import { useEffect, useState } from 'react';
import { getExplanation, getModelHealth, getModelMetrics, getRecentTransactions, getRetrainStatus, retrainModel } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatPercent } from '../utils/format';
import { useNotifications } from '../context/NotificationContext';

export default function ModelCenter() {
  const [state, setState] = useState({ health: null, metrics: null, explanation: null, recent: [] });
  const [txnId, setTxnId] = useState('');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addNotification } = useNotifications();

  useEffect(() => {
    Promise.all([getModelHealth(), getModelMetrics(), getRecentTransactions(1)])
      .then(async ([health, metrics, recent]) => {
        const explanation = recent?.[0] ? await getExplanation(recent[0].txn_id) : null;
        setTxnId(recent?.[0]?.txn_id || '');
        setState({ health, metrics, explanation, recent });
      })
      .catch(() => setError('/api/model/health'))
      .finally(() => setLoading(false));
  }, []);

  const startRetrain = async () => {
    const result = await retrainModel();
    setJob(result);
    const id = window.setInterval(async () => {
      const status = await getRetrainStatus(result.job_id);
      setJob(status);
      if (status.status === 'complete' || status.status === 'failed') {
        window.clearInterval(id);
        addNotification(status.status === 'complete' ? 'safe' : 'danger', `RETRAIN ${status.status.toUpperCase()} · ${status.model_version || result.job_id}`);
      }
    }, 3000);
  };

  const explain = async () => {
    if (!txnId) return;
    const explanation = await getExplanation(txnId);
    setState((current) => ({ ...current, explanation }));
  };

  if (loading) return <div className="page-content"><LoadingState /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  const featureRows = Object.entries(state.explanation?.feature_importances || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="page-content model-page">
      <div className="model-grid">
        <section className="bento-card flex-col">
          <div className="section-label">Active Model</div>
          <h2>XGBoost_v1.2</h2>
          <div className="detail-grid">
            <div>Version</div><div>{state.health.model_version}</div>
            <div>Training Date</div><div>{new Date(state.metrics.evaluated_at).toLocaleDateString()}</div>
            <div>Status</div><div className={state.health.is_mock ? 'amber-text' : 'safe-text'}>{state.health.is_mock ? 'MOCK MODEL ACTIVE' : 'REAL MODEL LOADED'}</div>
          </div>
          <button onClick={startRetrain}>{job ? `Training... ${job.status}` : 'RETRAIN MODEL'}</button>
          <button disabled title="No previous version">ROLLBACK</button>
          <button>COMPARE MODELS</button>
        </section>
        <section className="bento-card flex-col">
          <div className="section-label">FEATURE IMPORTANCE · CURRENT MODEL</div>
          <FeatureBars rows={featureRows} />
        </section>
        <section className="bento-card flex-col">
          <div className="section-label">Training History</div>
          <table className="queue-table"><thead><tr><th>Version</th><th>AUC</th><th>F1</th><th>Precision</th><th>Recall</th><th>Date</th></tr></thead><tbody><tr className="current-row"><td>{state.metrics.model_version}</td><td>{state.metrics.auc_roc}</td><td>{state.metrics.f1_score}</td><td>{state.metrics.precision_val}</td><td>{state.metrics.recall}</td><td>{new Date(state.metrics.evaluated_at).toLocaleDateString()}</td></tr></tbody></table>
        </section>
      </div>
      <section className="bento-card flex-col">
        <div className="section-label">TRANSACTION EXPLAINABILITY</div>
        <div className="toolbar-row"><input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="Enter Txn ID" /><button onClick={explain}>Explain</button></div>
        <div className="reason-list">
          {featureRows.map(([name, score]) => <div className="reason-item" key={name}><span className={score >= 0 ? 'danger-text' : 'safe-text'}>{score >= 0 ? '[+]' : '[-]'}</span> {name.toUpperCase()} · importance: {Number(score).toFixed(3)}</div>)}
        </div>
      </section>
    </div>
  );
}

function FeatureBars({ rows }) {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return <div className="feature-bars">{rows.map(([name, value]) => <div className="feature-row" key={name}><span>{name}</span><div><i style={{ width: `${(value / max) * 100}%` }} /></div><b>{formatPercent(value * 100, 1)}</b></div>)}</div>;
}
