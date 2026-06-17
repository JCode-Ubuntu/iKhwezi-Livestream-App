How to store Android signing keystore and secrets in GitHub Actions

1. Create a signing keystore locally (example):

   keytool -genkey -v -keystore ikhwezi.keystore -alias ikhwezi -keyalg RSA -keysize 2048 -validity 10000

2. Convert keystore to base64 (so it can be stored as a secret):

   base64 -w 0 ikhwezi.keystore > ikhwezi.keystore.base64

3. In your GitHub repository, go to Settings → Secrets and variables → Actions → New repository secret.

   Add these secrets:
   - ANDROID_KEYSTORE_BASE64 : (paste contents of ikhwezi.keystore.base64)
   - ANDROID_KEYSTORE_PASSWORD : your keystore password
   - ANDROID_KEY_ALIAS : ikhwezi
   - ANDROID_KEY_PASSWORD : your key password (often same as keystore password)

4. Modify GitHub Actions workflow to decode and write the keystore before the Gradle sign step:

   echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > $HOME/ikhwezi.keystore

5. Use Gradle signingConfigs to pick up keystore at $HOME/ikhwezi.keystore with the provided passwords.

6. Keep your keystore file secure and do not commit it to the repo. Rotate secrets if leaked.
