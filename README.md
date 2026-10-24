<p align="center">
  <img src="logo-new.png" alt="fuel on go logo" width="400" style="border-radius: 16px;"/>  
</p>


# Fuel on Go

Slot booking for CNG pumps. Drivers find a nearby station, reserve a 30-minute slot and show a QR code on arrival; pump owners approve requests, scan the QR to check people in, and manage their schedule.

The project is a React Native (Expo) app talking to a Node/Express API backed by Supabase (Postgres).

> **Status:** working prototype. Phone login uses a fixed placeholder OTP (`123456`) and no payment gateway is wired up yet. See [Limitations](#limitations).

## Features

**Drivers**
- Nearby pumps on a map (OpenStreetMap tiles) using real device GPS, with a road route to the chosen pump
- Book a slot; slots are generated from each pump's opening hours (30-minute grid, overnight hours and a `24:00` close supported)
- QR ticket for check-in, booking list split into upcoming / completed / cancelled
- Rate a pump after a completed visit (one verified rating per visit, editable); read other drivers' reviews
- Trust score that drops on no-shows, with a visible history

**Pump owners**
- Register a pump with an address search and a draggable map pin
- Approve or reject booking requests (requests can't be approved once the slot has started)
- Scan the customer's QR to check them in; mark no-shows
- Booking history with All / last 7 days / single-day filters, status filters, pagination and CSV export (the list and the export use the same query)
- Edit opening hours and capacity (slots are regenerated, and a change that would strand existing bookings is refused), update CNG supply status
- Read customer feedback and ratings

**General**
- Light and dark themes (Catppuccin Latte / Mocha), swipe or tap between tabs

## Repository layout

```
backend/    Express API, services, tests
mobile/     Expo app (React Native + TypeScript)
supabase/   SQL migrations (run in order)
frontend/   Earlier Next.js web client, not part of the current app
```

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project
- For the app: Expo Go on a phone, or an Android emulator

### 1. Database

Run the files in [`supabase/migrations`](supabase/migrations) in order (`001` to `009`) in the Supabase SQL editor. `003` seeds a set of Maharashtra pumps.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default `3000`) |
| `NODE_ENV` | `production` enforces a strong `JWT_SECRET` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service-role key. Server only, never ship it in the app |
| `JWT_SECRET` | At least 32 characters in production |
| `CORS_ORIGINS` | Comma-separated allowed origins |

Run the tests with `npm test`.

### 3. Mobile app

```bash
cd mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Scan the QR code with Expo Go. `EXPO_PUBLIC_API_URL` must be reachable from the phone, so use your machine's LAN address rather than `localhost`.

Type-check and run the unit tests:

```bash
npx tsc --noEmit
npm run test:theme    # also: map, colors, ratings, location, pumploc, sheet,
                      # schedule, bookings, history, swipe, expiry, tabbar
```

### Building an APK

Builds run on EAS. The `preview` profile produces an installable APK:

```bash
cd mobile
npx eas-cli build -p android --profile preview
```

See [`mobile/ANDROID_BUILD.md`](mobile/ANDROID_BUILD.md) for details.

## How it works

- **Auth:** phone number plus OTP, then a JWT. Roles are `user`, `pump_owner` and `admin`; owner endpoints check the role and that the pump belongs to the caller.
- **Booking lifecycle:** `pending` → `confirmed` → `arrived` (QR check-in). Other outcomes are `rejected`, `cancelled` and `no_show`. Dates and times are IST wall-clock values.
- **Slots:** generated per pump from its working hours; an owner changing the hours re-syncs future slots.
- **Ratings:** stored in `pump_ratings` (migration `008`); accepted only for the caller's own completed visit.

## Authentication (JWT)

1. `POST /api/auth/check-phone` tells the app whether the number is already registered.
2. `POST /api/auth/send-otp` stores an OTP for the normalised number (`+91` plus the last ten digits) in memory with a 5-minute expiry. The OTP is currently the fixed value `123456` and is also returned as `dev_otp`; replace this with a real SMS provider before going live.
3. `POST /api/auth/verify-otp` checks the OTP (single use) and returns `{ token, user }`.
4. The token is an HS256 JWT signed with `JWT_SECRET`, valid for 30 days, with this payload:

   ```json
   { "sub": "<user id>", "phone": "+91XXXXXXXXXX", "role": "user | pump_owner | admin", "exp": 0 }
   ```

5. The app keeps the token in `expo-secure-store` and an axios interceptor adds `Authorization: Bearer <token>` to every request.
6. The `authenticate` middleware verifies the signature and expiry and puts the payload on `req.user`; anything else is a `401`.
7. Owner and admin routes then re-check the role against the database (not just the token) and that the pump belongs to the caller, so a stale or tampered claim can't grant access.

In production the server refuses to start unless `JWT_SECRET` is at least 32 characters. Tokens are not revocable before they expire; logging out only clears them on the device.

## Trust score

Every user has a score from 0 to 100, starting at 80. It is a ledger: each change is a row in `trust_score_events` (migration `007`, append-only) with the change applied, the resulting score, a reason and who caused it, so the number can always be explained.

**What changes it**

| Event | Change |
|---|---|
| No-show confirmed by the pump owner | -15 |
| Cancelling more than 24 hours before the slot | 0 |
| Cancelling 6 to 24 hours before | -2 |
| Cancelling 1 to 6 hours before | -5 |
| Cancelling less than 1 hour before | -8 |
| Admin reversal of an earlier event | undoes that event |

The score only goes down on its own. There is no automatic recovery; the only way back up is an admin reversing a mistaken penalty.

**Rules**
- A no-show can only be recorded by the pump owner for a `confirmed` booking, and only after a 15-minute grace period from the slot start.
- Each penalty is keyed to its booking (`no_show:<id>`, `cancel:<id>`), so retries or double taps can't apply it twice. Competing requests resolve through a conditional status update, so only one wins.
- The score is clamped to 0-100, and the ledger records the change actually applied after clamping.
- A reversal needs a written reason, can't be applied twice, and a reversal can't itself be reversed.
- Scores are shown as bands: Excellent (90+), Good (75+), Fair (50+), Low (25+), Very Low.
- Users flagged `is_blocked` can't create bookings (`403`). The flag is separate from the score; the score does not block anyone automatically.
- If the ledger table hasn't been migrated, the profile still shows the score and just hides the history.

**Configuration** (all optional environment variables on the backend)

| Variable | Default |
|---|---|
| `TRUST_DEFAULT_SCORE` | `80` |
| `TRUST_NO_SHOW_PENALTY` | `15` |
| `TRUST_NO_SHOW_GRACE_MINUTES` | `15` |
| `TRUST_CANCELLATION_TIERS` | JSON array of `{minHours, exclusive, penalty}`, first match wins |

The policy lives in [`backend/src/config/trustPolicy.js`](backend/src/config/trustPolicy.js) and the scoring in [`backend/src/services/trustScoreService.js`](backend/src/services/trustScoreService.js). Users see their score and recent events under `GET /api/trust/me`.

## Deployment

The backend deploys to Railway (`railway.toml`, `Dockerfile` and `start.sh` are included). Pushing to GitHub does not deploy by itself; run `railway up` from `backend/`.

## Limitations

- OTP is a fixed placeholder; there is no SMS provider yet. Do not run this in production as it is.
- No payment gateway is integrated; booking fee amounts are stored but nothing is charged online.
- Schema changes are plain SQL migrations applied by hand, with no migration runner.

## Contributing

Issues and pull requests are welcome. Please run `npm test` in `backend/` and the relevant `npm run test:*` scripts plus `npx tsc --noEmit` in `mobile/` before opening a PR.

## License

No license has been chosen yet, so all rights are reserved by default. Add a `LICENSE` file before accepting outside contributions.
