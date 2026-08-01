import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { fetchUserAttributes, updateUserAttributes } from 'aws-amplify/auth';
import QRCode from 'qrcode.react';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface ResidentPanelProps {
  user: any;
  signOut?: () => void;
}

export default function ResidentPanel({ user, signOut }: ResidentPanelProps) {
  const [residentData, setResidentData] = useState<any>(null);
  const [floor, setFloor] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    loadResidentData();
  }, []);

  const loadResidentData = async () => {
    try {
      const attributes = await fetchUserAttributes();
      
      if (attributes['custom:residentCode']) {
        setIsSetup(true);
        setResidentData({
          email: attributes.email,
          floor: attributes['custom:floor'],
          plate: attributes['custom:plate'],
          residentCode: attributes['custom:residentCode'],
        });
      }
    } catch (error) {
      setMessage('خطا در بارگذاری اطلاعات');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Generate unique resident code
      const residentCode = generateResidentCode();

      // Update user attributes
      await updateUserAttributes({
        userAttributes: {
          'custom:floor': floor,
          'custom:plate': plate,
          'custom:residentCode': residentCode,
          'custom:userType': 'RESIDENT',
        },
      });

      // Create resident record
      await client.models.Resident.create({
        email: user.signInDetails?.loginId || '',
        floor,
        plate,
        residentCode,
        userId: user.userId,
        createdAt: new Date().toISOString(),
      });

      setMessage('✅ اطلاعات شما ثبت شد');
      loadResidentData();
    } catch (error: any) {
      setMessage(`❌ خطا: ${error.message}`);
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
          <h2>تکمیل اطلاعات ساکن</h2>
          <button onClick={signOut} className="btn-secondary">خروج</button>
        </div>

        <form onSubmit={handleSetup} className="form">
          <div className="form-group">
            <label>طبقه:</label>
            <input
              type="text"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="مثال: 5"
              required
            />
          </div>

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

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'در حال ثبت...' : 'ثبت اطلاعات'}
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
    floor: residentData?.floor,
    plate: residentData?.plate,
  });

  return (
    <div className="panel resident-panel">
      <div className="panel-header">
        <h2>پنل ساکن</h2>
        <button onClick={signOut} className="btn-secondary">خروج</button>
      </div>

      <div className="user-info">
        <p>👤 {residentData?.email}</p>
      </div>

      <div className="resident-info">
        <h3>اطلاعات شما</h3>
        <div className="info-box">
          <p><strong>طبقه:</strong> {residentData?.floor}</p>
          <p><strong>پلاک:</strong> {residentData?.plate}</p>
          <p><strong>کد اختصاصی:</strong> <code>{residentData?.residentCode}</code></p>
        </div>

        <div className="qr-section">
          <h3>QR Code برای مهمان‌ها</h3>
          <div className="qr-container">
            <QRCode value={qrData} size={256} level="H" />
          </div>
          <p className="hint">مهمان‌ها می‌توانند این QR Code را اسکن کنند یا از کد اختصاصی شما استفاده کنند</p>
        </div>
      </div>
    </div>
  );
}
