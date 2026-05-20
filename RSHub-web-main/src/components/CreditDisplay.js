import React, { useEffect, useState } from 'react';
import { Text } from '@mantine/core';
import { useUserAuth } from './UserAuthContext';
import useTaskStore from '../stores/taskStore';
import axios from 'axios';
import { getAuthToken } from '../utils/auth';

export default function CreditDisplay() {
  const { token } = useUserAuth();
  const refreshTrigger = useTaskStore((state) => state.refreshTrigger);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCredits = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        console.warn('No auth token available');
        return;
      }
      
      const response = await axios.post('https://rshub.zju.edu.cn/users/api/Check-credits', {
        token: authToken,
        credits: 0
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = response.data;
      console.log('Credit API response:', data);
      
      if (data.credits !== undefined && data.credits !== null) {
        setCredits(data.credits);
      } else {
        console.warn('No credits field in response:', data);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [token, refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(fetchCredits, 60000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <Text size="xl" fw={700} c="#1a1a1a" className="credit-display">
      Credits: <Text component="span" fw={700} c="orange">
        {loading ? '...' : (credits !== null ? credits : 'N/A')}
      </Text>
    </Text>
  );
}

