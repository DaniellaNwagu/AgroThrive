import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import ConfirmDialog from '../components/ConfirmDialog';

const FREQ_LABEL = { weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' };

const s = {
  page:    { maxWidth: 800, margin: '0 auto', padding: 24 },
  title:   { fontSize: 24, fontWeight: 700, color: '#2d6a4f', marginBottom: 4 },
  sub:     { color: '#888', fontSize: 14, marginBottom: 24 },
  card:    { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 8px #0001', marginBottom: 24 },
  msg:     { padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid #f0f0f0', gap: 12 },
  name:    { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  meta:    { fontSize: 13, color: '#666', marginBottom: 2 },
  badge:   { display: 'inline-block', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  smBtn:   { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 },
};

const STATUS_STYLE = {
  active:    { background: '#d8f3dc', color: '#2d6a4f' },
  paused:    { background: '#fff3cd', color: '#856404' },
  cancelled: { background: '#fee',    color: '#c0392b' },
};

function CancelConfirmDialog({ sub, onConfirm, onCancel }) {
  const nextAmount = sub.product_price && sub.quantity
    ? `${(sub.product_price * sub.quantity).toFixed(2)} XLM`
    : null;

  return (
    <ConfirmDialog
      title="Cancel Subscription"
      confirmLabel="Cancel Subscription"
      cancelLabel="Keep Subscription"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p style={{ margin: '0 0 8px' }}>
        Are you sure you want to cancel your subscription for <strong>{sub.product_name}</strong>?
      </p>
      <div style={{ background: '#f8fdf9', border: '1px solid #b7e4c7', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
        <div><span style={{ color: '#666' }}>Frequency:</span> {FREQ_LABEL[sub.frequency]}</div>
        <div><span style={{ color: '#666' }}>Quantity:</span> {sub.quantity} {sub.unit}</div>
        {nextAmount && <div><span style={{ color: '#666' }}>Next renewal amount:</span> {nextAmount}</div>}
        {sub.next_order_at && (
          <div>
            <span style={{ color: '#666' }}>Next renewal date:</span>{' '}
            {new Date(sub.next_order_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>This action cannot be undone.</p>
    </ConfirmDialog>
  );
}

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await api.getSubscriptions();
      setSubs(res.data || []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to load subscriptions' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAction(id, action) {
    setMsg(null);
    try {
      if (action === 'pause') await api.pauseSubscription(id);
      if (action === 'resume') await api.resumeSubscription(id);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || `Failed to ${action} subscription` });
    }
  }

  async function confirmCancel() {
    const target = cancelTarget;
    setCancelTarget(null);
    if (!target) return;
    setMsg(null);
    try {
      await api.cancelSubscription(target.id);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to cancel subscription' });
    }
  }

  return (
    <div style={s.page}>
      <div style={s.title}>🔄 Subscriptions</div>
      <div style={s.sub}>Your recurring orders for your favourite products</div>

      {msg && (
        <div style={{ ...s.msg, background: msg.type === 'ok' ? '#d8f3dc' : '#fee', color: msg.type === 'ok' ? '#2d6a4f' : '#c0392b' }}>
          {msg.text}
        </div>
      )}

      <div style={s.card}>
        <h3 style={{ marginBottom: 16, color: '#333' }}>My Subscriptions ({subs.length})</h3>
        {loading ? <Spinner /> : subs.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>No active subscriptions.</p>
        ) : subs.map(sub => {
          const nextAmount = sub.product_price && sub.quantity
            ? `${(sub.product_price * sub.quantity).toFixed(2)} XLM`
            : null;
          return (
            <div key={sub.id} style={s.row}>
              <div>
                <div style={s.name}>{sub.product_name}</div>
                <div style={s.meta}>{sub.quantity} {sub.unit} · {FREQ_LABEL[sub.frequency]}</div>
                {nextAmount && <div style={s.meta}>Next renewal amount: <strong>{nextAmount}</strong></div>}
                <div style={s.meta}>
                  Next renewal date: {sub.next_order_at && !isNaN(new Date(sub.next_order_at))
                    ? new Date(sub.next_order_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'Not scheduled'}
                </div>
                {sub.next_billing_at ? (
                  <div style={s.meta}>Next billing: {new Date(sub.next_billing_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                ) : (
                  <div style={s.meta}>Next billing: Billing date not set</div>
                )}
              </div>
              <div style={s.actions}>
                <span style={{ ...s.badge, background: '#e8f4fd', color: '#1e40af' }}>{sub.frequency}</span>
                <span style={{ ...s.badge, ...STATUS_STYLE[sub.status] }}>{sub.status}</span>
                {sub.status === 'active' && (
                  <button style={{ ...s.smBtn, background: '#fff3cd', color: '#856404' }} onClick={() => handleAction(sub.id, 'pause')}>Pause</button>
                )}
                {sub.status === 'paused' && (
                  <button style={{ ...s.smBtn, background: '#d8f3dc', color: '#2d6a4f' }} onClick={() => handleAction(sub.id, 'resume')}>Resume</button>
                )}
                {sub.status !== 'cancelled' && (
                  <button style={{ ...s.smBtn, background: '#fee', color: '#c0392b' }} onClick={() => setCancelTarget(sub)}>Cancel</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cancelTarget && (
        <CancelConfirmDialog
          sub={cancelTarget}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
