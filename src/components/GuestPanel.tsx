import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

interface Parking {
  id: string;
  totalSpots: number;
}

export default function GuestPanel() {
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [selectedParking, setSelectedParking] = useState('');
  const [residentCode, setResidentCode] = useState('');
  const [plate, setPlate] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadParkings();
    checkURLParams();
  }, []);

  const checkURLParams = () => {
    const params = new URLSearchParams(window.location.search);
    const parkingParam = params.get('parking');
    const residentCodeParam = params.get('code');
    
    if (parkingParam) {
      setSelectedParking(parkingParam);
    }
    
    if (residentCodeParam) {
      setResidentCode(residentCodeParam);
    }
  };

  const loadParkings = async () => {
    try {
      console.log('Loading parkings...');
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.ParkingConfig.list();
      
      if (errors) {
        console.error('GraphQL errors:', errors);
        setMessage('Error loading parkings: ' + errors[0]?.message);
        return;
      }
      
      console.log('Parkings loaded:', data);
      
      if (data && data.length > 0) {
        setParkings(data.map((item: any) => ({
          id: item.id,
          totalSpots: item.totalSpots || 0
        })));
      } else {
        setMessage('No parkings available. Please ask admin to create parkings.');
      }
    } catch (error: any) {
      console.error('Error loading parkings:', error);
      setMessage('Error: ' + error.message);
    }
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const client = generateClient<Schema>();
      
      // Verify resident code exists
      const { data: residents } = await client.models.Resident.list();
      const resident = residents?.find((r: any) => r.residentCode === residentCode);

      if (!resident) {
        throw new Error('Invalid resident code');
      }

      // Create reservation - start time is now, end time from input
      const startTime = new Date();
      const endTimeDate = new Date(endTime);

      await client.models.Reservation.create({
        residentId: `${selectedParking}-${resident.id}`,
        residentCode,
        residentFloor: resident.floor || '',
        residentPlate: resident.plate || '',
        guestPlate: plate,
        guestMobile: mobile,
        guestEmail: email,
        startTime: startTime.toISOString(),
        endTime: endTimeDate.toISOString(),
        createdAt: startTime.toISOString(),
      });

      setMessage('✅ Your reservation has been confirmed!');
      
      // Reset form
      setResidentCode('');
      setPlate('');
      setMobile('');
      setEmail('');
      setEndTime('');
    } catch (error: any) {
      console.error('Reservation error:', error);
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel guest-panel">
      <h2>Reserve Parking Spot</h2>
      
      <form onSubmit={handleReservation} className="form">
        <div className="form-group">
          <label>Select Parking:</label>
          <select
            value={selectedParking}
            onChange={(e) => setSelectedParking(e.target.value)}
            required
          >
            <option value="">-- Select Parking --</option>
            {parkings.map((parking) => (
              <option key={parking.id} value={parking.id}>
                {parking.id} ({parking.totalSpots} spots)
              </option>
            ))}
          </select>
        </div>

        {selectedParking && (
          <>
            <div className="form-group">
              <label>Resident Code:</label>
              <input
                type="text"
                value={residentCode}
                onChange={(e) => setResidentCode(e.target.value)}
                placeholder="8-character code"
                maxLength={8}
                required
              />
            </div>

            <div className="form-group">
              <label>Your License Plate:</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="ABC-1234"
                required
              />
            </div>

            <div className="form-group">
              <label>Mobile Number:</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+1234567890"
                required
              />
            </div>

            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@email.com"
                required
              />
            </div>

            <div className="form-group">
              <label>End Time:</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
              />
              <small style={{ color: '#888', marginTop: '0.5rem', display: 'block' }}>
                Start time: Now ({new Date().toLocaleString()})
              </small>
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Reserving...' : '🅿️ Reserve Parking'}
            </button>
          </>
        )}
      </form>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`} style={{
          marginTop: '1rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
