import { useState, useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import AdminPanel from './components/AdminPanel';
import ResidentPanel from './components/ResidentPanel';
import GuestPanel from './components/GuestPanel';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'resident' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const session = await fetchAuthSession();
      if (session.tokens) {
        setIsAuthenticated(true);
        await determineUserRole();
      }
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const determineUserRole = async () => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;
      
      if (groups?.includes('Admin')) {
        setUserRole('admin');
      } else if (groups?.includes('Resident')) {
        setUserRole('resident');
      }
      
      const attributes = await fetchUserAttributes();
      setUser({ signInDetails: { loginId: attributes.email } });
    } catch (error) {
      setUserRole(null);
    }
  };

  const handleSignOut = async () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setShowLogin(false);
    setUser(null);
  };

  if (showLogin && !isAuthenticated) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-card">
            <button 
              className="back-button"
              onClick={() => setShowLogin(false)}
            >
              ← Back to Guest
            </button>
            <h1>🅿️ Parking Management</h1>
            <p className="auth-subtitle">Sign in to access your dashboard</p>
            <Authenticator
              hideSignUp={true}
              components={{
                SignIn: {
                  Header() {
                    return (
                      <div className="auth-header">
                        <h3>Welcome Back</h3>
                      </div>
                    );
                  }
                }
              }}
            >
              {({ signOut, user: authUser }) => {
                if (authUser) {
                  setIsAuthenticated(true);
                  setUser(authUser);
                  determineUserRole();
                  return null;
                }
                return null;
              }}
            </Authenticator>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && userRole) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>🅿️ Parking Management System</h1>
            <div className="header-actions">
              <span className="user-badge">
                {userRole === 'admin' ? '👑 Admin' : '🏠 Resident'}
              </span>
              <button onClick={handleSignOut} className="btn-signout">
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          {userRole === 'admin' ? (
            <AdminPanel user={user} />
          ) : (
            <ResidentPanel user={user} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="icon">🅿️</span>
            Parking Management System
          </h1>
          <p className="hero-subtitle">
            Reserve your parking spot easily and securely
          </p>
          <button 
            className="btn-login"
            onClick={() => setShowLogin(true)}
          >
            🔐 Staff Login
          </button>
        </div>
      </div>

      <div className="guest-content">
        <GuestPanel />
      </div>
    </div>
  );
}

export default App;
