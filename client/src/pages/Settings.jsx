import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { IconPlus, IconTrash, IconChevronLeft, IconChevronRight, IconInbox } from '../icons.jsx';

const EVENT_OPTIONS = ['message', 'status'];
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

function formatTime(ms) {
  return new Date(ms).toLocaleString();
}

export default function Settings() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState(['message']);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function load(targetPage = page, targetPageSize = pageSize) {
    try {
      const result = await api.listWebhooks(targetPage, targetPageSize);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function toggleEvent(evt) {
    setEvents((prev) => (prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]));
  }

  function openModal() {
    setUrl('');
    setEvents(['message']);
    setFormError(null);
    setShowModal(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.createWebhook({ url, events });
      setShowModal(false);
      setPage(1);
      await load(1, pageSize);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this webhook?')) return;
    try {
      await api.deleteWebhook(id);
      const isLastItemOnPage = data.items.length === 1 && page > 1;
      const nextPage = isLastItemOnPage ? page - 1 : page;
      setPage(nextPage);
      await load(nextPage, pageSize);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Register webhooks that receive inbound WhatsApp events." />

      <div className="card">
        <div className="toolbar">
          <span className="muted">
            {data.total} webhook{data.total === 1 ? '' : 's'} configured
          </span>
          <button className="btn btn-primary" onClick={openModal}>
            <IconPlus width={15} height={15} />
            Add webhook
          </button>
        </div>

        {error && <p className="inline-error">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Events</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((wh) => (
                <tr key={wh.id}>
                  <td className="mono">{wh.url}</td>
                  <td>{wh.events.length ? wh.events.join(', ') : 'all'}</td>
                  <td className="muted">{formatTime(wh.created_at)}</td>
                  <td>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(wh.id)}
                      aria-label="Delete webhook"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.items.length === 0 && (
            <div className="empty-state">
              <IconInbox />
              <p>No webhooks configured yet.</p>
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

      {showModal && (
        <Modal title="Add webhook" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <label className="field">
              <span className="field-label">Webhook URL</span>
              <input
                type="url"
                placeholder="https://myapp.local/incoming"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                required
              />
            </label>

            <div className="field">
              <span className="field-label">Events</span>
              <div className="pill-toggle-group">
                {EVENT_OPTIONS.map((evt) => (
                  <button
                    type="button"
                    key={evt}
                    className={`pill-toggle ${events.includes(evt) ? 'active' : ''}`}
                    onClick={() => toggleEvent(evt)}
                  >
                    {evt}
                  </button>
                ))}
              </div>
            </div>

            {formError && <p className="inline-error">{formError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Adding...' : 'Add webhook'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
