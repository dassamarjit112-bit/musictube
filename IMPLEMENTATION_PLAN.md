# Implementation Plan - MusicTube Rebranding & Monetization

This plan outlines the steps to rebrand the application to **MusicTube**, integrate an ad system, add subscription tiers via Razorpay, and implement gift code functionality.

## 1. Rebranding (MusicTube)
- [ ] **Assets**: Use the newly generated logo across the web and mobile app.
- [ ] **Frontend**: 
    - [ ] Update `index.html` title and metadata.
    - [ ] Update `Sidebar.tsx`, `Auth.tsx`, and other components to replace "YouTube Music" with "MusicTube".
    - [ ] Update `manifest.json`.
- [ ] **Mobile (Flutter)**: 
    - [ ] Update app name in `AndroidManifest.xml` and `Info.plist`.
    - [ ] Update package name if necessary (changing APK name).
    - [ ] Update UI strings.

## 2. Ad System (Website Only)
- [ ] **ControlledAd Component**: Create a component that checks for `isPremium` and the 4-hour gap (`localStorage`).
- [ ] **Google AdSense**: Integrate the AdSense script and manual ad units.
- [ ] **Logic**: Implement the `last_ad_timestamp` logic to ensure a 4-hour gap for non-premium users.

## 3. Subscription & Payments
- [ ] **Razorpay Integration**:
    - [ ] Add Razorpay script to `index.html`.
    - [ ] Configure environment variables for Razorpay keys.
    - [ ] Create a `SubscriptionUI` with two tiers:
        1. **Basic (199)**: Lifetime access with ads.
        2. **Premium (399)**: Lifetime access without ads + future updates.
- [ ] **Supabase Integration**:
    - [ ] Update user profile schema to store `subscription_tier` and `expiry` (lifetime).
    - [ ] Create a `gift_codes` table in Supabase.
- [ ] **Gift Code System**:
    - [ ] UI for buying and redeeming gift codes.
    - [ ] Backend/Frontend logic to validate and apply gift codes.

## 4. Environment & Security
- [ ] Update `.env` with Razorpay and Supabase credentials.
- [ ] Ensure `.gitignore` covers `.env`.

## 5. Mobile App Updates
- [ ] Ensure the mobile app reflects the MusicTube branding.
- [ ] Sync subscription status from Supabase to the Flutter app.
