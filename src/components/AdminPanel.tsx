import { useState, useEffect } from 'react';
import { listParkingConfigs, createParkingConfig, listReservations } from '../lib/graphql';

interface AdminPanelProps {
  user: any;
}

interface Parking {
  id: string;
  totalSpots: number;
  createdAt: string;
  updatedAt: string;
}

interface Reservation {
  id: string;
  residentId: string;
  residentCode: string;
  residentFloor?: string;
  residentPlate?: string;
  guestPlate: string;
  guestMobile: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [parkingName, setParkingName] = useState('');
  const [totalSpots, setTotalSpots] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'parkings' | 'reservations'>('reservations');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadReservations();
    }, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadData = async () => {
    await Promise.all([loadParkings(), loadReservations()]);
  };

  const loadParkings = async () => {
    try {
      const data = await listParkingConfigs();
      if (data) {
        setParkings(data.map((item: any) => ({
          id: item.id,
          totalSpots: item.totalSpots || 0,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        })));
      }
    } catch (error) {
      console.error('Error loading parkings:', error);
    }
  };

  const loadReservations = async () => {
    try {
      const data = await listReservations();
      if (data) {
        setReservations(data.map((item: any) => ({
          id: item.id,
          residentId: item.residentId || '',
          residentCode: item.residentCode || '',
          residentFloor: item.residentFloor,
          residentPlate: item.residentPlate,
          guestPlate: item.guestPlate || '',
          guestMobile: item.guestMobile || '',
          guestEmail: item.guestEmail || '',
          startTime: item.startTime || '',
          endTime: item.endTime || '',
          createdAt: item.createdAt || ''
        })));
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
    }
  };

  const handleCreateParking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await createParkingConfig({
        totalSpots,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.userId || 'unknown',
      });

      setMessage(`✅ Parking "${parkingName}" created successfully`);
      setParkingName('');
      setTotalSpots(20);
      setShowModal(false);
      loadParkings();
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Create parking error:', error);
      setMessage(`❌ Error: ${error.errors?.[0]?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getReservationStatus = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    
    if (end < now) {
      return 'expired';
    } else if (end.getTime() - now.getTime() < 3600000) { // Less than 1 hour
      return 'ending-soon';
    }
    return 'active';
  };

  const getActiveReservations = () => {
    const now = new Date();
    return reservations.filter(r => new Date(r.endTime) > now);
  };

  const getExpiredReservations = () => {
    const now = new Date();
    return reservations.filter(r => new Date(r.endTime) <= now);
  };

  const getParkingStats = () => {
    const activeRes = getActiveReservations();
    const totalSpots = parkings.reduce((sum, p) => sum + p.totalSpots, 0);
    const occupiedSpots = activeRes.length;
    const availableSpots = totalSpots - occupiedSpots;
    
    return {
      totalParkings: parkings.length,
      totalSpots,
      occupiedSpots,
      availableSpots,
      occupancyRate: totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0
    };
  };

  const stats = getParkingStats();
  const activeReservations = getActiveReservations();
  const expiredReservations = getExpiredReservations();

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="user-email">👤 {user?.signInDetails?.loginId || 'Admin'}</p>
        </div>
        <button 
          className="btn-create-parking"
          onClick={() => setShowModal(true)}
        >
          + New Parking
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🅿️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalParkings}</div>
            <div className="stat-label">Total Parkings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSpots}</div>
            <div className="stat-label">Total Spots</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚗</div>
          <div className="stat-content">
            <div className="stat-value">{stats.occupiedSpots}</div>
            <div className="stat-label">Occupied</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.availableSpots}</div>
            <div className="stat-label">Available</div>
          </div>
        </div>

        <div className="stat-card stat-card-wide">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{stats.occupancyRate}%</div>
            <div className="stat-label">Occupancy Rate</div>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${stats.occupancyRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'reservations' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          🚗 Active Reservations ({activeReservations.length})
        </button>
        <button 
          className={`tab ${activeTab === 'parkings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('parkings')}
        >
          🅿️ Parkings ({parkings.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'reservations' ? (
          <div className="reservations-section">
            <div className="section-header">
              <h2>Active Reservations</h2>
              <button className="btn-refresh" onClick={loadReservations}>
                🔄 Refresh
              </button>
            </div>

            {activeReservations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚗</div>
                <h3>No Active Reservations</h3>
                <p>All parking spots are currently available</p>
              </div>
            ) : (
              <div className="reservations-table-container">
                <table className="reservations-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Guest Plate</th>
                      <th>Resident</th>
                      <th>Contact</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map((reservation) => {
                      const status = getReservationStatus(reservation.endTime);
                      const start = new Date(reservation.startTime);
                      const end = new Date(reservation.endTime);
                      const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                      
                      return (
                        <tr key={reservation.id} className={`reservation-row status-${status}`}>
                          <td>
                            <span className={`status-badge status-${status}`}>
                              {status === 'active' ? '🟢 Active' : '🟡 Ending Soon'}
                            </span>
                          </td>
                          <td className="plate-cell">
                            <strong>{reservation.guestPlate}</strong>
                          </td>
                          <td>
                            <div className="resident-info">
                              <div>{reservation.residentCode}</div>
                              {reservation.residentFloor && (
                                <small>Floor: {reservation.residentFloor}</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="contact-info">
                              <div>📧 {reservation.guestEmail}</div>
                              <div>📱 {reservation.guestMobile}</div>
                            </div>
                          </td>
                          <td>{start.toLocaleString()}</td>
                          <td className="end-time-cell">
                            {end.toLocaleString()}
                          </td>
                          <td>{duration}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expired Reservations */}
            {expiredReservations.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '2rem' }}>
                  <h3>Recently Expired ({expiredReservations.length})</h3>
                </div>
                <div className="expired-list">
                  {expiredReservations.slice(0, 5).map((reservation) => (
                    <div key={reservation.id} className="expired-item">
                      <div className="expired-icon">🔴</div>
                      <div className="expired-details">
                        <div><strong>{reservation.guestPlate}</strong> - {reservation.residentCode}</div>
                        <small>Ended: {new Date(reservation.endTime).toLocaleString()}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="parkings-section">
            <h2>Parking Locations</h2>
            {parkings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🅿️</div>
                <h3>No Parkings Created</h3>
                <p>Click "New Parking" to create your first parking location</p>
              </div>
            ) : (
              <div className="parkings-grid">
                {parkings.map((parking) => {
                  const parkingRes = activeReservations.filter(r => 
                    r.residentId.startsWith(parking.id)
                  );
                  const occupied = parkingRes.length;
                  const available = parking.totalSpots - occupied;
                  const occupancyRate = Math.round((occupied / parking.totalSpots) * 100);

                  return (
                    <div key={parking.id} className="parking-card">
                      <div className="parking-card-header">
                        <h3>{parking.id}</h3>
                        <span className={`parking-status ${available > 0 ? 'available' : 'full'}`}>
                          {available > 0 ? '🟢 Available' : '🔴 Full'}
                        </span>
                      </div>
                      
                      <div className="parking-stats">
                        <div className="parking-stat">
                          <span className="label">Total Spots</span>
                          <span className="value">{parking.totalSpots}</span>
                        </div>
                        <div className="parking-stat">
                          <span className="label">Occupied</span>
                          <span className="value">{occupied}</span>
                        </div>
                        <div className="parking-stat">
                          <span className="label">Available</span>
                          <span className="value">{available}</span>
                        </div>
                      </div>

                      <div className="parking-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ 
                              width: `${occupancyRate}%`,
                              backgroundColor: occupancyRate > 80 ? '#ef4444' : '#10b981'
                            }}
                          ></div>
                        </div>
                        <span className="progress-label">{occupancyRate}% occupied</span>
                      </div>

                      <div className="parking-footer">
                        <small>Created: {new Date(parking.createdAt).toLocaleDateString()}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Parking Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Parking</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateParking} className="modal-form">
              <div className="form-group">
                <label>Parking Name</label>
                <input
                  type="text"
                  value={parkingName}
                  onChange={(e) => setParkingName(e.target.value)}
                  placeholder="e.g. Parking A, Tower 1, Building B"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Total Parking Spots</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={totalSpots}
                  onChange={(e) => setTotalSpots(Number(e.target.value))}
                  required
                />
                <small>Number of parking spots available in this location</small>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Parking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
