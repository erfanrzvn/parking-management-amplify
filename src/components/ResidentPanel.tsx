import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchUserAttributes, updateUserAttributes } from 'aws-amplify/auth';
import QRCode from 'qrcode.react';
import type { Schema } from '../../amplify/data/resource';

interface ResidentPanelProps {
  user: any;
}

interface Parking {
  id: string;
  totalSpots: number;
}

export default function ResidentPanel({ user }: ResidentPanelProps) {
  const [residentData, setResidentData] = useState<any>(null);
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [selectedParking, setSelectedParking] = useState('');
  const [floor, setFloor] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    loadParkings();
    loadResidentData();
  }, []);

  const loadParkings = async () => {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.ParkingConfig.list();
      if (data) {
        setParkings(data.map((item: any) => ({
          id: item.id,
          totalSpots: item.totalSpots || 0
        })));
      }
    } catch (error) {
      setMessage('Error loading parkings');
    }
  };

  const loadResidentData = async () => {
    try {
      const attributes = await fetchUserAttributes();
      
      if (attributes['custom:residentCode']) {
        setIsSetup(true);
        setResidentData({
          email: attributes.email,
          parking: attributes['custom:parking'],
          floor: attributes['custom:floor'],
          plate: attributes['custom:plate'],
          residentCode: attributes['custom:residentCode'],
        });
      }
    } catch (error) {
      setMessage('Error loading resident data');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Generate unique resident code
      const residentCode = generateResidentCode();
      const client = generateClient<Schema>();

      // Update user attributes
      await updateUserAttributes({
        userAttributes: {
          'custom:parking': selectedParking,
          'custom:floor': floor,
          'custom:plate': plate,
          'custom:residentCode': residentCode,
          'custom:userType': 'RESIDENT',
        },
      });

      // Create resident record
      await client.models.Resident.create({
        email: user?.signInDetails?.loginId || '',
        floor,
        plate,
        residentCode,
        userId: user?.userId || '',
        createdAt: new Date().toISOString(),
      });

      setMessage('✅ Your information has been registered');
      loadResidentData();
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateResidentCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  if (!isSetup) {
    return (
      <div className="panel resident-panel">
        <div className="panel-header">
          <h2>Complete Your Profile</h2>
        </div>

        <form onSubmit={handleSetup} className="form">
          <div className="form-group">
            <label>Parking:</label>
            <select
              value={selectedParking}
              onChange={(e) => setSelectedParking(e.target.value)}
              required
            >
              <option value="">Select Parking</option>
              {parkings.map((parking) => (
                <option key={parking.id} value={parking.id}>
                  {parking.id} ({parking.totalSpots} spots)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Floor:</label>
            <input
              type="text"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g. 5, G, B1"
              required
            />
          </div>

          <div className="form-group">
            <label>License Plate:</label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="e.g. ABC-1234"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registering...' : 'Register Information'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    );
  }

  const qrData = JSON.stringify({
    residentCode: residentData?.residentCode,
    parking: residentData?.parking,
    floor: residentData?.floor,
    plate: residentData?.plate,
  });

  return (
    <div className="panel resident-panel">
      <div className="panel-header">
        <h2>Resident Dashboard</h2>
      </div>

      <div className="user-info">
        <p>👤 {residentData?.email}</p>
      </div>

      <div className="resident-info">
        <h3>Your Information</h3>
        <div className="info-box">
          <p><strong>Parking:</strong> {residentData?.parking}</p>
          <p><strong>Floor:</strong> {residentData?.floor}</p>
          <p><strong>License Plate:</strong> {residentData?.plate}</p>
          <p><strong>Resident Code:</strong> <code className="code-highlight">{residentData?.residentCode}</code></p>
        </div>

        <div className="qr-section">
          <h3>QR Code for Guests</h3>
          <div className="qr-container">
            <QRCode value={qrData} size={256} level="H" />
          </div>
          <p className="hint">Guests can scan this QR code or use your resident code</p>
        </div>
      </div>
    </div>
  );
}
