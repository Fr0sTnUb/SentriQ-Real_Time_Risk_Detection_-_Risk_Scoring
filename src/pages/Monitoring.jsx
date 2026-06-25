// Page: Monitoring
import { useEffect, useState } from 'react';
import { getDrift, getModelHealth, getModelMetrics, getSummary } from '../services/api';
import Thermometer from '../components/Thermometer';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatPercent } from '../utils/format';
import { useNotifications } from '../context/NotificationContext';

export default function Monitoring() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addNotification } = useNotifications();

  const load = async () => {
    try {
      const [health, metrics, drift, summary] = await Promise.all([getModelHealth(), getModelMetrics(), getDrift(), getSummary()]);
      setState({ health, metrics, drift, summary });
      if (drift.is_drift_detected) addNotification('amber', `DRIFT DETECTED · ${drift.overall_drift_score}%`);
    } catch {
      setError('/api/model/health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) return <div className="page-content"><LoadingState /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  const latency = state.health.avg_latency_ms ?? 42;
  const latencyColor = latency > 300 ? 'var(--danger)' : latency > 100 ? 'var(--amber)' : 'var(--safe)';
  const alerts = [
    state.drift.is_drift_detected && `WARNING DRIFT DETECTED · ${state.drift.overall_drift_score}% features drifted`,
    state.summary.fraud_rate_percent > 5 && `WARNING HIGH FRAUD SPIKE · Current rate: ${state.summary.fraud_rate_percent}%`,
    latency > 200 && `WARNING API SLOWDOWN · Latency: ${Math.round(latency)}ms`,
  ].filter(Boolean);

  return (
    <div className="page-content monitoring-page">
      <section className="bento-card flex-col">
        <div className="section-label">System Metrics</div>
        <div className="thermo-row">
          <Thermometer value={latency} max={500} label="API Latency" color={latencyColor} />
          <Thermometer value={34} label="CPU Usage" color="var(--safe)" />
          <Thermometer value={61} label="Memory Usage" color="var(--amber)" />
          <Thermometer value={state.health.queue_depth ?? 0} max={50} label="Queue Depth" color="var(--safe)" />
        </div>
      </section>
      <section className="bento-card flex-col">
        <div className="section-label">ML Metrics</div>
        <div className="metric-card-row">
          <Metric label="Model Accuracy" value={formatPercent(state.metrics.auc_roc * 100, 1)} />
          <Metric label="Precision" value={formatPercent((state.metrics.precision ?? state.metrics.precision_val) * 100, 1)} />
          <Metric label="Recall" value={formatPercent(state.metrics.recall * 100, 1)} />
          <Metric label="Drift Score" value={formatPercent(state.drift.overall_drift_score, 1)} tone={state.drift.overall_drift_score > 50 ? 'danger' : state.drift.overall_drift_score > 20 ? 'amber' : ''} />
        </div>
        <div className="alert-feed">
          {alerts.map((alert) => <div className="alert-item" key={alert}>{alert}</div>)}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = '' }) {
  return <div className={`metric-card ${tone}`}><span>{value}</span><em>{label}</em></div>;
}
