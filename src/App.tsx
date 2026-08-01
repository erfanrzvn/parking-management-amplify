import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import AdminPanel from './components/AdminPanel';
import ResidentPanel from './components/ResidentPanel';
import GuestPanel from './components/GuestPanel';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'admin' | 'resident' | 'guest'>('guest');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🅿️ Parking Management System</h1>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'guest' ? 'active' : ''}
          onClick={() => setActiveTab('guest')}
        >
          Guest (Reserve)
        </button>
        <button
          className={activeTab === 'resident' ? 'active' : ''}
          onClick={() => setActiveTab('resident')}
        >
          Residents
        </button>
        <button
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
        >
          Admin
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'guest' && <GuestPanel />}
        
        {activeTab === 'resident' && (
          <Authenticator>
            {({ signOut, user }) => <ResidentPanel user={user} signOut={signOut} />}
          </Authenticator>
        )}

        {activeTab === 'admin' && (
          <Authenticator>
            {({ signOut, user }) => <AdminPanel user={user} signOut={signOut} />}
          </Authenticator>
        )}
      </main>
    </div>
  );
}

export default App;
