import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface Parking {
  id: string;
  totalSpots: number;
}

export default function GuestPanel() {
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [selectedParking, setSelectedParking] = useState('');
  const [parkingFromQR, setParkingFromQR] = useState(false);
  const [residentCode, setResidentCode] = useState('');
  const [plate, setPlate] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState<any>(null);

  useEffect(() => {
    loadParkings();
    checkURLParams();
  }, []);

  useEffect(() => {
    if (selectedParking) {
      checkAvailability(selectedParking);
    }
  }, [selectedParking]);

  const checkURLParams = () => {
    const params = new URLSearchParams(window.location.search);
    const parkingParam = params.get('parking');
    const residentCodeParam = params.get('code');
    
    if (parkingParam) {
      setSelectedParking(parkingParam);
      setParkingFromQR(true);
    }
    
    if (residentCodeParam) {
      setResidentCode(residentCodeParam);
    }
  };

  const loadParkings = async () => {
    try {
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

  const checkAvailability = async (parkingId: string) => {
    try {
      const { data: reservations } = await client.models.Reservation.list();
      const parking = parkings.find(p => p.id === parkingId);
      
      if (!parking) return;

      const totalSpots = parking.totalSpots;
      const now = new Date();

      const activeReservations = reservations?.filter(
        (r: any) => r.residentId?.startsWith(parkingId) && new Date(r.endTime) > now
      ) || [];

      const availableSpots = totalSpots - activeReservations.length;

      if (availableSpots > 0) {
        setAvailability({
          available: true,
          availableSpots,
          totalSpots,
          message: `${availableSpots} parking spot(s) available`,
        });
      } else {
        const sorted = [...activeReservations].sort(
          (a: any, b: any) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
        );
        
        setAvailability({
          available: false,
          availableSpots: 0,
          totalSpots,
          nextAvailableTime: sorted[0]?.endTime,
          message: 'All parking spots are full',
        });
      }
    } catch (error) {
      setMessage('Error checking availability');
    }
  };

  const handleReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Verify resident code exists
      const { data: residents } = await client.models.Resident.list();
      const resident = residents?.find((r: any) => r.residentCode === residentCode);

      if (!resident) {
        throw new Error('Invalid resident code');
      }

      // Check availability again
      const { data: reservations } = await client.models.Reservation.list();
      const parking = parkings.find(p => p.id === selectedParking);
      
      if (!parking) {
        throw new Error('Invalid parking');
      }

      const totalSpots = parking.totalSpots;
      const now = new Date();

      const activeReservations = reservations?.filter(
        (r: any) => r.residentId?.startsWith(selectedParking) && new Date(r.endTime) > now
      ) || [];

      if (activeReservations.length >= totalSpots) {
        const sorted = [...activeReservations].sort(
          (a: any, b: any) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
        );

        throw new Error(
          `All parking spots are full. Next available: ${new Date(sorted[0].endTime).toLocaleString()}`
        );
      }

      // Create reservation - start time is now, end time from input
      const startTime = new Date();
      const endTimeDate = new Date(endTime);

      await client.models.Reservation.create({
        residentId: `${selectedParking}-${resident.id}`,
        residentCode,
        residentFloor: resident.floor,
        residentPlate: resident.plate,
        guestPlate: plate,
        guestMobile: mobile,
        guestEmail: email,
        startTime: startTime.toISOString(),
        endTime: endTimeDate.toISOString(),
        createdAt: startTime.toISOString(),
      });

      setMessage('✅ Your reservation has been confirmed');
      
      // Reset form
      setResidentCode('');
      setPlate('');
      setMobile('');
      setEmail('');
      setEndTime('');

      // Refresh availability
      checkAvailability(selectedParking);
    } catch (error: any) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel guest-panel">
      <form onSubmit={handleReservation} className="form">
        {!parkingFromQR && (
          <div className="form-group">
            <label>Select Parking:</label>
            <select
              value={selectedParking}
              onChange={(e) => setSelectedParking(e.target.value)}
              required
            >
              <option value="">Select Parking</option>
              {parkings.map((parking) => (
                <option key={parking.id} value={parking.id}>
                  {parking.id} ({parking.totalSpots} total spots)
                </option>
              ))}
            </select>
          </div>
        )}

        {parkingFromQR && selectedParking && (
          <div className="info-box" style={{ marginBottom: '1.5rem' }}>
            <p><strong>Selected Parking:</strong> {selectedParking}</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setParkingFromQR(false);
                setSelectedParking('');
                setResidentCode('');
              }}
            >
              Change Parking
            </button>
          </div>
        )}

        {selectedParking && availability && (
          <div className={`availability-status ${availability.available ? 'available' : 'full'}`}>
            <h3>{availability.message}</h3>
            <p>
              {availability.availableSpots} / {availability.totalSpots} spots available
            </p>
            {!availability.available && availability.nextAvailableTime && (
              <p className="next-available">
                Next available: {new Date(availability.nextAvailableTime).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {selectedParking && (
          <>
            <div className="form-group">
              <label>Resident Code:</label>
              <input
                type="text"
                value={residentCode}
                onChange={(e) => setResidentCode(e.target.value)}
                placeholder="8-character resident code"
                required
              />
            </div>

            <div className="form-group">
              <label>Your License Plate:</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="e.g. ABC-1234"
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
                placeholder="example@email.com"
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
              {loading ? 'Reserving...' : 'Reserve Parking'}
            </button>
          </>
        )}

        {message && (
          <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
