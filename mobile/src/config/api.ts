import axios from 'axios';
import { API_URL } from './constants';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    const { useAuthStore } = require('../store/authStore');
    const token = useAuthStore.getState().token;
    if (token) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('[API] Could not attach token:', err);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log(
      '[API Error]',
      error?.config?.method?.toUpperCase(),
      error?.config?.url,
      '- Status:',
      error?.response?.status,
      error?.response?.data
    );

    if (error?.response?.status === 401) {
      try {
        const { useAuthStore } = require('../store/authStore');
        useAuthStore.getState().logout();
        
        // Show friendly message
        const { Alert } = require('react-native');
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.'
        );
      } catch (logoutErr) {
        console.error('[API] Logout failed:', logoutErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;