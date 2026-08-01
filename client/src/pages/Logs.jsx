import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import { IconInbox, IconChevronLeft, IconChevronRight } from '../icons.jsx';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatTime(ms) {
  return new Date(ms).toLocaleString();
}

function statusClass(status) {
  if (status === 'sent' || status === 'received') return 'status-success';
  if (status === 'failed' || status === 'webhook_failed') return 'status-danger';
  return 'status-neutral';
}

export default function Logs() {
  const [direction, setDirection] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api.getLogs(page, pageSize, direction || null);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [direction, page, pageSize]);

  function handleFilterChange(value) {
    setDirection(value);
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Logs" subtitle="Inbound and outbound message history, with delivery status." />

      <div className="card">
        <div className="segmented">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={direction === f.value ? 'active' : ''}
              onClick={() => handleFilterChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <p className="inline-error">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Direction</th>
                <th>Chat</th>
                <th>Type</th>
                <th>Body</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{formatTime(row.created_at)}</td>
                  <td>
                    <span className={`chip chip--${row.direction}`}>{row.direction}</span>
                  </td>
                  <td className="mono">{row.chat_id}</td>
                  <td>{row.type}</td>
                  <td className="truncate">{row.body || row.media_url || '—'}</td>
                  <td title={row.error || ''}>
                    <span className={`status-badge ${statusClass(row.status)}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.items.length === 0 && (
            <div className="empty-state">
              <IconInbox />
              <p>No messages yet.</p>
            </div>
          )}
        </div>

        <div className="pagination">
          <label className="page-size-select">
            Page size
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="pagination-controls">
            <button
              className="btn-icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <IconChevronLeft width={15} height={15} />
            </button>
            <span className="muted">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </span>
            <button
              className="btn-icon"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <IconChevronRight width={15} height={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
