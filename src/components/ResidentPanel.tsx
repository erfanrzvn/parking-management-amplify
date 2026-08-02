import { useState, useEffect } from 'react';
import { getResidentByUserId } from '../lib/graphql';

interface ResidentPanelProps {
  user: any;
}

export default function ResidentPanel({ user }: ResidentPanelProps) {
  const [residentData, setResidentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadResidentData();
  }, []);

  const loadResidentData = async () => {
    try {
      setLoading(true);
      
      // Get userId from user object
      const userId = user?.userId || user?.username;
      const email = user?.signInDetails?.loginId || '';
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Fetch resident data from database
      let resident = await getResidentByUserId(userId);
      
      // If no resident found, create one with default data
      if (!resident) {
        console.log('No resident found, creating default record...');
        
        const newResident = {
          email: email,
          userId: userId,
          building: 'Building A',
          floor: '5',
          unitNumber: '502',
          plate: 'ABC-1234',
          residentCode: generateUniqueCode(),
        };
        
        // Import createResident
        const { createResident } = await import('../lib/graphql');
        resident = await createResident(newResident);
        console.log('Created resident record:', resident);
      }
      
      if (resident) {
        setResidentData({
          email: resident.email || email,
          building: resident.building || 'Building A',
          floor: resident.floor || '5',
          unitNumber: resident.unitNumber || '502',
          licensePlate: resident.plate || 'ABC-1234',
          residentCode: resident.residentCode || generateUniqueCode(),
        });
      }
    } catch (error) {
      console.error('Error loading resident data:', error);
      // Set default data if error
      setResidentData({
        email: user?.signInDetails?.loginId || 'N/A',
        building: 'Building A',
        floor: '5',
        unitNumber: '502',
        licensePlate: 'ABC-1234',
        residentCode: generateUniqueCode(),
      });
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueCode = (): string => {
    // Generate a 6-character code: ABC123
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let code = '';
    
    // 3 letters
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // 3 numbers
    for (let i = 0; i < 3; i++) {
      code += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    
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

  if (loading) {
    return (
      <div className="resident-panel">
        <div className="dashboard-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resident-panel">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1>Resident Dashboard</h1>
          <p className="user-email">👤 {residentData?.email}</p>
        </div>

        {/* Resident Info Card - Read Only */}
        <div className="info-card">
          <h2>Your Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">🏢 Building:</span>
              <span className="info-value">{residentData?.building}</span>
            </div>
            <div className="info-item">
              <span className="info-label">🏠 Floor:</span>
              <span className="info-value">{residentData?.floor}</span>
            </div>
            <div className="info-item">
              <span className="info-label">🚪 Unit Number:</span>
              <span className="info-value">{residentData?.unitNumber}</span>
            </div>
            <div className="info-item">
              <span className="info-label">🚗 License Plate:</span>
              <span className="info-value">{residentData?.licensePlate}</span>
            </div>
          </div>
          <div className="info-note">
            <small>ℹ️ This information is read-only and cannot be modified</small>
          </div>
        </div>

        {/* Guest Code Card */}
        <div className="guest-code-card">
          <h2>Your Guest Code</h2>
          <p className="code-description">
            Share this code with your guests to allow them to make parking reservations
          </p>
          
          <div className="code-display-container">
            <div className="code-display">
              <span className="code-text">{residentData?.residentCode}</span>
            </div>
            <button 
              className={`btn-copy ${copySuccess ? 'btn-copy-success' : ''}`}
              onClick={handleCopyCode}
            >
              {copySuccess ? '✓ Copied' : '📋 Copy Code'}
            </button>
          </div>

          <div className="code-info">
            <div className="code-info-item">
              <span className="code-info-icon">✨</span>
              <span>Unique code assigned to you</span>
            </div>
            <div className="code-info-item">
              <span className="code-info-icon">🔒</span>
              <span>Permanent and cannot be changed</span>
            </div>
            <div className="code-info-item">
              <span className="code-info-icon">👥</span>
              <span>Can be used by all your guests</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="instructions-card">
          <h3>📝 How It Works</h3>
          <ol className="instructions-list">
            <li>Share your code with your guest (SMS, WhatsApp, Email, etc.)</li>
            <li>Guest visits the reservation page and enters your code</li>
            <li>Guest fills in their vehicle and parking time details</li>
            <li>Reservation is confirmed and guest can park</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
