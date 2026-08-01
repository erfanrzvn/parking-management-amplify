import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export default function GuestPanel() {
  const [residentCode, setResidentCode] = useState('');
  const [plate, setPlate] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    checkAvailability();
  }, []);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: 250 },
        false
      );

      scanner.render(
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            setResidentCode(data.residentCode || '');
            setMessage('✅ QR Code اسکن شد');
            scanner.clear();
            setShowScanner(false);
          } catch (error) {
            setMessage('❌ QR Code نامعتبر است');
          }
        },
        (error) => {
          console.log(error);
        }
      );

      return () => {
        scanner.clear();
      };
    }
  }, [showScanner]);

  const checkAvailability = async () => {
    try {
      const { data: reservations } = await client.models.Reservation.list();
      const { data: configs } = await client.models.ParkingConfig.list();

      const totalSpots = configs && configs.length > 0 ? configs[0].totalSpots : 20;
      const now = new Date();

      const activeReservations = reservations?.filter(
        (r: any) => new Date(r.endTime) > now
      ) || [];

      const availableSpots = totalSpots - activeReservations.length;

      if (availableSpots > 0) {
        setAvailability({
          available: true,
          availableSpots,
          totalSpots,
          message: `${availableSpots} جای پارک خالی است`,
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
          message: 'همه جاهای پارک پر است',
        });
      }
    } catch (error) {
      console.error('Error checking availability:', error);
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
        throw new Error('کد ساکن نامعتبر است');
      }

      // Check availability again
      const { data: reservations } = await client.models.Reservation.list();
      const { data: configs } = await client.models.ParkingConfig.list();

      const totalSpots = configs && configs.length > 0 ? configs[0].totalSpots : 20;
      const now = new Date();

      const activeReservations = reservations?.filter(
        (r: any) => new Date(r.endTime) > now
      ) || [];

      if (activeReservations.length >= totalSpots) {
        const sorted = [...activeReservations].sort(
          (a: any, b: any) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
        );

        throw new Error(
          `همه جاهای پارک پر است. اولین جای خالی: ${new Date(sorted[0].endTime).toLocaleString('fa-IR')}`
        );
      }

      // Create reservation
      await client.models.Reservation.create({
        residentId: resident.id,
        residentCode,
        residentFloor: resident.floor,
        residentPlate: resident.plate,
        guestPlate: plate,
        guestMobile: mobile,
        guestEmail: email,
        startTime: now.toISOString(),
        endTime: new Date(endTime).toISOString(),
        createdAt: now.toISOString(),
      });

      setMessage('✅ رزرو شما با موفقیت ثبت شد');
      
      // Reset form
      setResidentCode('');
      setPlate('');
      setMobile('');
      setEmail('');
      setEndTime('');

      // Refresh availability
      checkAvailability();
    } catch (error: any) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel guest-panel">
      <h2>رزرو پارکینگ</h2>

      {availability && (
        <div className={`availability-status ${availability.available ? 'available' : 'full'}`}>
          <h3>{availability.message}</h3>
          <p>
            {availability.availableSpots} / {availability.totalSpots} جای خالی
          </p>
          {!availability.available && availability.nextAvailableTime && (
            <p className="next-available">
              اولین جای خالی: {new Date(availability.nextAvailableTime).toLocaleString('fa-IR')}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleReservation} className="form">
        <div className="form-group">
          <label>کد ساکن:</label>
          <input
            type="text"
            value={residentCode}
            onChange={(e) => setResidentCode(e.target.value)}
            placeholder="کد 8 رقمی ساکن"
            required
          />
        </div>

        <button
          type="button"
          onClick={() => setShowScanner(!showScanner)}
          className="btn-secondary"
        >
          {showScanner ? 'بستن اسکنر' : '📷 اسکن QR Code'}
        </button>

        {showScanner && <div id="qr-reader"></div>}

        <div className="form-group">
          <label>پلاک خودرو:</label>
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="مثال: 12 ب 345 ایران 67"
            required
          />
        </div>

        <div className="form-group">
          <label>شماره موبایل:</label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="09123456789"
            required
          />
        </div>

        <div className="form-group">
          <label>ایمیل:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label>تا چه ساعتی پارک می‌کنید:</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'در حال ثبت...' : 'رزرو پارکینگ'}
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
