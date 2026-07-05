# Google Play Console - iKHWEZI Upload Package

## What to Upload

This folder contains everything you need for Google Play Console submission.

### Folder Structure

```
GOOGLE_PLAY_CONSOLE/
├── app_bundle/          ← Upload your .aab (Android App Bundle) here
├── assets/
│   ├── icon/            ← App icon (512x512 PNG)
│   ├── screenshots/      ← Phone screenshots (max 8 images)
│   └── feature_graphic/  ← Feature graphic (1024x500 PNG)
└── CHECKLIST.txt        ← Pre-submission checklist
```

---

## Quick Upload Steps

1. **Build your Android app** (if you don't have .aab file yet)
   - Use React Native, Capacitor, or Flutter to wrap your web app
   - Generate signed Android App Bundle (.aab)
   - Save to: `app_bundle/ikhwezi.aab`

2. **Add App Icon**
   - Size: 512x512 pixels
   - Format: PNG
   - Save to: `assets/icon/icon.png`

3. **Add Screenshots** (Recommended: 4-8 images)
   - Each screenshot: 1080x1920 pixels (9:16 aspect ratio)
   - Format: PNG or JPG
   - Save to: `assets/screenshots/`
   - Examples: home_feed.png, live_stream.png, profile.png

4. **Add Feature Graphic**
   - Size: 1024x500 pixels
   - Format: PNG
   - Save to: `assets/feature_graphic/feature.png`

5. **Go to Google Play Console**
   - Open: https://play.google.com/console
   - Create new app or select existing
   - Upload .aab from `app_bundle/`
   - Add assets from `assets/` folders
   - Fill in app description & details
   - Submit for review

---

## Asset Size Specifications

| Asset | Size | Format |
|-------|------|--------|
| App Icon | 512×512 px | PNG |
| Screenshots | 1080×1920 px (phone) | PNG/JPG |
| Feature Graphic | 1024×500 px | PNG |
| Promo Graphics | 180×120 px | PNG |

---

## File Naming Convention

Keep it simple:
- `icon.png` 
- `screenshot_1.png`, `screenshot_2.png`, etc.
- `feature.png`
- `ikhwezi.aab` (app bundle)

---

## Links

- Google Play Console: https://play.google.com/console
- Android App Bundle Docs: https://developer.android.com/guide/app-bundle
- Design Guidelines: https://play.google.com/console/about/guides/

