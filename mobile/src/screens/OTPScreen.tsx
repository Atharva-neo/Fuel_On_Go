import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

const OTP_LENGTH = 6;

export default function OTPScreen({ route, navigation }: any) {
  const { phone, flow, name } = route.params || {};
  const [otp, setOtp] = useState(Array<string>(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [errorText, setErrorText] = useState('');

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const shake = useRef(new Animated.Value(0)).current;

  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const otpCode = otp.join('');

  const onChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    if (!digit && value !== '') return;

    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setErrorText('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const verify = async () => {
    if (otpCode.length !== OTP_LENGTH) {
      setErrorText('Please enter complete OTP.');
      return;
    }

    setVerifying(true);
    try {
      const data = await authService.verifyOtp(phone, otpCode);

      const userRole = data.user.role;
      const isPumpOwner = userRole === 'pump_owner' || userRole === 'admin';

      // Vehicle owner flow but the account is actually a pump owner
      if (flow === 'user' && isPumpOwner) {
        await logout();
        Alert.alert(
          'Account Mismatch',
          "This number is registered as a Pump Owner. Please use \"I'm a Pump Owner\" to login.",
          [{
            text: 'OK',
            onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] }),
          }]
        );
        return;
      }

      // Pump owner flow but the account is actually a regular user
      if (flow === 'pump_owner' && !isPumpOwner) {
        await logout();
        Alert.alert(
          'Account Mismatch',
          "This number is registered as a Vehicle Owner. Please use \"I'm a Vehicle Owner\" to login.",
          [{
            text: 'OK',
            onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] }),
          }]
        );
        return;
      }

      await setSession(data.token, data.user);
      // RootNavigator's RootGate watches token/user and routes by role automatically
    } catch (error: any) {
      console.log('OTP VERIFY ERROR:', error?.response?.data || error?.message || error);
      setOtp(Array<string>(OTP_LENGTH).fill(''));
      setErrorText(error?.response?.data?.error || error?.message || 'Invalid OTP');
      shakeError();
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0) return;
    try {
      await authService.sendOtp(phone);
      setCountdown(60);
      setErrorText('');
    } catch (error: any) {
      console.log('RESEND OTP ERROR:', error?.response?.data || error?.message || error);
      Alert.alert(
        'Unable to resend', 
        error?.response?.data?.message || 
        error?.response?.data?.error || 
        error?.message || 
        JSON.stringify(error)
      );
    }
  };

  return (
    <View style={styles.container}>
      {name ? <Text style={styles.welcome}>Welcome back, {name}!</Text> : null}
      <Text style={styles.title}>Enter OTP sent to {phone}</Text>

      {__DEV__ ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Demo Mode: OTP is 123456</Text>
        </View>
      ) : null}

      <Animated.View style={[styles.otpRow, { transform: [{ translateX: shake }] }]}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[styles.otpBox, errorText ? styles.otpBoxError : null, digit ? styles.otpBoxActive : null]}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(value) => onChange(index, value)}
            onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
          />
        ))}
      </Animated.View>

      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      <Text style={styles.countdown}>
        {countdown > 0 ? `Resend OTP in 00:${String(countdown).padStart(2, '0')}` : "Didn't receive OTP?"}
      </Text>

      <TouchableOpacity style={[styles.linkBtn, countdown > 0 && styles.linkBtnDisabled]} onPress={resendOtp}>
        <Text style={[styles.linkText, countdown > 0 && styles.linkTextDisabled]}>Resend OTP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]} onPress={verify} disabled={verifying}>
        {verifying ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.verifyText}>Verify OTP</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0A0A0A',
    marginBottom: 8,
    letterSpacing: -1,
  },
  title: {
    fontSize: 16,
    color: '#71717A',
    marginBottom: 24,
    letterSpacing: -0.2,
  },
  banner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  bannerText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpBox: {
    width: 48,
    height: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    backgroundColor: '#FAFAFA',
    color: '#0A0A0A',
  },
  otpBoxActive: {
    borderColor: '#00C896',
    backgroundColor: 'rgba(0, 200, 150, 0.05)',
  },
  otpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  error: {
    color: '#EF4444',
    marginBottom: 12,
    fontWeight: '700',
    fontSize: 14,
  },
  countdown: {
    color: '#A1A1AA',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  linkBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  linkBtnDisabled: {
    opacity: 0.5,
  },
  linkText: {
    color: '#00C896',
    fontWeight: '800',
    fontSize: 15,
  },
  linkTextDisabled: {
    color: '#D4D4D8',
  },
  verifyBtn: {
    backgroundColor: '#00C896',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
