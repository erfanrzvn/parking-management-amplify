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
    <div className="app" dir="rtl">
      <header className="app-header">
        <h1>🅿️ سیستم مدیریت پارکینگ</h1>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'guest' ? 'active' : ''}
          onClick={() => setActiveTab('guest')}
        >
          مهمان (رزرو)
        </button>
        <button
          className={activeTab === 'resident' ? 'active' : ''}
          onClick={() => setActiveTab('resident')}
        >
          ساکنین
        </button>
        <button
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
        >
          مدیر
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
