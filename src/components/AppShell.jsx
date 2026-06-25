import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, LayoutDashboard, Search, Settings, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/transactions', icon: Activity, label: 'Transactions' },
  { to: '/analytics', icon: Users, label: 'Analytics' },
  { to: '/monitoring', icon: Bell, label: 'Monitoring' },
  { to: '/model', icon: ShieldAlert, label: 'Model' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppShell() {
  const { dispatch } = useAuth();

  return (
    <div className="app-container">
      <div className="noise-overlay" />
      <nav className="sidebar">
        <div className="sidebar-logo"><ShieldAlert size={20} color="var(--accent)" /></div>
        <div className="sidebar-links">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `sidebar-btn ${isActive ? 'active' : ''}`} title={label}>
              <Icon size={18} />
            </NavLink>
          ))}
        </div>
        <button className="sidebar-btn" onClick={() => dispatch({ type: 'logout' })} title="Logout">
          <Bell size={18} />
        </button>
      </nav>
      <main className="main-content">
        <header className="top-header">
          <div className="search-box">
            <Search size={14} color="var(--text-dim)" />
            <input type="text" placeholder="SEARCH TXN ID..." />
          </div>
          <div className="section-label">SentriQ Control Surface</div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
