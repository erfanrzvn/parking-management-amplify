import { useState, useEffect } from 'react';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import AdminPanel from './components/AdminPanel';
import ResidentPanel from './components/ResidentPanel';
import GuestReservation from './components/GuestReservation';
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
      // Removed sensitive session logging
      
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
      
      // Removed sensitive groups logging
      
      // Check for both uppercase and proper case
      if (groups?.some(g => g.toLowerCase() === 'admin')) {
        console.log('User role: Admin');
        setUserRole('admin');
      } else if (groups?.some(g => g.toLowerCase() === 'resident')) {
        console.log('User role: Resident');
        setUserRole('resident');
      } else {
        console.log('User role: Unknown');
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

  // Removed sensitive app state logging

  // Show login page
  if (showLogin && !isAuthenticated) {
    console.log('Rendering: Login page');
    return (
      <LoginPage 
        onLoginSuccess={() => {
          console.log('Login success callback');
          checkAuthStatus();
        }}
        onBack={() => {
          console.log('Back button clicked');
          setShowLogin(false);
        }}
      />
    );
  }

  // Show authenticated dashboard
  if (isAuthenticated && userRole) {
    console.log('Rendering: Dashboard');
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
  console.log('Rendering: Home page');
  return (
    <div className="app">
      <GuestReservation onLoginClick={() => setShowLogin(true)} />
    </div>
  );
}

export default App;
