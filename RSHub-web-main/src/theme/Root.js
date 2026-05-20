import React, { useEffect } from 'react';
import { UserAuthProvider, useUserAuth } from '../components/UserAuthContext';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { getAuthToken } from '../utils/auth';
import axios from 'axios';

function AuthMonitor({ children }) {
  const { isLoggedIn, logout } = useUserAuth();

  useEffect(() => {
    const handleAuthInvalid = () => {
      console.log('Auth invalid event received, logging out');
      logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/Login';
      }
    };

    window.addEventListener('auth:invalid', handleAuthInvalid);
    return () => window.removeEventListener('auth:invalid', handleAuthInvalid);
  }, [logout]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const checkAuth = async () => {
      try {
        const token = getAuthToken();
        
        if (!token) {
          console.warn('No token found during auth check');
          logout();
          return;
        }

        await axios.get('https://rshub.zju.edu.cn/backend-rsagent/api/credits', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        });
      } catch (error) {
        console.error('Auth check failed:', error);
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/Login';
        }
      }
    };

    const interval = setInterval(checkAuth, 60000);

    return () => clearInterval(interval);
  }, [isLoggedIn, logout]);

  return children;
}

export default function Root({children}) {
  return (
    <MantineProvider
      theme={{
        colorScheme: 'light',
        primaryColor: 'blue',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <Notifications position="top-right" zIndex={2077} />
      <UserAuthProvider>
        <AuthMonitor>
          {children}
        </AuthMonitor>
      </UserAuthProvider>
    </MantineProvider>
  );
} 