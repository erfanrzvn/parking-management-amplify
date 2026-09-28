import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
const client = generateClient({ authMode: 'userPool' });
interface Entry {
  id: string; guestPlate: string; guestMobile: string; guestEmail: string;
  startTime: string; endTime: string; createdAt: string;
  host?: { name?: string; email?: string; phone?: string; building?: string; floor?: string; unitNumber?: string; plate?: string };
}
export default function GuardPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updated, setUpdated] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false, inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      if (!disposed) setLoading(true);
      try {
        let nextToken: string | null = null;
        const rows: Entry[] = [];
        do {
          const response: any = await client.graphql({
            query: `query GuardActiveBookings($nextToken: String) {
              listGuardReservations(limit: 100, nextToken: $nextToken) {
                items { id guestPlate guestMobile guestEmail startTime endTime createdAt
                  host { name email phone building floor unitNumber plate } }
                nextToken
              }
            }`, variables: { nextToken }
          });
          rows.push(...response.data.listGuardReservations.items);
          nextToken = response.data.listGuardReservations.nextToken;
        } while (nextToken && !disposed);
        if (!disposed) { setEntries(rows); setError(''); setUpdated(new Date().toLocaleTimeString()); }
      } catch {
        // Do not leave sensitive/stale records visible after access is revoked.
        if (!disposed) { setEntries([]); setError('Unable to load active bookings. Refresh or contact the administrator.'); }
      } finally { inFlight = false; if (!disposed) setLoading(false); }
    };
    void load();
    const interval = setInterval(load, 30000);
    return () => { disposed = true; clearInterval(interval); };
  }, [refresh]);
  const rows = entries.filter(r => Date.parse(r.endTime) > Date.now() && r.guestPlate.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="admin-dashboard guard-panel">
    <div className="dashboard-header"><div><h1>Guard Dashboard</h1><p>Read-only · Active parking bookings</p></div>
      <button className="btn-refresh" disabled={loading} onClick={() => setRefresh(x => x + 1)}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <p className="hint">Emergency access to guest and host details. Active bookings do not confirm physical arrival or departure.</p>
    <div className="form-group guard-search"><label htmlFor="guard-plate">Search license plate</label><input id="guard-plate" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. ABC-1234" /></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {updated && !error && <p className="hint">Last updated: {updated} · Refreshes every 30 seconds</p>}
    {!loading && !error && rows.length === 0 && <div className="empty-state">No matching active bookings.</div>}
    <div className="guard-bookings">{rows.map(r => <article className="info-card" key={r.id}>
      <h2>{r.guestPlate}</h2><div className="info-grid">
        {Object.entries({ 'Guest phone': r.guestMobile, 'Guest email': r.guestEmail, 'Host name': r.host?.name,
          'Host phone': r.host?.phone, 'Host email': r.host?.email, Building: r.host?.building, Floor: r.host?.floor,
          Unit: r.host?.unitNumber, 'Host plate': r.host?.plate,
          'Booking starts': new Date(r.startTime).toLocaleString(), 'Booking ends': new Date(r.endTime).toLocaleString(),
          'Created at': new Date(r.createdAt).toLocaleString() }).map(([label, value]) => <div className="info-item" key={label}><span className="info-label">{label}</span><span className="info-value">{value || 'Not available'}</span></div>)}
      </div></article>)}</div>
  </div>;
}
