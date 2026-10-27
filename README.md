# Fragify

Fragify is a cross-platform (iOS/Android/Web) esports tournament platform built with React Native and Expo, backed by Supabase. Players join tournaments for popular mobile titles, compete, track results on live scoreboards and leaderboards, chat with other players, and earn/spend an in-app currency that can be redeemed for real rewards.

## Features

**Tournaments & Competition**
- Create, edit, and browse tournaments for BGMI, Call of Duty Mobile, Free Fire, and Valorant
- Team creation and player/team registration
- Live scoreboards and result entry
- Global and per-event leaderboards
- Match/registration history

**Social & Chat**
- Direct messages and group chats with text, photo, and voice messages
- A world chat for all users
- User profiles, search, follow/unfollow, and blocking
- User reporting with admin review

**Economy & Rewards**
- FragCoins, an in-app virtual currency with a wallet view
- Reward catalog with redemption requests
- Real-money top-ups via Razorpay, processed through Supabase Edge Functions (order creation + signature verification)

**Premium Cosmetics**
- Animated avatar rings/frames and profile banners
- Multiple premium visual themes (e.g. Monarch, Dragon Wrath, Nebula) built with custom Reanimated/SVG animation layers

**Admin Tools**
- Broadcast notifications
- Host access request review
- Reward and redemption management
- User report moderation
- Role-based access (player / host / admin)

**Notifications**
- Push notifications for match updates, wallet/redemption changes, and chat activity

## Tech Stack

- **App**: React Native 0.86, Expo SDK 57, Expo Router (file-based, typed routes), React 19
- **Styling/UX**: React Native Reanimated & Worklets, React Native SVG, custom theming via `ThemeContext`
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime) with 60+ SQL migrations
- **Serverless**: Supabase Edge Functions for Razorpay order creation and payment verification
- **Payments**: Razorpay
- **Language/Tooling**: TypeScript, ESLint

## Project Structure

```
app/              Screens and navigation (Expo Router file-based routing)
app/(tabs)/       Bottom-tab screens: home, events, history, profile
components/       Shared UI components
components/premium/  Animated premium cosmetic components (avatar rings, banners)
lib/              Client-side business logic (Supabase client, uploads, rate limiting, etc.)
constants/        Theming and shared config
supabase/
  migrations/     Database schema history
  functions/      Edge Functions (Razorpay integration)
marketing-site/    Static landing page, privacy policy, terms, account deletion page
legal/            Legal page templates used to build marketing-site
```

## Getting Started

```bash
npm install
npx expo start
```

From the Expo CLI output you can open the app in a development build, Android emulator, iOS simulator, or Expo Go.

The app ships pointed at a live Supabase project (`lib/supabase.ts`) using Supabase's public anon key, which is safe to expose client-side and is protected by Postgres Row Level Security policies. To run against your own backend instead, create a Supabase project, apply the SQL files in `supabase/migrations/`, deploy the functions in `supabase/functions/`, and update the URL/key in `lib/supabase.ts`.

## License

No license has been set yet — all rights reserved by default until one is added.
