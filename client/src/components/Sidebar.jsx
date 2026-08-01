import {
  IconDashboard,
  IconLogs,
  IconSettings,
  IconSend,
  IconSun,
  IconMoon,
  IconChevronLeft,
  IconChevronRight,
} from '../icons.jsx';
import StatusPill from './StatusPill.jsx';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { key: 'logs', label: 'Logs', icon: IconLogs },
  { key: 'playground', label: 'Playground', icon: IconSend },
  { key: 'settings', label: 'Settings', icon: IconSettings },
];

export default function Sidebar({
  tab,
  onTabChange,
  status,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapsed,
}) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <button
        className="sidebar-collapse-toggle"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <IconChevronRight width={13} height={13} />
        ) : (
          <IconChevronLeft width={13} height={13} />
        )}
      </button>

      <div className="sidebar-brand">
        <span className="brand-mark">W</span>
        <span className="brand-name">OpenWhats</span>
      </div>

      <StatusPill status={status} collapsed={collapsed} />

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${tab === key ? 'active' : ''}`}
            onClick={() => onTabChange(key)}
            aria-label={label}
            title={collapsed ? label : undefined}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
        <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>
    </aside>
  );
}
