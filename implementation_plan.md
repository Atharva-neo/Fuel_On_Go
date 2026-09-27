# Implementation Plan for Fuel on Go Enhancements

## Goal Description
Implement the 11 major fixes and feature additions described by the user, covering both frontend (React Native) and backend (Express with Supabase). Ensure proper auth flow, correct stats, new slot UI, booking fee calculations, mock UPI payment flow, QR code generation, admin dashboard functionality, pump registration with map location, slot deactivation with reason, QR scanner for admin check‑in, and database schema updates including seeding pumps and slots.

## User Review Required
> [!IMPORTANT]
> Review the proposed changes, especially any UI redesigns (movie‑style slot grid) and new screens. Confirm acceptance of mock payment flow (no real integration) and any new dependencies (e.g., `@react-native-community/slider`, `react-native-qrcode-svg`, `expo-camera`).

## Open Questions
> [!WARNING]
> 1. **OTP Verification**: Should we keep the development OTP hard‑coded to `123456` for all users, or implement a configurable mock OTP?
> 2. **Payment Methods**: Confirm that only **Cash** and **UPI** options are needed, and that the mock payment UI should appear after confirming the booking.
> 3. **Admin Dashboard UI**: Any specific design or color scheme preferences for the stats grid? (We will use a clean dark theme consistent with the app.)
> 4. **Pump Owner Registration Flow**: The user mentioned a separate "Pump Owner Registration" screen. Should it reuse the existing `RegistrationScreen` with additional fields, or be a new screen?
> 5. **Slot Deactivation Reason UI**: Preferred UI for reason chips – simple `Pressable` buttons or a custom component?
> 6. **QR Code Size & Styling**: Confirm size `220` and colors (`#000000` on white) are acceptable.
> 7. **Database Seeding**: Do you want the seeding SQL to be executed now via Supabase MCP, or should we just provide the script for you to run later?

---

## Proposed Changes

---
### 1. Auth Flow Adjustments (Frontend & Backend)
- **Frontend**: Update `UserAuthScreen` and `AdminAuthScreen` to call `/api/auth/check-phone?phone=...` after phone entry. Based on response, navigate to OTP screen or Registration screen.
- **Backend**: Add new GET route `/api/auth/check-phone` that queries `users` table and returns `{ exists: boolean, has_name: boolean, role: string }`.
- Adjust OTP screen flow to handle both login and new registration, navigating to HomeScreen or AdminDashboard accordingly.

---
### 2. New User Stats Bug Fix
- **Backend**: Modify POST `/api/auth/register` to insert default `trust_score = 100`, `no_show_count = 0`, `is_blocked = false`.
- **Backend**: Add `/api/users/stats` endpoint returning accurate counts and trust score.
- **Backend**: Run SQL to update existing bad data (`trust_score` and `no_show_count`).
- **Frontend**: Ensure Profile screen consumes `/api/users/stats` and displays correct values.

---
### 3. Slot Grid Redesign (PumpDetailScreen)
- Replace existing slot grid with a horizontal scrollable, three‑section movie‑style layout (Morning, Afternoon, Evening).
- Implement custom `SlotCard` component with styles for Available, Full, Expired, Booked, Deactivated.
- Add section headers showing available count, handling "No slots available" case.

---
### 4. CNG Amount Selector + Booking Fee
- Create a new bottom‑sheet component `BookingBottomSheet` (using React Native's `Modal` and `View`) that appears when a slot is tapped.
- Include Slider (`@react-native-community/slider`) for CNG amount (1‑20 kg).
- Compute booking fee = 10 % of `cngAmount * pricePerKg`.
- Show payment method radio buttons (Cash, UPI).
- Show payment summary box with "Pay now" (fee) and "Pay at pump" amounts, and a confirm button.

---
### 5. Mock Payment Gateway Flow
- New screen `MockPaymentScreen` to display UPI payment UI.
- After user taps "Pay", show processing spinner for 1.5 s, then success message.
- On success, call POST `/api/bookings/confirm` and navigate to `BookingDetailScreen`.

---
### 6. QR Code with Full User Biodata (BookingDetailScreen)
- Add `react-native-qrcode-svg` component rendering JSON payload as described.
- Update layout to include status badge, pump info, slot info, QR code, payment details, countdown timer, navigation button, cancel button.

---
### 7. Admin Dashboard Fixes
- **Backend**: Implement `/api/admin/dashboard` route (as provided) to return today’s stats for the pump owned by the logged‑in pump owner.
- **Frontend**: Replace current `AdminDashboardScreen` with the working version that fetches data, handles loading/error, and displays a stats grid or registration prompt.

---
### 8. Register Pump with Map Location
- New screen `AddPumpScreen` with form fields (name, address, city, district, etc.) and a 250 px tall `WebView` loading the supplied Leaflet map HTML.
- On map click, receive coordinates via `postMessage` and store them.
- Submit button calls POST `/api/pumps/register`.
- **Backend**: Add route to create pump, set owner role to `pump_owner`, generate slots for next 7 days.
- After success, navigate to AdminDashboard.

---
### 9. Slot Active/Inactive with Reason
- In `SlotManagementScreen`, add a toggle switch for each slot.
- When switched off, open modal for reason selection (chips + custom textbox) and optional resume time.
- On confirm, PATCH `/api/slots/:id/deactivate` with payload.
- **Backend**: Add columns to `slots` table (deactivation_reason, resume_time, deactivated_by, deactivated_at) and implement the PATCH route.
- Update user‑facing UI to show orange deactivated slots with tooltip showing reason.

---
### 10. QR Scanner for Pump Admin
- Implement `QRScannerScreen` using `expo-camera` as provided.
- On successful scan, POST to `/api/bookings/checkin-by-admin` and display result modal (success, already scanned, wrong pump, outside window).
- Ensure backend route exists (already described).

---
### 11. Supabase Database Setup & Seeding
- Run the extensive SQL script that adds constraints, missing columns, and generates slots for all pumps.
- Ensure tables have required columns (users, pumps, slots, bookings) and indexes.
- Provide instructions to execute via Supabase SQL editor or MCP.

---
## Verification Plan
### Automated Tests
- Run `npx tsc --noEmit` to ensure TypeScript builds without errors.
- Execute backend unit tests (if any) for new routes.
- Use Expo dev client to manually test each flow:
  * Phone check → OTP → Home/Dashboard
  * New user registration → Profile stats
  * Slot selection UI and booking bottom‑sheet
  * Mock payment flow → Booking confirmation
  * QR code generation and admin scan
  * Pump registration map selection
  * Slot deactivation with reason

### Manual Verification
- Deploy backend locally (or on Railway) and ensure all new endpoints respond correctly.
- Run the mobile app on iOS/Android simulators to verify UI and navigation.
- Confirm database changes via Supabase UI.

---

*Please review the plan and answer the open questions above. Once approved, we will proceed with implementation.*
