import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';
import './index.css';

console.log('Configuring Amplify with outputs:', outputs);

Amplify.configure(outputs, {
  ssr: false
});

console.log('Amplify configured successfully!');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
