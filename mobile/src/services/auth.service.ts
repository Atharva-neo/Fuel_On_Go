import api from '../config/api';
import type { AppUser } from '../store/authStore';

export interface CheckPhoneResponse {
  exists: boolean;
  has_name: boolean;
  role: 'user' | 'pump_owner' | 'admin' | null;
  name?: string | null;
}

export interface RegisterUserPayload {
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_type: 'Car' | 'Auto' | 'Bus' | 'Other';
  email?: string;
}

export interface RegisterAdminPayload {
  name: string;
  phone: string;
  email: string;
  business_name: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: AppUser;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${ten}`;
}

export const authService = {
  normalizePhone,

  async checkPhone(phone: string): Promise<CheckPhoneResponse> {
    try {
      const p = normalizePhone(phone);

      const { data } = await api.post('/auth/check-phone', {
        phone: p,
      });

      return data;
    } catch (error: any) {
      console.log(
        'checkPhone error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },

  async sendOtp(phone: string): Promise<{ success: boolean; dev_otp?: string }> {
    try {
      const { data } = await api.post('/auth/send-otp', {
        phone: normalizePhone(phone),
      });

      return data;
    } catch (error: any) {
      console.log(
        'sendOtp error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },

  async registerUser(
    payload: RegisterUserPayload
  ): Promise<{ success: boolean; dev_otp?: string }> {
    try {
      const { data } = await api.post('/auth/register', {
        ...payload,
        phone: normalizePhone(payload.phone),
        vehicle_number: payload.vehicle_number.toUpperCase(),
      });

      return data;
    } catch (error: any) {
      console.log(
        'registerUser error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },

  async registerAdmin(
    payload: RegisterAdminPayload
  ): Promise<{ success: boolean; dev_otp?: string }> {
    try {
      const { data } = await api.post('/auth/register-admin', {
        ...payload,
        phone: normalizePhone(payload.phone),
      });

      return data;
    } catch (error: any) {
      console.log(
        'registerAdmin error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    try {
      const { data } = await api.post('/auth/verify-otp', {
        phone: normalizePhone(phone),
        otp,
      });

      return data;
    } catch (error: any) {
      console.log(
        'verifyOtp error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },

  async getMe(): Promise<AppUser> {
    try {
      const { data } = await api.get('/auth/me');
      return data;
    } catch (error: any) {
      console.log(
        'getMe error:',
        error?.response?.data || error?.message || error
      );
      throw error;
    }
  },
};