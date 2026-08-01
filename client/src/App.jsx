import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Logs from './pages/Logs.jsx';
import Playground from './pages/Playground.jsx';
import Settings from './pages/Settings.jsx';
import { useStatus } from './hooks/useStatus.js';
import { useTheme } from './hooks/useTheme.js';
import { useSidebarCollapsed } from './hooks/useSidebarCollapsed.js';
import { api } from './api.js';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const { status, qr, error } = useStatus();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  async function handleLogout() {
    if (!confirm('Log out and clear the current WhatsApp session?')) return;
    await api.logout();
  }

  return (
    <div className="app-shell">
      <Sidebar
        tab={tab}
        onTabChange={setTab}
        status={status}
        theme={theme}
        onToggleTheme={toggleTheme}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <main className="main">
        {tab === 'dashboard' && (
          <Dashboard status={status} qr={qr} error={error} onLogout={handleLogout} />
        )}
        {tab === 'logs' && <Logs />}
        {tab === 'playground' && <Playground />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
