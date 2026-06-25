// Page: Analytics
import { useEffect, useState } from 'react';
import { getDistribution, getHourly, getRecentTransactions } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import FraudTrendChart from '../components/charts/FraudTrendChart';
import DistributionDonut from '../components/charts/DistributionDonut';
import FraudByHourChart from '../components/charts/FraudByHourChart';
import ConfidenceHistogram from '../components/charts/ConfidenceHistogram';
import MerchantHeatmap from '../components/charts/MerchantHeatmap';
import VolumeOverlayChart from '../components/charts/VolumeOverlayChart';

export default function Analytics() {
  const [data, setData] = useState({ hourly: [], distribution: null, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getHourly(), getDistribution(), getRecentTransactions(200)])
      .then(([hourly, distribution, transactions]) => setData({ hourly, distribution, transactions }))
      .catch(() => setError('/api/stats/hourly'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-content"><LoadingState rows={6} /></div>;
  if (error) return <div className="page-content"><ErrorState endpoint={error} /></div>;

  return (
    <div className="page-content analytics-grid">
      <FraudTrendChart data={data.hourly} />
      <DistributionDonut data={data.distribution} />
      <FraudByHourChart data={data.hourly} />
      <ConfidenceHistogram transactions={data.transactions} />
      <MerchantHeatmap transactions={data.transactions} />
      <VolumeOverlayChart data={data.hourly} />
    </div>
  );
}
