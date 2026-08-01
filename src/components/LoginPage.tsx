import { useState } from 'react';
import { signIn } from 'aws-amplify/auth';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export default function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn({
        username: email,
        password: password,
      });
      
      // Check if sign in was successful
      if (result.isSignedIn) {
        // Wait a moment for Cognito to sync
        await new Promise(resolve => setTimeout(resolve, 500));
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.name === 'NotAuthorizedException') {
        setError('Invalid email or password');
      } else if (err.name === 'UserNotFoundException') {
        setError('User not found');
      } else if (err.name === 'UserNotConfirmedException') {
        setError('Please verify your email address');
      } else {
        setError(err.message || 'An error occurred during sign in');
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-gradient"></div>
        <div className="login-pattern"></div>
      </div>

      <div className="login-container">
        <button className="back-button" onClick={onBack}>
          ← Back to Home
        </button>

        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">🅿️</div>
            <h1>Welcome Back</h1>
            <p>Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@parking.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button 
              type="submit" 
              className="btn-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing In...
                </>
              ) : (
                <>
                  🔐 Sign In
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="login-hint">
              <strong>Demo Accounts:</strong>
            </p>
            <div className="demo-accounts">
              <div className="demo-account">
                <span className="demo-badge admin">Admin</span>
                <code>admin@parking.com</code>
              </div>
              <div className="demo-account">
                <span className="demo-badge resident">Resident</span>
                <code>resident@parking.com</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
