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
- Permissions: INTERNET + photo library (via expo-image-picker plugin) for profile photos.
- Icon / adaptive icon / splash / favicon generated from the user's Afterglow
  lighthouse artwork (`assets/images/icon.png`, `adaptive-icon.png`,
  `splash-image.png` (heart symbol), `app-image.png` (full art, welcome screen),
  `hero-heart.png` (premium hero)). Brand sky colour `#2C3157`.

## Iteration 2 (done)
- **Real photos**: `POST /api/profile/photo` (multipart) → Emergent Object
  Storage, served publicly via `GET /api/files/{path}` (only paths recorded in
  `photos` collection). `photo_url` stored as relative `/api/files/...`;
  frontend resolves via `photoUri()`. Permission flow in `src/photo-picker.ts`.
- **Premium subscription ($5.99/mo)**: Stripe Checkout `mode=subscription`
  via Emergent Stripe proxy (`STRIPE_API_KEY=sk_test_emergent`).
  `POST /api/premium/checkout {origin_url}` → `GET /api/premium/status?session_id`
  (auth, polls + activates) → `GET /api/premium/confirm?session_id` (unauth, for
  browser success page). Webhook `POST /api/webhook/stripe` (needs
  `STRIPE_WEBHOOK_SECRET`). Routes `/premium-success`, `/premium-cancel`.
  `users.is_premium` drives badges on Profile + Discover cards.
- **Daily gentle prompt**: `GET /api/prompts/today` (deterministic by day).
  Shown as a card on Discover and a tap-to-fill chip in Chat.

## Iteration 3 (done)
- **Gathering reminders**: RSVPs persist (`rsvps` collection). `POST/DELETE
  /api/gatherings/{id}/rsvp`, `GET /api/gatherings/upcoming` (RSVP'd, not yet
  ended, max 3). Gatherings roll forward weekly once they end. Discover shows a
  "Your next gathering" card with "Starts in 2 hours" / "Happening now" /
  "Tomorrow at 3:00 PM" wording (`src/gathering-time.ts`).
- **Live Stripe keys**: no code change needed — set in `backend/.env`:
  `STRIPE_API_KEY=sk_live_...` (or your own `sk_test_...`) and
  `STRIPE_WEBHOOK_SECRET=whsec_...`. Webhook endpoint:
  `https://<deployed-domain>/api/webhook/stripe`; events:
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`. Subscription
  updated/deleted now syncs `is_premium` automatically. The shared
  `sk_test_emergent` key routes through the Emergent proxy; real keys go
  straight to Stripe.

## Deferred / next iteration
- Video calling.
- Push notifications (Emergent-managed).
