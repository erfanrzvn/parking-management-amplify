import { useState, useEffect } from 'react';
import { createResident } from '../lib/graphql';
import { fetchUserAttributes, updateUserAttributes } from 'aws-amplify/auth';

interface ResidentPanelProps {
  user: any;
}

export default function ResidentPanel({ user }: ResidentPanelProps) {
  const [residentData, setResidentData] = useState<any>(null);
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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
          building: attributes['custom:parking'] || 'N/A',
          floor: attributes['custom:floor'] || 'N/A',
          plate: attributes['custom:plate'] || 'N/A',
          residentCode: attributes['custom:residentCode'],
        });
      }
    } catch (error) {
      console.error('Error loading resident data:', error);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Generate unique resident code (case-insensitive safe)
      const residentCode = generateUniqueCode();

      // Update user attributes
      await updateUserAttributes({
        userAttributes: {
          'custom:parking': building.trim(),
          'custom:floor': floor.trim(),
          'custom:plate': plate.trim().toUpperCase(),
          'custom:residentCode': residentCode,
        },
      });

      // Create resident record in database
      await createResident({
        email: user?.signInDetails?.loginId || '',
        floor: floor.trim(),
        plate: plate.trim().toUpperCase(),
        residentCode,
        userId: user?.userId || '',
        createdAt: new Date().toISOString(),
      });

      setMessage('✅ اطلاعات شما با موفقیت ثبت شد');
      setTimeout(() => loadResidentData(), 1000);
    } catch (error: any) {
      console.error('Setup error:', error);
      setMessage(`❌ خطا: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueCode = (): string => {
    // Generate a unique code using timestamp + random string
    // Format: XXXXXX (6 uppercase letters/numbers, case-insensitive)
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Combine and take first 6 characters to ensure uniqueness
    const code = (timestamp + random).substring(0, 6).toUpperCase();
    
    return code;
  };

  const handleCopyCode = async () => {
    if (residentData?.residentCode) {
      try {
        await navigator.clipboard.writeText(residentData.residentCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  // Setup screen for new residents
  if (!isSetup) {
    return (
      <div className="resident-panel">
        <div className="setup-container">
          <div className="setup-header">
            <h1>تکمیل اطلاعات ساکن</h1>
            <p className="setup-subtitle">لطفاً اطلاعات خود را وارد کنید (این اطلاعات پس از ثبت قابل تغییر نیستند)</p>
          </div>

          <form onSubmit={handleSetup} className="setup-form">
            <div className="form-group">
              <label>بلوک / ساختمان</label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="مثال: بلوک A، ساختمان 1"
                required
                autoFocus
              />
              <small>نام بلوک یا ساختمان محل سکونت</small>
            </div>

            <div className="form-group">
              <label>طبقه</label>
              <input
                type="text"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="مثال: 5، همکف، زیرزمین 1"
                required
              />
              <small>شماره طبقه واحد شما</small>
            </div>

            <div className="form-group">
              <label>پلاک خودرو</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="مثال: 12ABC345"
                required
              />
              <small>پلاک خودروی شخصی شما</small>
            </div>

            <div className="warning-box">
              <strong>⚠️ توجه:</strong> این اطلاعات پس از ثبت قابل تغییر نخواهند بود. لطفاً با دقت وارد کنید.
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'در حال ثبت...' : 'ثبت اطلاعات'}
            </button>
          </form>

          {message && (
            <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard for registered residents
  return (
    <div className="resident-panel">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1>داشبورد ساکن</h1>
          <p className="user-email">👤 {residentData?.email}</p>
        </div>

        {/* Resident Info Card */}
        <div className="info-card">
          <h2>اطلاعات شما</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">🏢 بلوک / ساختمان:</span>
              <span className="info-value">{residentData?.building}</span>
            </div>
            <div className="info-item">
              <span className="info-label">🏠 طبقه:</span>
              <span className="info-value">{residentData?.floor}</span>
            </div>
            <div className="info-item">
              <span className="info-label">🚗 پلاک خودرو:</span>
              <span className="info-value">{residentData?.plate}</span>
            </div>
          </div>
          <div className="info-note">
            <small>⚠️ این اطلاعات غیر قابل تغییر هستند</small>
          </div>
        </div>

        {/* Guest Code Card */}
        <div className="guest-code-card">
          <h2>کد اختصاصی شما برای مهمان</h2>
          <p className="code-description">
            این کد را به مهمان خود بدهید تا بتواند برای پارکینگ رزرو کند
          </p>
          
          <div className="code-display-container">
            <div className="code-display">
              <span className="code-text">{residentData?.residentCode}</span>
            </div>
            <button 
              className={`btn-copy ${copySuccess ? 'btn-copy-success' : ''}`}
              onClick={handleCopyCode}
            >
              {copySuccess ? '✓ کپی شد' : '📋 کپی کد'}
            </button>
          </div>

          <div className="code-info">
            <div className="code-info-item">
              <span className="code-info-icon">✨</span>
              <span>کد یکتا و منحصر به فرد شما</span>
            </div>
            <div className="code-info-item">
              <span className="code-info-icon">🔒</span>
              <span>غیر قابل تغییر و دائمی</span>
            </div>
            <div className="code-info-item">
              <span className="code-info-icon">👥</span>
              <span>قابل استفاده برای تمام مهمانان</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="instructions-card">
          <h3>📝 راهنمای استفاده</h3>
          <ol className="instructions-list">
            <li>کد بالا را برای مهمان خود ارسال کنید (SMS، واتساپ، و ...)</li>
            <li>مهمان وارد صفحه رزرو میشود و کد شما را وارد می‌کند</li>
            <li>مهمان اطلاعات خودرو و زمان پارکینگ را وارد می‌کند</li>
            <li>رزرو تکمیل شده و مهمان می‌تواند پارک کند</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
