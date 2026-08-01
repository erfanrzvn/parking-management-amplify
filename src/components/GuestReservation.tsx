import { useState, useEffect } from 'react';
import { createReservation } from '../lib/graphql';

interface GuestReservationProps {
  onLoginClick?: () => void;
}

export default function GuestReservation({ onLoginClick }: GuestReservationProps) {
  const [residentCode, setResidentCode] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Set start time to now (fixed, non-editable)
    const now = new Date();
    setStartDateTime(formatDateTimeLocal(now));
    
    // Set default end time to 2 hours from now
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setEndDateTime(formatDateTimeLocal(twoHoursLater));
  }, []);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);

      // Validation
      if (endDate <= startDate) {
        setMessage('❌ End time must be after start time');
        setLoading(false);
        return;
      }

      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (durationHours > 24) {
        setMessage('❌ Maximum parking duration is 24 hours');
        setLoading(false);
        return;
      }

      // Create reservation
      await createReservation({
        residentId: `${residentCode}-${Date.now()}`,
        residentCode: residentCode.toUpperCase(),
        residentFloor: 'N/A',
        residentPlate: 'N/A',
        guestPlate: guestPlate.toUpperCase(),
        guestMobile,
        guestEmail,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });

      setMessage('✅ Reservation created successfully!');
      setSuccess(true);
      
      // Reset form
      setTimeout(() => {
        setResidentCode('');
        setGuestPlate('');
        setGuestMobile('');
        setGuestEmail('');
        const now = new Date();
        setStartDateTime(formatDateTimeLocal(now));
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        setEndDateTime(formatDateTimeLocal(twoHoursLater));
        setSuccess(false);
        setMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Reservation error:', error);
      setMessage(`❌ Error: ${error.message || 'Failed to create reservation'}`);
    } finally {
      setLoading(false);
    }
  };

  const getDuration = (): string => {
    if (!startDateTime || !endDateTime) return '';
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs <= 0) return 'Invalid duration';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="guest-reservation">
      <div className="reservation-container">
        <div className="reservation-header">
          <div className="header-icon">🅿️</div>
          <h1>Guest Parking Reservation</h1>
          <p className="header-subtitle">Reserve your parking spot with resident code</p>
          {onLoginClick && (
            <button className="btn-staff-login" onClick={onLoginClick}>
              🔐 Staff Login
            </button>
          )}
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="reservation-form">
            {/* Resident Code */}
            <div className="form-section">
              <h3>Resident Information</h3>
              <div className="form-group">
                <label htmlFor="residentCode">
                  <span className="label-icon">🔑</span>
                  Resident Code
                </label>
                <input
                  id="residentCode"
                  type="text"
                  value={residentCode}
                  onChange={(e) => setResidentCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  required
                  autoFocus
                />
                <small>Enter the code provided by your host</small>
              </div>
            </div>

            {/* Guest Information */}
            <div className="form-section">
              <h3>Your Information</h3>
              
              <div className="form-group">
                <label htmlFor="guestPlate">
                  <span className="label-icon">🚗</span>
                  License Plate
                </label>
                <input
                  id="guestPlate"
                  type="text"
                  value={guestPlate}
                  onChange={(e) => setGuestPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC-1234"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="guestMobile">
                    <span className="label-icon">📱</span>
                    Mobile Number
                  </label>
                  <input
                    id="guestMobile"
                    type="tel"
                    value={guestMobile}
                    onChange={(e) => setGuestMobile(e.target.value)}
                    placeholder="+1234567890"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="guestEmail">
                    <span className="label-icon">📧</span>
                    Email
                  </label>
                  <input
                    id="guestEmail"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Parking Duration */}
            <div className="form-section">
              <h3>Parking Duration</h3>
              
              <div className="form-group">
                <label htmlFor="startDateTime">
                  <span className="label-icon">📅</span>
                  Start Date & Time
                </label>
                <input
                  id="startDateTime"
                  type="datetime-local"
                  value={startDateTime}
                  readOnly
                  className="datetime-input disabled"
                />
                <small>🔒 Fixed to current time</small>
              </div>

              <div className="form-group">
                <label htmlFor="endDateTime">
                  <span className="label-icon">⏰</span>
                  End Date & Time
                </label>
                <input
                  id="endDateTime"
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  min={startDateTime}
                  required
                  className="datetime-input"
                />
                <small>Select when you plan to leave</small>
              </div>

              {endDateTime && (
                <div className="duration-display">
                  <div className="duration-icon">⏱️</div>
                  <div className="duration-content">
                    <span className="duration-label">Total Duration:</span>
                    <span className="duration-value">{getDuration()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            {message && (
              <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'}`}>
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating Reservation...
                </>
              ) : (
                <>
                  <span>🎫</span>
                  Reserve Parking Spot
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="success-card">
            <div className="success-icon">✅</div>
            <h2>Reservation Confirmed!</h2>
            <p>Your parking spot has been reserved successfully.</p>
            <div className="success-details">
              <div className="detail-item">
                <span className="detail-label">License Plate:</span>
                <span className="detail-value">{guestPlate}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">{getDuration()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
