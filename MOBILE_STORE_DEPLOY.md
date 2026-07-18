# iKHWEZI — Mobile Store Deployment (iOS + Google Play)

This app uses **Capacitor 8** to wrap the Vite/React frontend as native iOS and Android apps. Production API and media target **https://ikhwezi.site**.

## Prerequisites

| Platform | Tools |
|----------|--------|
| **Both** | Node 20+, `npm install` in `frontend/` |
| **Android** | Android Studio, JDK 17+, Google Play Console account ($25 one-time) |
| **iOS** | macOS, Xcode 15+, Apple Developer account ($99/year) |

## 1. Build the web bundle

```bash
cd frontend
npm install
npm run build:mobile
```

`frontend/.env.production` sets `VITE_SERVER_URL=https://ikhwezi.site` so native builds talk to production.

## 2. Sync Capacitor

```bash
npm run cap:sync
```

Copies `dist/` into `android/` and `ios/` native projects.

---

## Google Play Console (Android)

### App identity
- **Package:** `com.ikhwezi.app`
- **Version:** `3.0.10` (`versionCode` **30010** — must increment by 1 per Play upload; last live: 30009)
- **Release format:** AAB (configured in `capacitor.config.json`)

### Signing (required for Play)

1. Create upload keystore:
   ```bash
   keytool -genkey -v -keystore ikhwezi-upload.keystore -alias ikhwezi -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `frontend/android/keystore.properties.example` → `frontend/android/keystore.properties`
3. Fill in passwords and keystore path (do **not** commit `keystore.properties` or `.keystore` files)

### Build release AAB

```bash
cd frontend
npm run store:assets   # icons + screenshots (create-button design)
npm run android:bundle
```

Output: `frontend/android/app/build/outputs/bundle/release/app-release.aab`

### Play Console checklist

- [ ] Create app → Production → Create new release → Upload AAB
- [ ] **Store listing:** name `iKHWEZI`, short description, full description, screenshots (phone 1080×1920 min)
- [ ] **App icon:** 512×512 PNG (use brand gold/black assets)
- [ ] **Feature graphic:** 1024×500
- [ ] **Privacy policy URL:** `https://ikhwezi.site/privacy` (host a policy page)
- [ ] **Data safety:** declare account, photos/videos, user content, crash logs
- [ ] **Content rating:** questionnaire (likely Teen due to UGC/live)
- [ ] **Target audience** and **News app** declarations
- [ ] **Permissions justification:** camera/mic for stories & live; media read for uploads

### Permissions (already in AndroidManifest)
- `INTERNET`, `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_*`, `POST_NOTIFICATIONS`

---

## Apple App Store (iOS)

> **Requires a Mac** with Xcode. The `ios/` folder is generated via `npx cap add ios` after `npm install`.

### Open project

```bash
cd frontend
npm run cap:ios
```

### Xcode settings

1. **Signing & Capabilities** → Team = your Apple Developer team
2. **Bundle Identifier:** `com.ikhwezi.app`
3. **Version:** 3.0.0, **Build:** 30000
4. Add capabilities if needed later: Push Notifications, Background Modes (audio for live)

### Info.plist usage strings (add in Xcode → Info)

| Key | Suggested text |
|-----|----------------|
| `NSCameraUsageDescription` | iKHWEZI needs camera access to record stories and videos. |
| `NSMicrophoneUsageDescription` | iKHWEZI needs microphone access for live streams and video recording. |
| `NSPhotoLibraryUsageDescription` | iKHWEZI needs photo library access to upload images and videos. |
| `NSPhotoLibraryAddUsageDescription` | iKHWEZI can save content you create to your photo library. |

### Archive & upload

1. Xcode → Product → **Archive**
2. **Distribute App** → App Store Connect → Upload
3. App Store Connect → TestFlight (optional) → Submit for Review

### App Store Connect checklist

- [ ] App name, subtitle, description, keywords
- [ ] Screenshots: 6.7", 6.5", 5.5" iPhone sizes
- [ ] Privacy policy URL
- [ ] App Privacy nutrition labels (match Android data safety)
- [ ] Age rating questionnaire
- [ ] Support URL and marketing URL

---

## Store listing copy (starter)

**Short (80 chars):**  
Stream the night. Watch live, share stories, and shine on iKHWEZI.

**Full:**  
iKHWEZI Ultima is a premium social livestream experience. Discover trending videos, join live broadcasts, share stories, message creators, and be part of a growing community — all in a sleek black-and-gold interface built for mobile.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank screen on device | Run `npm run cap:sync` after `npm run build`; confirm `dist/index.html` exists |
| API 404 on mobile | Verify `VITE_SERVER_URL=https://ikhwezi.site` in `.env.production` |
| Media won't load | Check `resolveMediaUrl()` — paths should resolve to `https://ikhwezi.site/storage/...` |
| Socket disconnects | Ensure `ikhwezi.site` allows Socket.IO polling/WebSocket from app WebView |
| Gradle signing error | Create `keystore.properties` or build debug: `cd android && ./gradlew assembleDebug` |

---

## CI note

Web deploy to Lightsail (`.github/workflows/deploy.yml`) is separate from store releases. Store builds are produced locally or via a dedicated mobile CI job with signing secrets.
