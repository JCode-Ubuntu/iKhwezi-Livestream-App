FOLDER: app_bundle/

WHERE TO PUT: Your signed Android App Bundle file

WHAT TO UPLOAD:
- File format: .aab (Android App Bundle)
- Filename: ikhwezi.aab
- Size: ~20-50 MB typically

HOW TO GET IT:
1. You need to build your app as an Android app first
   - Option A: Use React Native with Expo
   - Option B: Use Capacitor to wrap web app
   - Option C: Use Flutter

2. Generate signed .aab:
   - In Android Studio: Build > Build App Bundle
   - Or use Gradle: ./gradlew bundleRelease

3. Save the generated .aab file here

HOW TO UPLOAD TO GOOGLE PLAY:
1. Go to Google Play Console
2. Select your app
3. Go to: Release → Production
4. Click "Create new release"
5. Upload your .aab file
6. Review and publish

IMPORTANT:
- Must be signed with your upload key
- Version code must increment with each release
- Target API level 34+ (current requirement)
