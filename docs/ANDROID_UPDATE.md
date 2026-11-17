# Android versioning and update process

## Current application version

The application UI version is defined in `src/appVersion.ts` and must match the `version` field in `package.json`. Use semantic versioning:

- Patch (for example, 0.12.1): fixes and stability improvements.
- Minor (for example, 0.13.0): backward-compatible capabilities.
- Major (for example, 1.0.0): breaking changes or a major release milestone.

## Create the stable signing key once

Android only accepts an in-place update when the new APK is signed with the same signing certificate as the installed application. Create one protected release keystore and keep it backed up offline. Never commit the keystore or passwords to this repository.

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded bytes of the release keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: key alias.
- `ANDROID_KEY_PASSWORD`: private-key password.

The `.github/workflows/android-release.yml` workflow uses these secrets when a `vX.Y.Z` tag is pushed. It builds a signed release APK and publishes the APK plus an `app-update.json` metadata file to the matching GitHub Release. The workflow fails clearly when signing secrets are missing; it does not publish an unsigned APK as an update.

## First migration from a CI debug APK

The existing PR/CI workflow produces a **debug APK** for testing. Its debug signing key is generated on the GitHub Actions runner and is not a persistent production signing key. A future stable release APK will therefore not be guaranteed to update that debug installation in place.

Before the first stable release installation:

1. In the app, open **Tools → Project Backup** and export a backup.
2. Confirm the backup file is stored somewhere safe.
3. Install the first signed stable APK. Android may require removing the old debug app first; uninstalling clears local app storage.
4. Open the new version and import the backup.
5. Keep the stable keystore unchanged for every later release.

After migration, a new release signed with the same key can be installed over the prior stable build using the Android package installer.

## Publish a release

1. Merge the reviewed code to `main`.
2. Confirm `package.json` and `src/appVersion.ts` contain the same version.
3. Push a tag such as `v0.12.0` to the release commit.
4. Wait for **Android Signed Release** to complete.
5. Verify the GitHub Release contains `church-audio-analyzer-v0.12.0.apk` and `app-update.json`.
6. Check the APK on the target Android device before distributing it.

The repository is private. Only people with GitHub access to this repository can open its Releases and download its assets.

## Update limitations

- Android does not permit silent installation of APK updates by an ordinary application. The user must approve the Android package-installer flow.
- The in-app Update Center opens the authenticated GitHub Releases page; it does not bypass repository access controls or download/install an APK in the background.
- A public update feed or authenticated update service is required for automatic in-app version comparison. Do not embed a GitHub personal access token in the app.
- Browser deployments can load a newly deployed web build after a refresh. Native Android updates still require a properly signed APK.
