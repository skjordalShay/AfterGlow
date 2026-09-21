# The Afterglow — PRD

## Vision
A quiet, respectful mobile app that helps widowed / bereaved seniors 55+ find
gentle companionship. Tagline: *gentle connection in the light after loss*.

## Core screens
1. **Welcome** — twilight hero with tagline and CTAs.
2. **Sign up / Sign in** — email + password, JWT session.
3. **Discover** (tab) — vertical list of member cards; each card supports "Send
   a wave" and "Message". No swipe mechanics.
4. **The Gathering** (tab) — seeded classes/activities with category chips
   (All, Wellness, Exercise, Arts, Social, History) and RSVP.
5. **Messages** (tab) — recent waves + conversations, tap to open a chat.
6. **Chat** — 1:1 messages with soft polling every 5s.
7. **Profile** (tab) — edit first name, zip, "About my journey", plus a link
   to a Premium showcase screen ("Coming soon").

## Tech
- Expo Router (file-based), React Native 0.86, Reanimated 4.
- FastAPI + Motor (MongoDB) with Argon2 (pwdlib) + PyJWT.
- Fonts: Playfair Display for display headings, system font for body.
- Theme values live in `src/theme.ts` (twilight purple + sunset gold),
  matching `design_guidelines.json`.

## Play Store readiness
- App name: **The Afterglow**
- Bundle ID (iOS) / package (Android): `com.afterglow.app`
- versionCode: 1, version: 1.0.0
- Minimum permissions: INTERNET only (no camera / location yet).
- Adaptive icon foreground + splash screen use brand purple background.

## Deferred / next iteration
- Stripe or RevenueCat subscription for the Premium screen (currently a
  showcase button — no purchase path).
- Video calling.
- Push notifications (Emergent-managed).
- Photo upload to Emergent Object Storage.
