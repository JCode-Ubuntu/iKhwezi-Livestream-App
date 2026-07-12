# App Store & Play Store listing assets

Generated from the **create button** design (glossy brown-gold + three-star constellation).

## Regenerate all assets

```bash
cd frontend
npm install
npm run store:assets
```

## Files (ready for upload)

| File | Use |
|------|-----|
| `play-icon-512.png` | Google Play **App icon** (512×512) |
| `ios-app-icon-1024.png` | App Store **App icon** (1024×1024, no transparency) |
| `play-feature-graphic.png` | Google Play **Feature graphic** (1024×500) |
| `play-phone-screenshots/` | Google Play phone screenshots (1080×1920) |
| `ios-screenshots/` | App Store screenshots (1080×1920 — resize per device if needed) |
| `app-icon-master.svg` | Master vector (edit & re-run script) |

Android `mipmap-*` and iOS `AppIcon.appiconset` are updated automatically.

## Replace screenshots later

For best results, capture real app screens from a device or emulator, then replace files in `play-phone-screenshots/` and `ios-screenshots/`. Keep **1080×1920** or store-required sizes.

## URLs for both consoles

- Privacy policy: https://ikhwezi.site/privacy
- Support: https://ikhwezi.site/support

See `MOBILE_STORE_DEPLOY.md` in the repo root for submission steps.
