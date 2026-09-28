import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
const client = generateClient({ authMode: 'userPool' });
interface Guard { username: string; email: string; name?: string; enabled: boolean; status: string }
export default function GuardManagement() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const load = async () => {
    const response: any = await client.graphql({ query: `query ListGuards { listGuards { username email name enabled status } }` });
    setGuards(response.data.listGuards);
  };
  useEffect(() => { load().catch(() => setError('Unable to load guard accounts.')); }, []);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await client.graphql({ query: `mutation CreateGuard($input: CreateGuardInput!) { createGuard(input: $input) { username email enabled status } }`, variables: { input: { email: email.trim(), name: name.trim(), temporaryPassword: password } } });
      setMessage(`Guard account created for ${email.trim()}. Share the temporary password you entered with the guard. They must choose a new password at first sign-in.`);
      setEmail(''); setName(''); setPassword('');
      await load();
    } catch (e: any) { setError(e.errors?.[0]?.message || e.message || 'Unable to create account.'); }
    finally { setBusy(false); }
  };
  const toggle = async (guard: Guard) => {
    if (!confirm(`${guard.enabled ? 'Disable' : 'Enable'} guard access for ${guard.email}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await client.graphql({ query: `mutation SetGuardEnabled($username: String!, $enabled: Boolean!) { setGuardEnabled(username: $username, enabled: $enabled) { username email enabled status } }`, variables: { username: guard.username, enabled: !guard.enabled } });
      await load();
    } catch (e: any) { setError(e.errors?.[0]?.message || e.message || 'Unable to update account.'); }
    finally { setBusy(false); }
  };
  return <section>
    <h2>Guard accounts</h2><p className="hint">Guards can only view active bookings and emergency contact details.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}</div>}
    <form className="form-section guard-create-form" onSubmit={create}>
      <h3>Create guard account</h3>
      <div className="form-row"><div className="form-group"><label htmlFor="guard-name">Name</label><input id="guard-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} /></div>
        <div className="form-group"><label htmlFor="guard-email">Username (email)</label><input id="guard-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" /></div></div>
      <div className="form-group"><label htmlFor="guard-password">Temporary password</label><input id="guard-password" type="password" required minLength={8} maxLength={256} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,256}" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" aria-describedby="guard-password-help" />
        <small id="guard-password-help">At least 8 characters: uppercase, lowercase, number and symbol, without spaces. Give this password to the guard; no invitation email is sent.</small></div>
      <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : 'Create guard'}</button>
    </form>
    <div className="guard-accounts">{guards.map(g => <article className="info-card" key={g.username}>
      <h3>{g.name || g.email}</h3><p className="user-email">{g.email}</p><p>{g.enabled ? 'Enabled' : 'Disabled'} · {g.status === 'FORCE_CHANGE_PASSWORD' ? 'First sign-in pending' : g.status}</p>
      <button className="btn-secondary" disabled={busy} onClick={() => toggle(g)}>{g.enabled ? 'Disable access' : 'Enable access'}</button>
    </article>)}</div>
  </section>;
}
