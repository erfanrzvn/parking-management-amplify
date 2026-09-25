import { useState } from 'react';
import { signIn, confirmSignIn } from 'aws-amplify/auth';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export default function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [missingAttributes, setMissingAttributes] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = newPasswordRequired
        ? await confirmSignIn({ challengeResponse: newPassword, options: { userAttributes: attributes } })
        : await signIn({ username: email.trim().toLowerCase(), password });
      
      // Check if sign in was successful
      if (result.isSignedIn) {
        onLoginSuccess();
      } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNewPasswordRequired(true);
        setMissingAttributes(result.nextStep.missingAttributes || []);
      } else {
        setError(`Additional sign-in step required: ${result.nextStep.signInStep}. Contact your administrator.`);
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
    } finally {
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
                readOnly={newPasswordRequired}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{newPasswordRequired ? "Choose a new password" : "Password"}</label>
              <input
                id="password"
                type="password"
                value={newPasswordRequired ? newPassword : password}
                onChange={(e) => newPasswordRequired ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={newPasswordRequired ? "new-password" : "current-password"}
              />
            </div>

            {missingAttributes.map(attribute => (
              <div className="form-group" key={attribute}>
                <label htmlFor={attribute}>{attribute}</label>
                <input id={attribute} required value={attributes[attribute] || ''} onChange={e => setAttributes({ ...attributes, [attribute]: e.target.value })} />
              </div>
            ))}
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
                  {newPasswordRequired ? "Set Password and Sign In" : "🔐 Sign In"}
                </>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
}
