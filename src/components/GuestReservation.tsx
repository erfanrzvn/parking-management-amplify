import { useState, useEffect } from 'react';
import { createReservation } from '../lib/graphql';

interface GuestReservationProps {
  onLoginClick?: () => void;
}

export default function GuestReservation({ onLoginClick }: GuestReservationProps) {
  const [residentCode, setResidentCode] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [startDateTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const getEndDateTime = (): Date => {
    const totalMinutes = (durationHours * 60) + durationMinutes;
    return new Date(startDateTime.getTime() + totalMinutes * 60 * 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const endDateTime = getEndDateTime();
      
      // Validation
      if (endDateTime <= startDateTime) {
        setMessage('❌ Duration must be greater than 0');
        setLoading(false);
        return;
      }

      const totalHours = (durationHours + durationMinutes / 60);
      if (totalHours > 24) {
        setMessage('❌ Maximum parking duration is 24 hours');
        setLoading(false);
        return;
      }

      // Verify resident code and unit number match (backend validation)
      const verifyMutation = `
        mutation VerifyResidentCredentials($residentCode: String!, $unitNumber: String!) {
          verifyResidentCredentials(residentCode: $residentCode, unitNumber: $unitNumber) {
            isValid
            residentId
            residentFloor
            residentPlate
            message
          }
        }
      `;
      
      const { generateClient } = await import('aws-amplify/api');
      const client = generateClient();
      
      const verifyResult: any = await client.graphql({
        query: verifyMutation,
        variables: {
          residentCode: residentCode.toUpperCase(),
          unitNumber: unitNumber
        }
      });

      const verification = verifyResult.data.verifyResidentCredentials;
      
      if (!verification.isValid) {
        setMessage(`❌ ${verification.message}`);
        setLoading(false);
        return;
      }

      // Create reservation with verified resident info
      await createReservation({
        residentId: verification.residentId,
        residentCode: residentCode.toUpperCase(),
        residentFloor: verification.residentFloor,
        residentPlate: verification.residentPlate,
        guestPlate: guestPlate.toUpperCase(),
        guestMobile,
        guestEmail,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      setMessage('✅ Reservation created successfully!');
      setSuccess(true);
      
      // Reset form
      setTimeout(() => {
        setResidentCode('');
        setUnitNumber('');
        setGuestPlate('');
        setGuestMobile('');
        setGuestEmail('');
        setDurationHours(2);
        setDurationMinutes(0);
        setSuccess(false);
        setMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Reservation error:', error);
      let errorMessage = 'Failed to create reservation';
      
      // Parse backend error messages
      if (error.errors && error.errors[0]) {
        errorMessage = error.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getDurationText = (): string => {
    if (durationHours === 0 && durationMinutes === 0) return '0 minutes';
    
    const parts = [];
    if (durationHours > 0) {
      parts.push(`${durationHours} hour${durationHours > 1 ? 's' : ''}`);
    }
    if (durationMinutes > 0) {
      parts.push(`${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}`);
    }
    
    return parts.join(' ');
  };

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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
              
              <div className="form-row">
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
                    placeholder="Enter code"
                    maxLength={6}
                    required
                    autoFocus
                  />
                  <small>Code provided by your host</small>
                </div>

                <div className="form-group">
                  <label htmlFor="unitNumber">
                    <span className="label-icon">🏠</span>
                    Unit Number
                  </label>
                  <input
                    id="unitNumber"
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g. 502"
                    required
                  />
                  <small>Apartment/unit number</small>
                </div>
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
                <label>
                  <span className="label-icon">📅</span>
                  Start Date & Time
                </label>
                <div className="datetime-display disabled">
                  <span className="datetime-icon">🕐</span>
                  <span className="datetime-text">{formatDateTime(startDateTime)}</span>
                  <span className="datetime-badge">Current Time</span>
                </div>
                <small>🔒 Fixed to current time</small>
              </div>

              <div className="form-group">
                <label>
                  <span className="label-icon">⏰</span>
                  Parking Duration
                </label>
                <div className="time-picker-container">
                  <div className="time-picker-group">
                    <label className="time-picker-label">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={durationHours}
                      onChange={(e) => setDurationHours(Math.min(23, Math.max(0, Number(e.target.value))))}
                      className="time-picker-input"
                      required
                    />
                  </div>

                  <div className="time-picker-separator">:</div>

                  <div className="time-picker-group">
                    <label className="time-picker-label">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                      className="time-picker-input"
                      required
                    />
                  </div>
                </div>
                <small>Type how long you need to park (max 24 hours total)</small>
              </div>

              <div className="duration-display">
                <div className="duration-icon">⏱️</div>
                <div className="duration-content">
                  <span className="duration-label">Total Duration:</span>
                  <span className="duration-value">{getDurationText()}</span>
                </div>
              </div>

              <div className="end-time-display">
                <div className="end-time-icon">🏁</div>
                <div className="end-time-content">
                  <span className="end-time-label">End Time:</span>
                  <span className="end-time-value">{formatDateTime(getEndDateTime())}</span>
                </div>
              </div>
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
                <span className="detail-value">{getDurationText()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
