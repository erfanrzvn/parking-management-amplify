import { useState, useEffect } from 'react';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import AdminPanel from './components/AdminPanel';
import ResidentPanel from './components/ResidentPanel';
import GuestPanel from './components/GuestPanel';
import LoginPage from './components/LoginPage';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'resident' | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    console.log('App mounted, checking auth status...');
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const session = await fetchAuthSession();
      console.log('Auth session:', session);
      
      if (session.tokens) {
        setIsAuthenticated(true);
        setShowLogin(false);
        await determineUserRole();
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    } catch (error) {
      console.log('Not authenticated:', error);
      setIsAuthenticated(false);
      setUserRole(null);
    }
  };

  const determineUserRole = async () => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;
      
      console.log('User groups:', groups);
      
      if (groups?.includes('Admin')) {
        setUserRole('admin');
      } else if (groups?.includes('Resident')) {
        setUserRole('resident');
      } else {
        setUserRole(null);
      }
      
      const attributes = await fetchUserAttributes();
      setUser({ 
        signInDetails: { loginId: attributes.email },
        userId: attributes.sub 
      });
    } catch (error) {
      console.error('Error determining role:', error);
      setUserRole(null);
    }
  };

  const handleSignOut = async () => {
    console.log('Signing out...');
    const { signOut } = await import('aws-amplify/auth');
    await signOut();
    setIsAuthenticated(false);
    setUserRole(null);
    setShowLogin(false);
    setUser(null);
  };

  console.log('App state:', { isAuthenticated, userRole, showLogin });

  // Show login page
  if (showLogin && !isAuthenticated) {
    console.log('Showing login page');
    return (
      <LoginPage 
        onLoginSuccess={() => {
          console.log('Login success callback');
          checkAuthStatus();
        }}
        onBack={() => {
          console.log('Back to home');
          setShowLogin(false);
        }}
      />
    );
  }

  // Show authenticated dashboard
  if (isAuthenticated && userRole) {
    console.log('Showing authenticated dashboard');
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

  // Show guest home page
  console.log('Showing guest home page');
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
            onClick={() => {
              console.log('Login button clicked! Setting showLogin to true');
              setShowLogin(true);
            }}
          >
            🔐 Resident Login
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <GuestPanel />
      </div>
    </div>
  );
}

export default App;
