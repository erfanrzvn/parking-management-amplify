import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';
import './index.css';

console.log('Configuring Amplify with outputs:', outputs);

// Configure Amplify FIRST
try {
  Amplify.configure(outputs);
  console.log('Amplify configured successfully!');
} catch (error) {
  console.error('Failed to configure Amplify:', error);
}

// Small delay to ensure Amplify is ready
setTimeout(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}, 100);
