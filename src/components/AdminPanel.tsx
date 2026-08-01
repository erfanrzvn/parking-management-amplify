import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface AdminPanelProps {
  user: any;
  signOut?: () => void;
}

export default function AdminPanel({ user, signOut }: AdminPanelProps) {
  const [totalSpots, setTotalSpots] = useState<number>(20);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await client.models.ParkingConfig.list();
      if (data && data.length > 0) {
        setCurrentConfig(data[0]);
        setTotalSpots(data[0].totalSpots || 20);
      }
    } catch (error) {
      setMessage('خطا در بارگذاری تنظیمات');
    }
  };

  const handleSetSpots = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (currentConfig) {
        await client.models.ParkingConfig.update({
          id: currentConfig.id,
          totalSpots,
          updatedAt: new Date().toISOString(),
          updatedBy: user.userId,
        });
      } else {
        await client.models.ParkingConfig.create({
          id: 'config',
          totalSpots,
          updatedAt: new Date().toISOString(),
          updatedBy: user.userId,
        });
      }
      
      setMessage(`✅ تعداد جای پارک به ${totalSpots} تنظیم شد`);
      loadConfig();
    } catch (error: any) {
      setMessage(`❌ خطا: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel admin-panel">
      <div className="panel-header">
        <h2>پنل مدیریت</h2>
        <button onClick={signOut} className="btn-secondary">خروج</button>
      </div>

      <div className="user-info">
        <p>👤 {user.signInDetails?.loginId}</p>
      </div>

      <form onSubmit={handleSetSpots} className="form">
        <div className="form-group">
          <label>تعداد کل جای پارک:</label>
          <input
            type="number"
            min="1"
            value={totalSpots}
            onChange={(e) => setTotalSpots(Number(e.target.value))}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'در حال ذخیره...' : 'تنظیم تعداد جای پارک'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {currentConfig && (
        <div className="info-box">
          <h3>وضعیت فعلی</h3>
          <p>تعداد کل جای پارک: {currentConfig.totalSpots}</p>
          <p>آخرین بروزرسانی: {new Date(currentConfig.updatedAt).toLocaleString('fa-IR')}</p>
        </div>
      )}
    </div>
  );
}
