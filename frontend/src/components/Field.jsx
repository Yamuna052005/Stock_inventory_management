export function Field({ label, error, children, hint }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="error-text">{error}</small>}
    </label>
  );
}

export function Input({ label, error, hint, ...props }) {
  return <Field label={label} error={error} hint={hint}><input {...props} /></Field>;
}

export function Select({ label, error, hint, children, ...props }) {
  return <Field label={label} error={error} hint={hint}><select {...props}>{children}</select></Field>;
}
