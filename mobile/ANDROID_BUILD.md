# Android Build Guide: Fuel on Go

## Prerequisites
- Android Studio (latest)
- JDK 17+
- Node.js 18+
- Expo Go for development, or EAS CLI for release builds

## Quick Start (Expo Go)
```bash
cd mobile
npm install
npx expo start
```
Scan QR code in Expo Go app (Android).

## Local Build (APK)
```bash
cd mobile
npm install

# `expo run:android` runs a development build and requires Android Studio/JDK.
npx expo run:android
```

## Production APK (EAS Build)
```bash
# Set EXPO_PUBLIC_API_URL in the selected EAS profile to the deployed HTTPS API.
npx eas-cli login

# Build an installable release APK
npx eas-cli build --platform android --profile production

# Download from link provided by EAS
```

## API URL

Every mobile API request uses `EXPO_PUBLIC_API_URL` via `src/config/constants.ts`. The verified production API is `https://generous-elegance-production-33ae.up.railway.app/api`; the production EAS profile is configured to use it. The built APK is `mobile/builds/fuel-on-go-production.apk`.

The public Supabase URL and publishable key are used by the mobile Supabase client. Never add the Supabase service key or Railway token to the app or EAS public variables.

## Troubleshooting
- If Metro bundler fails: `npx expo start --clear`
- If EAS build fails: inspect the build logs from the EAS build page.
- Emulator: Use Pixel 7 API 34 in AVD Manager
