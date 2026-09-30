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
                items { 
                  id 
                  guestPlate 
                  guestMobile 
                  guestEmail 
                  startTime 
                  endTime 
                  createdAt
                  host { 
                    name 
                    email 
                    phone 
                    building 
                    floor 
                    unitNumber 
                    plate 
                  } 
                }
                nextToken
              }
            }`, 
            variables: { nextToken }
          });
          
          rows.push(...response.data.listGuardReservations.items);
          nextToken = response.data.listGuardReservations.nextToken;
        } while (nextToken && !disposed);
        
        if (!disposed) { 
          setEntries(rows); 
          setError(''); 
          setUpdated(new Date().toLocaleTimeString()); 
        }
      } catch {
        // Do not leave sensitive/stale records visible after access is revoked.
        if (!disposed) { 
          setEntries([]); 
          setError('Unable to load active bookings. Please refresh or contact the administrator.'); 
        }
      } finally { 
        inFlight = false; 
        if (!disposed) setLoading(false); 
      }
    };
    
    void load();
    const interval = setInterval(load, 30000);
    return () => { disposed = true; clearInterval(interval); };
  }, [refresh]);
  
  const rows = entries.filter(r => 
    Date.parse(r.endTime) > Date.now() && 
    r.guestPlate.toLowerCase().includes(search.trim().toLowerCase())
  );
  
  // Get last 10 expired reservations
  const expiredRows = entries
    .filter(r => Date.parse(r.endTime) <= Date.now())
    .sort((a, b) => Date.parse(b.endTime) - Date.parse(a.endTime))
    .slice(0, 10)
    .filter(r => r.guestPlate.toLowerCase().includes(search.trim().toLowerCase()));
  
  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  const getTimeAgo = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = now - end;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };
  
  return (
    <div className="admin-dashboard guard-panel">
      <div className="dashboard-header">
        <div>
          <h1>🚗 Active Parking Reservations</h1>
          <p className="section-subtitle">View current guest parking details</p>
        </div>
        <button 
          className="btn-refresh" 
          disabled={loading} 
          onClick={() => setRefresh(x => x + 1)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading ? '#475569' : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {loading ? '🔄 Refreshing...' : '🔄 Refresh Now'}
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#1e293b', 
        padding: '1rem 1.5rem', 
        borderRadius: '12px', 
        marginBottom: '1.5rem',
        border: '1px solid #334155'
      }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label 
            htmlFor="guard-plate" 
            style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '0.5rem',
              display: 'block',
              color: '#cbd5e1'
            }}
          >
            🔍 Search by License Plate
          </label>
          <input 
            id="guard-plate" 
            type="search" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Enter plate number (e.g., ABC-1234)" 
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '15px'
            }}
          />
        </div>
      </div>

      {error && (
        <div 
          className="alert alert-error" 
          role="alert" 
          style={{
            backgroundColor: '#7f1d1d',
            color: '#fecaca',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '1px solid #991b1b'
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {updated && !error && (
        <p 
          className="hint" 
          style={{ 
            fontSize: '13px', 
            color: '#94a3b8', 
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}
        >
          ✅ Last updated: {updated} • Auto-refreshes every 30 seconds
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <div 
          className="empty-state" 
          style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: '1px solid #334155'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🚫</div>
          <h3 style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>No Active Reservations</h3>
          <p style={{ color: '#94a3b8' }}>
            {search ? 'No matching license plates found' : 'There are no active parking reservations at the moment'}
          </p>
        </div>
      )}

      <div className="guard-bookings" style={{ display: 'grid', gap: '1.5rem' }}>
        {rows.map(r => {
          const timeRemaining = getTimeRemaining(r.endTime);
          const isExpiringSoon = Date.parse(r.endTime) - Date.now() < 3600000; // Less than 1 hour
          
          return (
            <article 
              className="info-card" 
              key={r.id}
              style={{
                backgroundColor: '#1e293b',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid #334155',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #334155'
              }}>
                <div>
                  <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '700', 
                    color: '#f1f5f9',
                    marginBottom: '0.25rem',
                    fontFamily: 'monospace'
                  }}>
                    🚗 {r.guestPlate}
                  </h2>
                  <p style={{ 
                    fontSize: '13px', 
                    color: '#94a3b8',
                    margin: 0
                  }}>
                    Guest Vehicle
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: isExpiringSoon ? '#f59e0b' : '#10b981',
                    marginBottom: '0.25rem'
                  }}>
                    {isExpiringSoon && '⚠️ '}{timeRemaining}
                  </div>
                  <p style={{ 
                    fontSize: '13px', 
                    color: '#94a3b8',
                    margin: 0
                  }}>
                    Time Remaining
                  </p>
                </div>
              </div>

              <div className="info-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1rem'
              }}>
                {/* Guest Information */}
                <div style={{ 
                  backgroundColor: '#0f172a', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#818cf8',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    👤 Guest Info
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Phone</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {r.guestMobile || 'Not available'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Email</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', wordBreak: 'break-word' }}>
                        {r.guestEmail || 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Host Information */}
                <div style={{ 
                  backgroundColor: '#0f172a', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#34d399',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    🏠 Host Info
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Name</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {r.host?.name || 'Not available'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Phone</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {r.host?.phone || 'Not available'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Email</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', wordBreak: 'break-word' }}>
                        {r.host?.email || 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location Information */}
                <div style={{ 
                  backgroundColor: '#0f172a', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#fbbf24',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    📍 Location
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Building</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {r.host?.building || 'Not available'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Floor</span>
                        <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                          {r.host?.floor || '-'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Unit</span>
                        <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                          {r.host?.unitNumber || '-'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Host Plate</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', fontFamily: 'monospace' }}>
                        {r.host?.plate || 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timing Information */}
                <div style={{ 
                  backgroundColor: '#0f172a', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#f472b6',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    ⏰ Timing
                  </h3>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Start Time</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {new Date(r.startTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>End Time</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {new Date(r.endTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Created</span>
                      <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                        {new Date(r.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Expired Reservations Section */}
      {expiredRows.length > 0 && (
        <>
          <div style={{ 
            marginTop: '3rem', 
            marginBottom: '1.5rem',
            paddingTop: '2rem',
            borderTop: '2px solid #334155'
          }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#f87171',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🚫 Expired Reservations
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#94a3b8',
              margin: 0
            }}>
              Recent expired bookings - vehicles must leave immediately
            </p>
          </div>

          <div className="guard-bookings" style={{ display: 'grid', gap: '1.5rem' }}>
            {expiredRows.map(r => {
              const timeAgo = getTimeAgo(r.endTime);
              
              return (
                <article 
                  className="info-card" 
                  key={r.id}
                  style={{
                    backgroundColor: '#1e293b',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid #dc2626',
                    boxShadow: '0 4px 6px rgba(220, 38, 38, 0.2)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #334155'
                  }}>
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        marginBottom: '0.5rem'
                      }}>
                        <h2 style={{ 
                          fontSize: '24px', 
                          fontWeight: '700', 
                          color: '#f1f5f9',
                          margin: 0,
                          fontFamily: 'monospace'
                        }}>
                          🚗 {r.guestPlate}
                        </h2>
                        <span style={{
                          backgroundColor: '#7f1d1d',
                          color: '#fecaca',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          🚫 EXPIRED
                        </span>
                      </div>
                      <p style={{ 
                        fontSize: '13px', 
                        color: '#f87171',
                        margin: 0,
                        fontWeight: '600'
                      }}>
                        Vehicle Must Leave
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#ef4444',
                        marginBottom: '0.25rem'
                      }}>
                        {timeAgo}
                      </div>
                      <p style={{ 
                        fontSize: '13px', 
                        color: '#94a3b8',
                        margin: 0
                      }}>
                        Expired
                      </p>
                    </div>
                  </div>

                  <div className="info-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '1rem'
                  }}>
                    {/* Guest Information */}
                    <div style={{ 
                      backgroundColor: '#0f172a', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      border: '1px solid #334155'
                    }}>
                      <h3 style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#818cf8',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        👤 Guest Info
                      </h3>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Phone</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {r.guestMobile || 'Not available'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Email</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', wordBreak: 'break-word' }}>
                            {r.guestEmail || 'Not available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Host Information */}
                    <div style={{ 
                      backgroundColor: '#0f172a', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      border: '1px solid #334155'
                    }}>
                      <h3 style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#34d399',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        🏠 Host Info
                      </h3>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Name</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {r.host?.name || 'Not available'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Phone</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {r.host?.phone || 'Not available'}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Email</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', wordBreak: 'break-word' }}>
                            {r.host?.email || 'Not available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Information */}
                    <div style={{ 
                      backgroundColor: '#0f172a', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      border: '1px solid #334155'
                    }}>
                      <h3 style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#fbbf24',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        📍 Location
                      </h3>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Building</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {r.host?.building || 'Not available'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Floor</span>
                            <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                              {r.host?.floor || '-'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Unit</span>
                            <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                              {r.host?.unitNumber || '-'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Host Plate</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500', fontFamily: 'monospace' }}>
                            {r.host?.plate || 'Not available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timing Information */}
                    <div style={{ 
                      backgroundColor: '#0f172a', 
                      padding: '1rem', 
                      borderRadius: '8px',
                      border: '1px solid #334155'
                    }}>
                      <h3 style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#f472b6',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        ⏰ Timing
                      </h3>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Start Time</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {new Date(r.startTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>End Time</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {new Date(r.endTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>Created</span>
                          <span style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: '500' }}>
                            {new Date(r.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
