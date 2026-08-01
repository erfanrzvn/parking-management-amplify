import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

interface AdminPanelProps {
  user: any;
}

interface Parking {
  id: string;
  totalSpots: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [parkingName, setParkingName] = useState('');
  const [totalSpots, setTotalSpots] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadParkings();
  }, []);

  const loadParkings = async () => {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.ParkingConfig.list();
      if (data) {
        setParkings(data.map((item: any) => ({
          id: item.id,
          totalSpots: item.totalSpots || 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        })));
      }
    } catch (error) {
      setMessage('Error loading parkings');
    }
  };

  const handleCreateParking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const client = generateClient<Schema>();
      await client.models.ParkingConfig.create({
        id: parkingName.toLowerCase().replace(/\s+/g, '-'),
        totalSpots,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.userId || 'unknown',
      });

      setMessage(`✅ Parking "${parkingName}" created successfully`);
      setParkingName('');
      setTotalSpots(20);
      loadParkings();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel admin-panel">
      <div className="panel-header">
        <h2>Admin Dashboard</h2>
      </div>

      <div className="user-info">
        <p>👤 {user?.signInDetails?.loginId || 'Admin'}</p>
      </div>

      <div className="section">
        <h3>Create New Parking</h3>
        <form onSubmit={handleCreateParking} className="form">
          <div className="form-group">
            <label>Parking Name:</label>
            <input
              type="text"
              value={parkingName}
              onChange={(e) => setParkingName(e.target.value)}
              placeholder="e.g. Parking A, Tower 1"
              required
            />
          </div>

          <div className="form-group">
            <label>Total Parking Spots:</label>
            <input
              type="number"
              min="1"
              value={totalSpots}
              onChange={(e) => setTotalSpots(Number(e.target.value))}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Parking'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Parkings</h3>
        {parkings.length === 0 ? (
          <p className="hint">No parkings created yet</p>
        ) : (
          <div className="buildings-list">
            {parkings.map((parking) => (
              <div key={parking.id} className="building-card">
                <h4>{parking.id}</h4>
                <p><strong>Total Spots:</strong> {parking.totalSpots}</p>
                <p className="hint">Created: {new Date(parking.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
