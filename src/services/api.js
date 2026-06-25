import axios from 'axios';

export const API_BASE_URL = 'http://localhost:8000';
export const WS_BASE_URL = 'ws://localhost:8000';

const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('sentriq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const unwrap = (response) => response.data?.data ?? response.data;

export async function login(credentials) {
  return unwrap(await apiClient.post('/api/auth/login', credentials));
}

export async function getSummary() {
  return unwrap(await apiClient.get('/api/stats/summary'));
}

export async function getHourly() {
  return unwrap(await apiClient.get('/api/stats/hourly'));
}

export async function getDistribution() {
  return unwrap(await apiClient.get('/api/stats/distribution'));
}

export async function getRecentTransactions(limit = 50, fraudOnly = false) {
  return unwrap(await apiClient.get('/api/transactions/recent', { params: { limit, fraud_only: fraudOnly } }));
}

export async function getTransactionDetail(txnId) {
  return unwrap(await apiClient.get(`/api/transactions/${txnId}`));
}

export async function getModelHealth() {
  return unwrap(await apiClient.get('/api/model/health'));
}

export async function getModelMetrics() {
  return unwrap(await apiClient.get('/api/model/metrics'));
}

export async function getDrift() {
  return unwrap(await apiClient.get('/api/model/drift'));
}

export async function retrainModel() {
  return unwrap(await apiClient.post('/api/model/retrain'));
}

export async function getRetrainStatus(jobId) {
  return unwrap(await apiClient.get(`/api/model/retrain/status/${jobId}`));
}

export async function getExplanation(txnId) {
  return unwrap(await apiClient.get(`/api/predict/explain/${txnId}`));
}

export async function getConfig() {
  return unwrap(await apiClient.get('/api/config'));
}

export async function updateThreshold(threshold) {
  return unwrap(await apiClient.post('/api/config/threshold', { threshold }));
}

export async function reviewTransaction(txnId, action) {
  return unwrap(await apiClient.post(`/api/review/${txnId}`, { action }));
}

export default apiClient;
