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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  // Real-time validation functions
  const validateResidentCode = (code: string): string => {
    if (!code) return '';
    if (code.length !== 6) return 'Code must be exactly 6 characters';
    if (!/^[A-Z0-9]{6}$/.test(code)) return 'Code must contain only letters and numbers';
    return '';
  };

  const validateUnitNumber = (unit: string): string => {
    if (!unit) return '';
    if (unit.length > 10) return 'Unit number too long';
    return '';
  };

  const validatePlate = (plate: string): string => {
    if (!plate) return '';
    if (plate.length < 3) return 'License plate too short';
    if (plate.length > 15) return 'License plate too long';
    if (!/^[A-Z0-9-]+$/.test(plate)) return 'Only letters, numbers, and dashes allowed';
    return '';
  };

  const validateMobile = (mobile: string): string => {
    if (!mobile) return '';
    // Remove spaces and dashes for validation
    const cleaned = mobile.replace(/[\s-]/g, '');
    
    if (!cleaned.startsWith('+')) {
      return 'Phone must start with country code (e.g., +1 or +98)';
    }
    
    if (cleaned.length < 10) {
      return 'Phone number too short';
    }
    
    if (cleaned.length > 16) {
      return 'Phone number too long';
    }
    
    if (!/^\+\d+$/.test(cleaned)) {
      return 'Phone must be in format: +1234567890';
    }
    
    return '';
  };

  const validateEmail = (email: string): string => {
    if (!email) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Invalid email format';
    }
    return '';
  };

  // Update validation errors on field change
  useEffect(() => {
    const errors: {[key: string]: string} = {};
    
    const residentCodeError = validateResidentCode(residentCode);
    if (residentCodeError) errors.residentCode = residentCodeError;
    
    const unitError = validateUnitNumber(unitNumber);
    if (unitError) errors.unitNumber = unitError;
    
    const plateError = validatePlate(guestPlate);
    if (plateError) errors.guestPlate = plateError;
    
    const mobileError = validateMobile(guestMobile);
    if (mobileError) errors.guestMobile = mobileError;
    
    const emailError = validateEmail(guestEmail);
    if (emailError) errors.guestEmail = emailError;
    
    setValidationErrors(errors);
  }, [residentCode, unitNumber, guestPlate, guestMobile, guestEmail]);

  const handleCreateAnother = () => {
    setResidentCode('');
    setUnitNumber('');
    setGuestPlate('');
    setGuestMobile('');
    setGuestEmail('');
    setDurationHours(2);
    setDurationMinutes(0);
    setSuccess(false);
    setMessage('');
    setValidationErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
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

      // Clean phone number format
      const cleanedMobile = guestMobile.replace(/[\s-]/g, '');

      // Calculate end time in minutes (backend will validate max duration)
      const totalMinutes = (durationHours * 60) + durationMinutes;
      
      // Send duration to backend, let backend calculate exact times
      await createReservation({
        residentId: verification.residentId,
        residentCode: residentCode.toUpperCase(),
        residentFloor: verification.residentFloor,
        residentPlate: verification.residentPlate,
        guestPlate: guestPlate.toUpperCase(),
        guestMobile: cleanedMobile,
        guestEmail: guestEmail.toLowerCase(),
        startTime: new Date().toISOString(), // Backend will override this with server time
        endTime: new Date(Date.now() + totalMinutes * 60 * 1000).toISOString(), // Backend will recalculate
      });

      setMessage('✅ Reservation created successfully!');
      setSuccess(true);
      
      // Don't auto-reset, let user click "Create Another" button
    } catch (error: any) {
      console.error('Reservation error:', error);
      let errorMessage = 'Failed to create reservation';
      
      // Parse backend error messages with user-friendly translations
      if (error.errors && error.errors[0]) {
        const backendError = error.errors[0].message;
        
        // Translate GraphQL validation errors to user-friendly messages
        if (backendError.includes("Variable 'guestMobile' has an invalid value")) {
          errorMessage = 'Invalid phone number format. Please use international format (e.g., +1234567890)';
        } else if (backendError.includes("Variable 'guestEmail' has an invalid value")) {
          errorMessage = 'Invalid email format. Please enter a valid email address';
        } else if (backendError.includes('license plate already has an active reservation')) {
          errorMessage = 'This license plate already has an active parking reservation';
        } else if (backendError.includes('No parking spots available')) {
          errorMessage = 'Sorry, all parking spots are currently occupied. Please try again later';
        } else if (backendError.includes('Maximum parking duration')) {
          errorMessage = 'Maximum parking duration is 24 hours';
        } else if (backendError.includes('Invalid email format')) {
          errorMessage = 'Please enter a valid email address';
        } else if (backendError.includes('Invalid phone format')) {
          errorMessage = 'Phone number must be in international format (e.g., +1234567890)';
        } else if (backendError.includes('Invalid license plate format')) {
          errorMessage = 'License plate must contain only letters, numbers, and dashes';
        } else if (backendError.includes('Invalid resident')) {
          errorMessage = 'Resident code and unit number do not match. Please check with your host';
        } else if (backendError.includes('already has a reservation during this time')) {
          errorMessage = 'You already have an active reservation. Please wait for it to complete before creating a new one.';
        } else if (backendError.includes('Reservations cannot overlap')) {
          errorMessage = 'You already have an active reservation. Reservations cannot overlap in time.';
        } else {
          errorMessage = backendError;
        }
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

  return (
    <div className="guest-reservation">
      <div className="reservation-container">
        <div className="reservation-header">
          <div className="header-icon">🅿️</div>
          <h1>Guest Parking Reservation</h1>
          <p className="header-subtitle">Reserve your parking spot with resident code</p>
          {!success && onLoginClick && (
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
                    className={validationErrors.residentCode ? 'input-error' : ''}
                  />
                  {validationErrors.residentCode ? (
                    <small className="error-text">⚠️ {validationErrors.residentCode}</small>
                  ) : (
                    <small>Code provided by your host (6 characters)</small>
                  )}
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
                    className={validationErrors.unitNumber ? 'input-error' : ''}
                  />
                  {validationErrors.unitNumber ? (
                    <small className="error-text">⚠️ {validationErrors.unitNumber}</small>
                  ) : (
                    <small>Apartment/unit number</small>
                  )}
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
                  className={validationErrors.guestPlate ? 'input-error' : ''}
                />
                {validationErrors.guestPlate ? (
                  <small className="error-text">⚠️ {validationErrors.guestPlate}</small>
                ) : (
                  <small>Your vehicle's license plate number</small>
                )}
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
                    className={validationErrors.guestMobile ? 'input-error' : ''}
                  />
                  {validationErrors.guestMobile ? (
                    <small className="error-text">⚠️ {validationErrors.guestMobile}</small>
                  ) : (
                    <small>Include country code (e.g., +1 or +98)</small>
                  )}
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
                    className={validationErrors.guestEmail ? 'input-error' : ''}
                  />
                  {validationErrors.guestEmail ? (
                    <small className="error-text">⚠️ {validationErrors.guestEmail}</small>
                  ) : (
                    <small>We'll send confirmation to this email</small>
                  )}
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
                  <span className="datetime-text">Starts immediately when you submit</span>
                  <span className="datetime-badge">Now</span>
                </div>
                <small>🔒 Parking starts at server time when reservation is confirmed</small>
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
                <small>How long you need to park (maximum 24 hours)</small>
              </div>

              <div className="duration-display">
                <div className="duration-icon">⏱️</div>
                <div className="duration-content">
                  <span className="duration-label">Total Duration:</span>
                  <span className="duration-value">{getDurationText()}</span>
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
