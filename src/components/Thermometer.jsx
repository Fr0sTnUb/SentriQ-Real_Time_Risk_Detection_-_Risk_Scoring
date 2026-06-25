export default function Thermometer({ value = 0, max = 100, label, color = 'var(--safe)' }) {
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
  return (
    <div className="thermo-card">
      <div className="thermo">
        <div className="thermo-liquid" style={{ height: `${pct}%`, background: color }} />
      </div>
      <div className="thermo-value">{Math.round(value)}{max === 100 ? '%' : ''}</div>
      <div className="section-label">{label}</div>
    </div>
  );
}
