import { useState, useEffect } from 'react';
import { listParkingConfigs, createParkingConfig, listReservations, listResidents, createResident, updateResident, deleteResident } from '../lib/graphql';
import { generateClient } from 'aws-amplify/api';

const graphqlClient = generateClient();

interface AdminPanelProps {
  user: any;
}

interface Parking {
  id: string;
  totalSpots: number;
  createdAt: string;
  updatedAt: string;
}

interface Resident {
  id: string;
  email: string;
  building?: string;
  floor?: string;
  unitNumber?: string;
  plate?: string;
  residentCode: string;
  userId: string;
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
  const [residents, setResidents] = useState<Resident[]>([]);
  const [parkingName, setParkingName] = useState('');
  const [totalSpots, setTotalSpots] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [additionalHours, setAdditionalHours] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'reservations' | 'parkings' | 'logs' | 'residents'>('reservations');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sortBy, setSortBy] = useState<'time-remaining' | 'plate' | 'start'>('time-remaining');
  
  // Resident management states
  const [showResidentModal, setShowResidentModal] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [residentForm, setResidentForm] = useState({
    email: '',
    building: '',
    floor: '',
    unitNumber: '',
    plate: '',
    residentCode: '',
    userId: ''
  });

  useEffect(() => {
    loadData();
    
    // Update current time every second for countdown
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Auto-refresh every 30 seconds
    const dataInterval = setInterval(() => {
      loadReservations();
    }, 30000);
    setRefreshInterval(dataInterval);

    return () => {
      clearInterval(timeInterval);
      if (dataInterval) clearInterval(dataInterval);
    };
  }, []);

  const loadData = async () => {
    await Promise.all([loadParkings(), loadReservations(), loadResidents()]);
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

  const loadResidents = async () => {
    try {
      const data = await listResidents();
      if (data) {
        setResidents(data.map((item: any) => ({
          id: item.id,
          email: item.email || '',
          building: item.building,
          floor: item.floor,
          unitNumber: item.unitNumber,
          plate: item.plate,
          residentCode: item.residentCode || '',
          userId: item.userId || ''
        })));
      }
    } catch (error) {
      console.error('Error loading residents:', error);
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

  const handleEndReservation = async (reservation: Reservation) => {
    if (!confirm(`End parking for ${reservation.guestPlate}?`)) return;
    
    setLoading(true);
    try {
      const mutation = `
        mutation UpdateReservation($input: UpdateReservationInput!) {
          updateReservation(input: $input) {
            id
            endTime
          }
        }
      `;
      
      await graphqlClient.graphql({
        query: mutation,
        variables: {
          input: {
            id: reservation.id,
            endTime: new Date().toISOString()
          }
        }
      });
      
      setMessage('✅ Reservation ended successfully');
      loadReservations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error ending reservation:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation) return;
    
    setLoading(true);
    try {
      const currentEnd = new Date(selectedReservation.endTime);
      const newEnd = new Date(currentEnd.getTime() + additionalHours * 3600000);
      
      const mutation = `
        mutation UpdateReservation($input: UpdateReservationInput!) {
          updateReservation(input: $input) {
            id
            endTime
          }
        }
      `;
      
      await graphqlClient.graphql({
        query: mutation,
        variables: {
          input: {
            id: selectedReservation.id,
            endTime: newEnd.toISOString()
          }
        }
      });
      
      setMessage(`✅ Added ${additionalHours}h to ${selectedReservation.guestPlate}`);
      setShowAddTimeModal(false);
      setSelectedReservation(null);
      setAdditionalHours(1);
      loadReservations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding time:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Resident Management Functions
  const generateResidentCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    for (let i = 0; i < 3; i++) {
      code += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    return code;
  };

  const handleOpenResidentModal = (resident?: Resident) => {
    if (resident) {
      // Edit mode
      setEditingResident(resident);
      setResidentForm({
        email: resident.email,
        building: resident.building || '',
        floor: resident.floor || '',
        unitNumber: resident.unitNumber || '',
        plate: resident.plate || '',
        residentCode: resident.residentCode,
        userId: resident.userId
      });
    } else {
      // Create mode
      setEditingResident(null);
      setResidentForm({
        email: '',
        building: '',
        floor: '',
        unitNumber: '',
        plate: '',
        residentCode: generateResidentCode(),
        userId: ''
      });
    }
    setShowResidentModal(true);
  };

  const handleCloseResidentModal = () => {
    setShowResidentModal(false);
    setEditingResident(null);
    setResidentForm({
      email: '',
      building: '',
      floor: '',
      unitNumber: '',
      plate: '',
      residentCode: '',
      userId: ''
    });
  };

  const handleSaveResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (editingResident) {
        // Update existing resident
        await updateResident({
          id: editingResident.id,
          email: residentForm.email,
          building: residentForm.building,
          floor: residentForm.floor,
          unitNumber: residentForm.unitNumber,
          plate: residentForm.plate,
          residentCode: residentForm.residentCode,
          userId: residentForm.userId
        });
        setMessage('✅ Resident updated successfully');
      } else {
        // Create new resident
        await createResident({
          email: residentForm.email,
          building: residentForm.building,
          floor: residentForm.floor,
          unitNumber: residentForm.unitNumber,
          plate: residentForm.plate,
          residentCode: residentForm.residentCode,
          userId: residentForm.userId || `user_${Date.now()}`
        });
        setMessage('✅ Resident created successfully');
      }

      handleCloseResidentModal();
      loadResidents();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving resident:', error);
      setMessage(`❌ Error: ${error.errors?.[0]?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResident = async (resident: Resident) => {
    if (!confirm(`Delete resident ${resident.email}?\nThis action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      await deleteResident(resident.id);
      setMessage('✅ Resident deleted successfully');
      loadResidents();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting resident:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getReservationStatus = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    
    if (end < now) {
      return 'expired';
    } else if (end.getTime() - now.getTime() < 3600000) {
      return 'ending-soon';
    }
    return 'active';
  };

  const getResidentInfo = (residentId: string) => {
    const resident = residents.find(r => r.id === residentId);
    return resident ? {
      name: resident.building && resident.unitNumber 
        ? `${resident.building} - Unit ${resident.unitNumber}`
        : resident.email.split('@')[0],
      code: resident.residentCode,
      floor: resident.floor,
      building: resident.building,
      unitNumber: resident.unitNumber
    } : {
      name: 'Unknown',
      code: residentId,
      floor: undefined,
      building: undefined,
      unitNumber: undefined
    };
  };

  const getTimeRemaining = (endTime: string) => {
    const now = currentTime;
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Expired';
    }
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getActiveReservations = () => {
    const now = new Date();
    let active = reservations.filter(r => new Date(r.endTime) > now);
    
    // Sort by selected criteria
    if (sortBy === 'time-remaining') {
      active = active.sort((a, b) => 
        new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
      );
    } else if (sortBy === 'plate') {
      active = active.sort((a, b) => a.guestPlate.localeCompare(b.guestPlate));
    } else if (sortBy === 'start') {
      active = active.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    }
    
    return active;
  };

  const getAllReservationsForLogs = () => {
    return [...reservations].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
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
  const allReservations = getAllReservationsForLogs();

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
          className={`tab ${activeTab === 'logs' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 All Logs ({allReservations.length})
        </button>
        <button 
          className={`tab ${activeTab === 'residents' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('residents')}
        >
          👥 Residents ({residents.length})
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
              <div className="header-actions">
                <select 
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="time-remaining">⏱️ Time Remaining</option>
                  <option value="plate">🚗 Plate Number</option>
                  <option value="start">📅 Recently Added</option>
                </select>
                <button className="btn-refresh" onClick={loadReservations}>
                  🔄 Refresh
                </button>
              </div>
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
                      <th>Time Left</th>
                      <th>Status</th>
                      <th>Guest Plate</th>
                      <th>Resident</th>
                      <th>Contact</th>
                      <th>End Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map((reservation) => {
                      const status = getReservationStatus(reservation.endTime);
                      const timeRemaining = getTimeRemaining(reservation.endTime);
                      const residentInfo = getResidentInfo(reservation.residentId);
                      
                      return (
                        <tr key={reservation.id} className={`reservation-row status-${status}`}>
                          <td className="time-remaining-cell">
                            <div className={`countdown ${status === 'ending-soon' ? 'countdown-warning' : ''} ${status === 'expired' ? 'countdown-expired' : ''}`}>
                              {timeRemaining}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${status}`}>
                              {status === 'active' ? '🟢 Active' : status === 'ending-soon' ? '🟡 Ending Soon' : '🔴 Expired'}
                            </span>
                          </td>
                          <td className="plate-cell">
                            <strong>{reservation.guestPlate}</strong>
                          </td>
                          <td>
                            <div className="resident-info">
                              <div><strong>{residentInfo.name}</strong></div>
                              {residentInfo.floor && (
                                <small>Floor {residentInfo.floor}</small>
                              )}
                              <small>Code: {residentInfo.code}</small>
                            </div>
                          </td>
                          <td>
                            <div className="contact-info">
                              <div>📧 {reservation.guestEmail}</div>
                              <div>📱 {reservation.guestMobile}</div>
                            </div>
                          </td>
                          <td className="end-time-cell">
                            {new Date(reservation.endTime).toLocaleString()}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-action btn-add-time"
                                onClick={() => {
                                  setSelectedReservation(reservation);
                                  setShowAddTimeModal(true);
                                }}
                                title="Add more time"
                              >
                                ⏱️ +Time
                              </button>
                              <button
                                className="btn-action btn-end"
                                onClick={() => handleEndReservation(reservation)}
                                title="End parking now"
                              >
                                🔴 End
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'logs' ? (
          <div className="logs-section">
            <div className="section-header">
              <h2>All Reservation Logs</h2>
              <p className="section-subtitle">Complete history of all parking reservations</p>
            </div>

            <div className="logs-table-container">
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Guest Plate</th>
                    <th>Resident</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th>Duration</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {allReservations.map((reservation) => {
                    const start = new Date(reservation.startTime);
                    const end = new Date(reservation.endTime);
                    const now = new Date();
                    const isExpired = end < now;
                    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                    const residentInfo = getResidentInfo(reservation.residentId);
                    
                    return (
                      <tr key={reservation.id} className={`log-row ${isExpired ? 'log-expired' : 'log-active'}`}>
                        <td>
                          {isExpired ? (
                            <span className="status-badge status-expired">
                              ✅ Completed
                            </span>
                          ) : (
                            <span className="status-badge status-active">
                              🚗 In Progress
                            </span>
                          )}
                        </td>
                        <td className="plate-cell">
                          <strong>{reservation.guestPlate}</strong>
                        </td>
                        <td>
                          <div className="resident-info">
                            <div><strong>{residentInfo.name}</strong></div>
                            {residentInfo.floor && (
                              <small>Floor {residentInfo.floor}</small>
                            )}
                            <small>Code: {residentInfo.code}</small>
                          </div>
                        </td>
                        <td>{start.toLocaleString()}</td>
                        <td className={isExpired ? '' : 'in-progress'}>
                          {end.toLocaleString()}
                          {!isExpired && <span className="pulse-dot"></span>}
                        </td>
                        <td>{duration}h</td>
                        <td>
                          <div className="contact-info-compact">
                            <div title={reservation.guestEmail}>📧 {reservation.guestEmail.substring(0, 20)}...</div>
                            <div>📱 {reservation.guestMobile}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'residents' ? (
          <div className="residents-section">
            <div className="section-header">
              <h2>Resident Management</h2>
              <button 
                className="btn-create-parking"
                onClick={() => handleOpenResidentModal()}
              >
                + Add Resident
              </button>
            </div>

            {residents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No Residents</h3>
                <p>Click "Add Resident" to create your first resident</p>
              </div>
            ) : (
              <div className="residents-table-container">
                <table className="reservations-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Building & Unit</th>
                      <th>Floor</th>
                      <th>License Plate</th>
                      <th>Resident Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents.map((resident) => (
                      <tr key={resident.id}>
                        <td>
                          <strong>{resident.email}</strong>
                        </td>
                        <td>
                          <div className="resident-info">
                            {resident.building && resident.unitNumber ? (
                              <>
                                <div>{resident.building}</div>
                                <small>Unit {resident.unitNumber}</small>
                              </>
                            ) : (
                              <span>-</span>
                            )}
                          </div>
                        </td>
                        <td>{resident.floor || '-'}</td>
                        <td className="plate-cell">{resident.plate || '-'}</td>
                        <td>
                          <span className="code-badge">{resident.residentCode}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-action btn-edit"
                              onClick={() => handleOpenResidentModal(resident)}
                              title="Edit resident"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-action btn-delete"
                              onClick={() => handleDeleteResident(resident)}
                              title="Delete resident"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

      {/* Add Time Modal */}
      {showAddTimeModal && selectedReservation && (
        <div className="modal-overlay" onClick={() => setShowAddTimeModal(false)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Time</h2>
              <button className="modal-close" onClick={() => setShowAddTimeModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="selected-car-info">
                <div className="car-plate">{selectedReservation.guestPlate}</div>
                <div className="car-details">
                  <div>Current end: {new Date(selectedReservation.endTime).toLocaleString()}</div>
                  <div>Time left: {getTimeRemaining(selectedReservation.endTime)}</div>
                </div>
              </div>

              <form onSubmit={handleAddTime} className="modal-form">
                <div className="form-group">
                  <label>Additional Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={additionalHours}
                    onChange={(e) => setAdditionalHours(Number(e.target.value))}
                    required
                    autoFocus
                  />
                  <small>How many hours to add to this reservation</small>
                </div>

                <div className="new-end-time">
                  New end time: {new Date(new Date(selectedReservation.endTime).getTime() + additionalHours * 3600000).toLocaleString()}
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-cancel"
                    onClick={() => setShowAddTimeModal(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-submit"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : `Add ${additionalHours}h`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Resident Modal (Add/Edit) */}
      {showResidentModal && (
        <div className="modal-overlay" onClick={handleCloseResidentModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingResident ? 'Edit Resident' : 'Add New Resident'}</h2>
              <button className="modal-close" onClick={handleCloseResidentModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSaveResident} className="modal-form">
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  value={residentForm.email}
                  onChange={(e) => setResidentForm({...residentForm, email: e.target.value})}
                  placeholder="resident@example.com"
                  required
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Building *</label>
                  <input
                    type="text"
                    value={residentForm.building}
                    onChange={(e) => setResidentForm({...residentForm, building: e.target.value})}
                    placeholder="Building A"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Floor *</label>
                  <input
                    type="text"
                    value={residentForm.floor}
                    onChange={(e) => setResidentForm({...residentForm, floor: e.target.value})}
                    placeholder="5"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit Number *</label>
                  <input
                    type="text"
                    value={residentForm.unitNumber}
                    onChange={(e) => setResidentForm({...residentForm, unitNumber: e.target.value})}
                    placeholder="502"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>License Plate *</label>
                  <input
                    type="text"
                    value={residentForm.plate}
                    onChange={(e) => setResidentForm({...residentForm, plate: e.target.value.toUpperCase()})}
                    placeholder="ABC-1234"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Resident Code *</label>
                <div className="code-input-container">
                  <input
                    type="text"
                    value={residentForm.residentCode}
                    onChange={(e) => setResidentForm({...residentForm, residentCode: e.target.value.toUpperCase()})}
                    placeholder="ABC123"
                    maxLength={6}
                    required
                    readOnly={!!editingResident}
                  />
                  {!editingResident && (
                    <button
                      type="button"
                      className="btn-regenerate"
                      onClick={() => setResidentForm({...residentForm, residentCode: generateResidentCode()})}
                    >
                      🔄 Generate
                    </button>
                  )}
                </div>
                <small>
                  {editingResident 
                    ? 'Resident code cannot be changed' 
                    : 'Unique 6-character code for this resident (e.g., ABC123)'}
                </small>
              </div>

              {!editingResident && (
                <div className="form-group">
                  <label>User ID</label>
                  <input
                    type="text"
                    value={residentForm.userId}
                    onChange={(e) => setResidentForm({...residentForm, userId: e.target.value})}
                    placeholder="Leave empty for auto-generate"
                  />
                  <small>Optional: Cognito user ID to link this resident</small>
                </div>
              )}

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={handleCloseResidentModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingResident ? 'Update Resident' : 'Create Resident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
