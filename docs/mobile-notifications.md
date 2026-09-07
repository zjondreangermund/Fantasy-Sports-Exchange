# Mobile notifications

Fantasy Arena supports two installed-app delivery paths:

- Installed web app (PWA): standards-based Web Push. VAPID keys are generated once and retained in the application database unless explicit `WEB_PUSH_VAPID_*` values are supplied.
- Android Capacitor app: Firebase Cloud Messaging (FCM). This requires the Firebase client file in the APK build and Firebase service-account credentials on the server.

## Android Firebase setup

1. In Firebase, register an Android app with package name `com.fantasyfc.app` and enable the Firebase Cloud Messaging API.
2. Download `google-services.json`, base64-encode the complete file, and save it as the GitHub Actions secret `FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_BASE64`. The Android build workflow writes it only inside the build runner.
3. Give the Railway server one of these credential forms:
   - `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`: base64-encoded Firebase service-account JSON; or
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete service-account JSON; or
   - all three of `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
4. Deploy the server and build/install a new APK. After signing in, the app asks the user to enable notifications. Android notification permission must be granted per device.

Never commit `google-services.json` or a service-account private key. The server reports native push as unavailable until valid service-account credentials are configured, while PWA Web Push remains available independently.

## Delivery behavior

Notification records are queued transactionally for every active device. Workers retry temporary failures, retire expired Web Push endpoints and FCM tokens, and route notification taps to the relevant Fantasy Arena screen. Subscribed users are checked for gameweek reminders in the background, so the app does not need to be open.

iOS native push is not enabled by this implementation; the installed PWA path works on supported iOS versions. Native iOS delivery additionally requires Apple Push Notification service credentials and Xcode push entitlements.
