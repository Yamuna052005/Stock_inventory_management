export const Loading = ({ text = 'Loading…' }) => <div className="state"><div className="spinner" />{text}</div>;
export const Empty = ({ title = 'Nothing here yet', hint }) => (
  <div className="state empty"><div className="empty-icon">📭</div><strong>{title}</strong>{hint && <span>{hint}</span>}</div>
);
export const ErrorBox = ({ message, onRetry }) => (
  <div className="state error-box"><strong>Something went wrong</strong><span>{message}</span>{onRetry && <button className="btn" onClick={onRetry}>Retry</button>}</div>
);
export function Async({ state, children, emptyWhen, empty }) {
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorBox message={state.error} onRetry={state.reload} />;
  if (emptyWhen && emptyWhen(state.data)) return empty;
  return children;
}
export const Badge = ({ status }) => {
  const map = { ok: ['In stock', 'green'], low: ['Low stock', 'amber'], out: ['Out of stock', 'red'], IN: ['IN', 'green'], OUT: ['OUT', 'red'],
    PENDING: ['Pending', 'amber'], RECEIVED: ['Received', 'green'], CANCELLED: ['Cancelled', 'gray'] };
  const [text, color] = map[status] || [status, 'gray'];
  return <span className={`badge ${color}`}>{text}</span>;
};
