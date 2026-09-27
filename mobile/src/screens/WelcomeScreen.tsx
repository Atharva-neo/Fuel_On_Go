import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LightningIcon, CarIcon, UserIcon } from '../components/ui/Icons';

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      {/* Background radial blobs simulated */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LightningIcon size={48} color="#00C896" />
        </View>
        <Text style={styles.title}>Fuel on Go</Text>
        <Text style={styles.tagline}>Book your CNG slot. Skip the queue.</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('UserAuth')}>
          <CarIcon size={20} color="#0A0A0A" />
          <Text style={styles.primaryText}>I'm a Vehicle Owner</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('AdminAuth')}>
          <UserIcon size={20} color="#FFFFFF" />
          <Text style={styles.secondaryText}>I'm a Pump Owner</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
  },
  blob1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 200, 150, 0.15)',
    transform: [{ scale: 1.5 }],
  },
  blob2: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 2,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(0, 200, 150, 0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.2)',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  tagline: {
    marginTop: 12,
    fontSize: 16,
    color: '#A1A1AA',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    zIndex: 2,
  },
  primaryButton: {
    backgroundColor: '#00C896',
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  primaryText: {
    color: '#0A0A0A',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  secondaryButton: {
    backgroundColor: '#111111',
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3,
  },
});

