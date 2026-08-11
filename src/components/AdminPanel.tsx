import { useState, useEffect } from 'react';
import { listParkingConfigs, createParkingConfig, deleteParkingConfig, listReservations, listResidents, createResident, updateResident, deleteResident, cancelReservation } from '../lib/graphql';
import { generateClient } from 'aws-amplify/api';

const graphqlClient = generateClient();

interface AdminPanelProps {
  user: any;
}

interface Parking {
  id: string;
  name: string;
  totalSpots: number;
  createdAt: string;
  updatedAt: string;
}

interface Resident {
  id: string;
  email: string;
  name?: string;
  phone?: string;
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
    name: '',
    phone: '',
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
          name: item.name || 'Unnamed Parking',
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
          name: item.name,
          phone: item.phone,
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
        name: parkingName,
        totalSpots,
        updatedBy: user?.userId || 'admin',
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

  const handleCancelReservation = async (reservation: Reservation) => {
    if (!confirm(`Delete reservation for ${reservation.guestPlate}?\nThis will mark it as cancelled and free up the spot.`)) return;
    
    setLoading(true);
    try {
      await cancelReservation(reservation.id);
      
      setMessage('✅ Reservation deleted successfully');
      loadReservations();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error cancelling reservation:', error);
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
        name: resident.name || '',
        phone: resident.phone || '',
        building: resident.building || '',
        floor: resident.floor || '',
        unitNumber: resident.unitNumber || '',
        plate: resident.plate || '',
        residentCode: resident.residentCode,
        userId: resident.userId
      });
    } else {
      // Create mode - no need to generate code, backend will do it
      setEditingResident(null);
      setResidentForm({
        email: '',
        name: '',
        phone: '',
        building: '',
        floor: '',
        unitNumber: '',
        plate: '',
        residentCode: '', // Will be generated by backend
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
      name: '',
      phone: '',
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
        // Update existing resident (no Cognito changes)
        await updateResident({
          id: editingResident.id,
          email: residentForm.email,
          name: residentForm.name,
          phone: residentForm.phone,
          building: residentForm.building,
          floor: residentForm.floor,
          unitNumber: residentForm.unitNumber,
          plate: residentForm.plate,
        });
        setMessage('✅ Resident updated successfully');
      } else {
        // Create new resident WITH Cognito user via GraphQL mutation
        const mutation = `
          mutation CreateResidentWithCognito($input: CreateResidentWithCognitoInput!) {
            createResidentWithCognito(input: $input) {
              id
              email
              name
              phone
              building
              floor
              unitNumber
              plate
              residentCode
              userId
              tempPassword
              message
              createdAt
              updatedAt
            }
          }
        `;
        
        const response = await graphqlClient.graphql({
          query: mutation,
          variables: {
            input: {
              email: residentForm.email,
              name: residentForm.name,
              phone: residentForm.phone,
              building: residentForm.building,
              floor: residentForm.floor,
              unitNumber: residentForm.unitNumber,
              plate: residentForm.plate,
            }
          }
        });
        
        const result = response.data?.createResidentWithCognito;
        
        if (!result) {
          throw new Error('No response data from server');
        }
        
        const residentCode = result.residentCode || 'N/A';
        const tempPassword = result.tempPassword || 'N/A';
        
        setMessage(`✅ Resident created successfully!\n\n🔑 Resident Code: ${residentCode}\n🔐 Temporary Password: ${tempPassword}\n\n📧 Please share these credentials with the resident.`);
      }

      handleCloseResidentModal();
      loadResidents();
      setTimeout(() => setMessage(''), 15000); // Show for 15 seconds for credentials
    } catch (error: any) {
      console.error('Error saving resident:', error);
      setMessage(`❌ Error: ${error.errors?.[0]?.message || error.message || error}`);
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

  const handleDeleteParking = async (parking: Parking) => {
    if (!confirm(`Delete parking "${parking.name}"?\nThis action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      await deleteParkingConfig(parking.id);
      setMessage(`✅ Parking "${parking.name}" deleted successfully`);
      loadParkings();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting parking:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParkingSpots = async (parking: Parking, change: number) => {
    const newTotal = parking.totalSpots + change;
    
    if (newTotal < 1) {
      setMessage('❌ Total spots cannot be less than 1');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    setLoading(true);
    try {
      const mutation = `
        mutation UpdateParkingConfig($input: UpdateParkingConfigInput!) {
          updateParkingConfig(input: $input) {
            id
            name
            totalSpots
          }
        }
      `;
      
      await graphqlClient.graphql({
        query: mutation,
        variables: {
          input: {
            id: parking.id,
            totalSpots: newTotal
          }
        }
      });
      
      setMessage(`✅ Updated "${parking.name}" spots to ${newTotal}`);
      loadParkings();
      setTimeout(() => setMessage(''), 2000);
    } catch (error: any) {
      console.error('Error updating parking:', error);
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
    if (resident) {
      return {
        name: resident.building && resident.unitNumber 
          ? `${resident.building} - Unit ${resident.unitNumber}`
          : resident.email.split('@')[0],
        code: resident.residentCode,
        floor: resident.floor,
        building: resident.building,
        unitNumber: resident.unitNumber
      };
    }
    
    // If not found in residents, try to get from reservation itself
    const reservation = reservations.find(r => r.residentId === residentId);
    if (reservation && reservation.residentCode) {
      return {
        name: reservation.residentFloor 
          ? `Floor ${reservation.residentFloor}` 
          : 'Resident',
        code: reservation.residentCode,
        floor: reservation.residentFloor,
        building: undefined,
        unitNumber: undefined
      };
    }
    
    return {
      name: 'Unknown Resident',
      code: residentId.substring(0, 8),
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
      return (
        <div className="time-display">
          <div className="time-hours">{hours}h {minutes}m</div>
          <div className="time-seconds">{seconds}s</div>
        </div>
      );
    } else if (minutes > 0) {
      return (
        <div className="time-display">
          <div className="time-minutes">{minutes}m</div>
          <div className="time-seconds">{seconds}s</div>
        </div>
      );
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
                      <th>Name</th>
                      <th>Plate</th>
                      <th>Host (Building, Unit)</th>
                      <th>Parking Name</th>
                      <th>Started Time</th>
                      <th>Duration</th>
                      <th>Remaining Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map((reservation) => {
                      const status = getReservationStatus(reservation.endTime);
                      const timeRemaining = getTimeRemaining(reservation.endTime);
                      const residentInfo = getResidentInfo(reservation.residentId);
                      const startTime = new Date(reservation.startTime);
                      const endTime = new Date(reservation.endTime);
                      const durationHours = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
                      
                      return (
                        <tr key={reservation.id} className={`reservation-row status-${status}`}>
                          <td>
                            <div className="guest-name">
                              {reservation.guestEmail.split('@')[0]}
                            </div>
                          </td>
                          <td className="plate-cell">
                            <strong>{reservation.guestPlate}</strong>
                          </td>
                          <td>
                            <div className="resident-info">
                              <div><strong>{residentInfo.building || '-'}</strong></div>
                              {residentInfo.unitNumber && (
                                <small>Unit {residentInfo.unitNumber}</small>
                              )}
                              {residentInfo.floor && !residentInfo.unitNumber && (
                                <small>Floor {residentInfo.floor}</small>
                              )}
                            </div>
                          </td>
                          <td>
                            {parkings.length > 0 ? parkings[0].name : 'N/A'}
                          </td>
                          <td className="time-cell">
                            {startTime.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            <span className="duration-badge">{durationHours}h</span>
                          </td>
                          <td className="time-remaining-cell">
                            <div className={`countdown ${status === 'ending-soon' ? 'countdown-warning' : ''} ${status === 'expired' ? 'countdown-expired' : ''}`}>
                              {timeRemaining}
                            </div>
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
                                className="btn-action btn-delete"
                                onClick={() => handleCancelReservation(reservation)}
                                title="Delete reservation"
                              >
                                🗑️ Delete
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
                        <td>{start.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</td>
                        <td className={isExpired ? '' : 'in-progress'}>
                          {end.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                      <th>Building</th>
                      <th>Unit</th>
                      <th>Resident Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents.map((resident) => (
                      <tr key={resident.id}>
                        <td>
                          <strong>{resident.building || '-'}</strong>
                        </td>
                        <td>
                          <strong>{resident.unitNumber || '-'}</strong>
                        </td>
                        <td>
                          {resident.name || resident.email.split('@')[0]}
                        </td>
                        <td>
                          {resident.phone || '-'}
                        </td>
                        <td>
                          {resident.email}
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
                  // Count all active reservations (not per parking - we don't track that)
                  const occupied = activeReservations.length;
                  const available = parking.totalSpots - occupied;
                  const occupancyRate = parking.totalSpots > 0 ? Math.round((occupied / parking.totalSpots) * 100) : 0;

                  return (
                    <div key={parking.id} className="parking-card">
                      <div className="parking-card-header">
                        <h3>{parking.name || 'Unnamed Parking'}</h3>
                        <div className="parking-card-actions">
                          <span className={`parking-status ${available > 0 ? 'available' : 'full'}`}>
                            {available > 0 ? '🟢 Available' : '🔴 Full'}
                          </span>
                          <button
                            className="btn-action btn-delete btn-small"
                            onClick={() => handleDeleteParking(parking)}
                            title="Delete parking"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="parking-stats">
                        <div className="parking-stat">
                          <span className="label">Total Spots</span>
                          <div className="spot-controls">
                            <button
                              className="btn-spot-control"
                              onClick={() => handleUpdateParkingSpots(parking, -1)}
                              disabled={parking.totalSpots <= occupied}
                              title="Decrease spots"
                            >
                              −
                            </button>
                            <span className="value">{parking.totalSpots}</span>
                            <button
                              className="btn-spot-control"
                              onClick={() => handleUpdateParkingSpots(parking, 1)}
                              title="Increase spots"
                            >
                              +
                            </button>
                          </div>
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
                  <div>Current end: {new Date(selectedReservation.endTime).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
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
                  New end time: {new Date(new Date(selectedReservation.endTime).getTime() + additionalHours * 3600000).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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
                  <label>Resident Name</label>
                  <input
                    type="text"
                    value={residentForm.name}
                    onChange={(e) => setResidentForm({...residentForm, name: e.target.value})}
                    placeholder="John Doe"
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={residentForm.phone}
                    onChange={(e) => setResidentForm({...residentForm, phone: e.target.value})}
                    placeholder="+1234567890"
                  />
                </div>
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

              {editingResident && (
                <div className="form-group">
                  <label>Resident Code</label>
                  <input
                    type="text"
                    value={residentForm.residentCode}
                    readOnly
                    disabled
                  />
                  <small>Resident code cannot be changed</small>
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
