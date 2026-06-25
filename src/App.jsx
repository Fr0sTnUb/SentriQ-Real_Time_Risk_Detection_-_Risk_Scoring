import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { login } from './services/api';
import AppShell from './components/AppShell';
import Overview from './pages/Overview';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Monitoring from './pages/Monitoring';
import ModelCenter from './pages/ModelCenter';
import Settings from './pages/Settings';
import { useState } from 'react';

function LoginScreen() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { dispatch } = useAuth();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await login(form);
      dispatch({ type: 'login', token: payload.access_token });
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={submit}>
        <ShieldAlert size={32} color="var(--accent)" />
        <h1 className="hero-value">SentriQ</h1>
        <div className="section-label">Analyst Login</div>
        {error && <div className="login-error">{error}</div>}
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit" disabled={loading}>{loading ? 'Authenticating...' : 'Secure Login'}</button>
      </form>
    </div>
  );
}

function ProtectedRoutes() {
  const { state } = useAuth();
  if (!state.token) return <LoginScreen />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Overview />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/model" element={<ModelCenter />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ProtectedRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
