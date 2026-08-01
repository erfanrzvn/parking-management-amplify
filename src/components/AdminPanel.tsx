import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface AdminPanelProps {
  user: any;
  signOut?: () => void;
}

interface Building {
  id: string;
  name: string;
  totalSpots: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPanel({ user, signOut }: AdminPanelProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingName, setBuildingName] = useState('');
  const [totalSpots, setTotalSpots] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      // For now, we'll use ParkingConfig as buildings
      const { data } = await client.models.ParkingConfig.list();
      if (data) {
        setBuildings(data.map((item: any) => ({
          id: item.id,
          name: item.id, // Using ID as name for now
          totalSpots: item.totalSpots || 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        })));
      }
    } catch (error) {
      setMessage('Error loading buildings');
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await client.models.ParkingConfig.create({
        id: buildingName.toLowerCase().replace(/\s+/g, '-'),
        totalSpots,
        updatedAt: new Date().toISOString(),
        updatedBy: user.userId,
      });

      setMessage(`✅ Building "${buildingName}" created successfully`);
      setBuildingName('');
      setTotalSpots(20);
      loadBuildings();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel admin-panel">
      <div className="panel-header">
        <h2>Admin Panel</h2>
        <button onClick={signOut} className="btn-secondary">Sign Out</button>
      </div>

      <div className="user-info">
        <p>👤 {user.signInDetails?.loginId}</p>
      </div>

      <div className="section">
        <h3>Create New Building</h3>
        <form onSubmit={handleCreateBuilding} className="form">
          <div className="form-group">
            <label>Building Name:</label>
            <input
              type="text"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="e.g. Building A, Tower 1"
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
            {loading ? 'Creating...' : 'Create Building'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Buildings</h3>
        {buildings.length === 0 ? (
          <p className="hint">No buildings created yet</p>
        ) : (
          <div className="buildings-list">
            {buildings.map((building) => (
              <div key={building.id} className="building-card">
                <h4>{building.id}</h4>
                <p><strong>Total Spots:</strong> {building.totalSpots}</p>
                <p className="hint">Created: {new Date(building.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
