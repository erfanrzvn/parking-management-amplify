import { useState, useEffect } from 'react';
import { createReservation } from '../lib/graphql';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addHours, differenceInHours, differenceInMinutes, format } from 'date-fns';

interface GuestReservationProps {
  onLoginClick?: () => void;
}

export default function GuestReservation({ onLoginClick }: GuestReservationProps) {
  const [residentCode, setResidentCode] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [endDateTime, setEndDateTime] = useState<Date>(addHours(new Date(), 2));
  const [startDateTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validation
      if (endDateTime <= startDateTime) {
        setMessage('❌ End time must be after start time');
        setLoading(false);
        return;
      }

      const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
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
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      setMessage('✅ Reservation created successfully!');
      setSuccess(true);
      
      // Reset form
      setTimeout(() => {
        setResidentCode('');
        setGuestPlate('');
        setGuestMobile('');
        setGuestEmail('');
        setEndDateTime(addHours(new Date(), 2));
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
    
    const diffMs = endDateTime.getTime() - startDateTime.getTime();
    
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

            {/* Parking Duration with DatePicker */}
            <div className="form-section">
              <h3>Parking Duration</h3>
              
              <div className="form-group">
                <label>
                  <span className="label-icon">📅</span>
                  Start Date & Time
                </label>
                <div className="datetime-display disabled">
                  <span className="datetime-icon">🕐</span>
                  <span className="datetime-text">{format(startDateTime, 'PPpp')}</span>
                  <span className="datetime-badge">Current Time</span>
                </div>
                <small>🔒 Fixed to current time</small>
              </div>

              <div className="form-group">
                <label>
                  <span className="label-icon">⏰</span>
                  End Date & Time
                </label>
                <DatePicker
                  selected={endDateTime}
                  onChange={(date: Date) => setEndDateTime(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="MMMM d, yyyy h:mm aa"
                  minDate={startDateTime}
                  maxDate={addHours(startDateTime, 24)}
                  className="custom-datepicker"
                  calendarClassName="custom-calendar"
                  inline={false}
                  required
                />
                <small>Select when you plan to leave (max 24 hours)</small>
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
