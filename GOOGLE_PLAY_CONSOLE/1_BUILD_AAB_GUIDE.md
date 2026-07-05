# Building Android App Bundle (.aab) for iKHWEZI

## Option 1: Easiest - Use Capacitor (Recommended)

Capacitor wraps your React web app as a native Android app.

### Step 1: Install Capacitor

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init
```

Follow prompts:
- App name: **iKHWEZI**
- App ID: **com.ikhwezi.app**

### Step 2: Add Android Platform

```bash
npx cap add android
```

This creates an `android/` folder ready for building.

### Step 3: Build Web App First

```bash
npm run build
```

This creates optimized production files in `dist/`.

### Step 4: Copy Web App to Android

```bash
npx cap copy android
```

### Step 5: Build Android App Bundle

```bash
cd android
./gradlew bundleRelease
```

**Output file location:**
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 6: Copy to Google Play Folder

```bash
cp android/app/build/outputs/bundle/release/app-release.aab ../GOOGLE_PLAY_CONSOLE/app_bundle/ikhwezi.aab
```

---

## Option 2: Use React Native (More Control)

If you want a true native experience:

```bash
npx create-expo-app ikhwezi-mobile
cd ikhwezi-mobile
npm install expo-build-properties
eas build --platform android --type app-bundle
```

This generates a `.aab` file automatically.

---

## Option 3: Use Android Studio GUI (Simple)

1. Install Android Studio from https://developer.android.com/studio
2. Open the `android/` folder (after Capacitor setup)
3. Go to **Build → Build App Bundle**
4. Choose **Release** configuration
5. Android Studio generates the .aab file
6. Copy to `GOOGLE_PLAY_CONSOLE/app_bundle/`

---

## Common Issues & Fixes

### Issue: "gradlew not found"
**Solution:**
```bash
cd android
chmod +x gradlew  # On Mac/Linux
gradlew bundleRelease  # On Windows
```

### Issue: "java not found"
**Solution:** Install Java JDK 11+
```bash
# Check Java version
java -version
```

### Issue: Build fails
**Solution:** Clean and rebuild
```bash
cd android
./gradlew clean
./gradlew bundleRelease
```

---

## Signing the App Bundle

Google Play requires a signed .aab file. When you build with `bundleRelease`, it asks for:

**First time only:**
1. Create a keystore (passwords & keys to sign your app)
2. Enter keystore password
3. Enter key password
4. Confirm details

**Save these credentials safely!** You'll need them for all future updates.

---

## Next Steps

1. Choose Capacitor (Option 1 - easiest for web apps)
2. Run the commands above
3. Wait for build (5-10 minutes)
4. Your .aab file goes to `GOOGLE_PLAY_CONSOLE/app_bundle/`
5. Then move to **Step 3: Create Assets**

---

## Need Help?

- Capacitor Docs: https://capacitorjs.com/docs/getting-started
- Android Build: https://developer.android.com/studio/build
- React Native: https://reactnative.dev/docs/native-modules-android
