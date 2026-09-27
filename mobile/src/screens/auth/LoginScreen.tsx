import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { colors, fontSize, radius, spacing } from '../../theme/stitch';
import { useAuthStore } from '../../store/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

type LoginNav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;


export default function LoginScreen() {
  const navigation = useNavigation<LoginNav>();
  const { sendOtp } = useAuthStore();
  const [isOwnerMode, setIsOwnerMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const slideAnim = useRef(new Animated.Value(80)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (otpSent) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 16,
        stiffness: 120,
      }).start();

      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [otpSent]);

  const handleSendOtp = async () => {
    if (phone.length !== 10) return;
    setLoading(true);
    try {
      await sendOtp(`+91${phone}`);
      setOtpSent(true);
    } catch (err: any) {
      console.warn('sendOtp failed:', err.message);
      if (__DEV__) {
        setOtpSent(true);
      } else {
        Alert.alert('Unable to send OTP', 'Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    const newOtp = [...otp];
    newOtp[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(newOtp);
    setOtpError(false);
    if (val && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (newOtp.every((d) => d !== '')) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setLoading(true);
    try {
      const result = await useAuthStore.getState().verifyOtp(`+91${phone}`, code);
      if (result.is_new) {
        navigation.navigate('Registration');
      } else {
        // Check role for admin mode
        const currentUser = useAuthStore.getState().user;
        if (isOwnerMode) {
          if (currentUser?.role !== 'pump_owner' && currentUser?.role !== 'admin') {
            useAuthStore.getState().logout();
            Alert.alert(
              'Not a Pump Owner',
              'This account is not registered as a pump owner. Please use Customer Login.',
              [{ text: 'OK', onPress: () => { setOtp(['', '', '', '', '', '']); setOtpError(true); } }]
            );
          }
        }
        // Regular users or valid admins auto-navigate via auth state change (RootNavigator)
      }
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      const isNetworkErr =
        msg.includes('Network') ||
        msg.includes('timeout') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('fetch') ||
        !msg;

      if (__DEV__ && isNetworkErr && code === '123456') {
        // Backend unreachable but correct demo OTP
        if (isOwnerMode) {
          // If demo admin, they might need to be registered or just set user role to admin.
          // authStore register fallback creates a 'user', not 'admin'. But let's let RootNavigator handle it.
        } else {
          navigation.navigate('Registration');
        }
        return;
      }

      // Wrong OTP or other error → shake and reset
      setOtpError(true);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      Animated.sequence([
        Animated.timing(errorShake, { toValue: 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 8,  duration: 60, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShake, { toValue: 0,  duration: 60, useNativeDriver: true }),
      ]).start();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(60);
    setOtp(['', '', '', '', '', '']);
    setOtpError(false);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>⚡</Text>
            <Text style={styles.appName}>Fuel on Go</Text>
            <Text style={styles.tagline}>
              {isOwnerMode ? 'Pump Owner Login' : 'Book your CNG slot. Skip the queue.'}
            </Text>
          </View>

          {/* Dev Banner */}
          {__DEV__ && otpSent && (
            <View style={styles.devBanner}>
              <Text style={styles.devBannerText}>⚠️ Demo Mode: OTP is 123456</Text>
            </View>
          )}

          {/* Phone Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {otpSent ? 'Enter OTP' : 'Enter Phone Number'}
            </Text>
            {!otpSent ? (
              <>
                <Input
                  prefix="+91"
                  placeholder="10-digit mobile number"
                  keyboardType="number-pad"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
                <Button
                  variant="primary"
                  size="full"
                  loading={loading}
                  disabled={phone.length !== 10}
                  onPress={handleSendOtp}
                >
                  Send OTP
                </Button>
              </>
            ) : (
              <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
                {/* OTP Boxes */}
                <Animated.View
                  style={[
                    styles.otpRow,
                    { transform: [{ translateX: errorShake }] },
                  ]}
                >
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => { otpRefs.current[idx] = ref; }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                        otpError ? styles.otpBoxError : null,
                      ]}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, idx)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectionColor={colors.primary}
                    />
                  ))}
                </Animated.View>

                {otpError && (
                  <Text style={styles.otpError}>Incorrect OTP. Try again.</Text>
                )}

                {/* Resend */}
                <View style={styles.resendRow}>
                  {countdown > 0 ? (
                    <Text style={styles.resendCountdown}>
                      Resend in 0:{String(countdown).padStart(2, '0')}
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            )}
          </View>

          {/* Switch Mode */}
          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => {
              setIsOwnerMode((prev) => !prev);
              setOtpSent(false);
              setPhone('');
              setOtp(['', '', '', '', '', '']);
            }}
          >
            <Text style={styles.switchModeText}>
              {isOwnerMode ? 'Switch to Customer Login' : 'Switch to Pump Owner Login'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xl },
  header: { alignItems: 'center', marginBottom: 32, paddingTop: spacing.xl },
  logo: { fontSize: 64, marginBottom: 8 },
  appName: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 4,
  },
  tagline: { fontSize: fontSize.base, color: colors.primary, fontWeight: '500' },
  devBanner: {
    backgroundColor: '#fef7e0',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  devBannerText: { color: colors.warning, fontWeight: '700', fontSize: fontSize.sm },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  otpBoxFilled: { borderColor: colors.primary },
  otpBoxError: { borderColor: colors.danger },
  otpError: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: 8,
  },
  resendRow: { alignItems: 'center', marginTop: 4 },
  resendCountdown: { color: colors.textSecondary, fontSize: fontSize.sm },
  resendLink: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  switchMode: { alignItems: 'center', marginTop: 8 },
  switchModeText: { color: colors.textSecondary, fontSize: fontSize.sm },
});
