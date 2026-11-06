# Bacta Android

Native client for the Bacta server (Kotlin, Jetpack Compose, minSdk 34).

**Before changing anything here, read [`docs/ANDROID.md`](../docs/ANDROID.md).** The short version:

- Android's official docs are the source of truth; the web app is only the picture of the finished product to compare against.
- Nothing user-visible is hardcoded: text in `strings.xml`, numbers and units through `Formatters`, per-metric facts in `MetricCatalog`, thresholds in `BandTable`s, user goals in `Targets`.
- Tests, fixtures and previews use synthetic data only. This repository is public and the data is health data.
- Write the failing test first, render the screen preview and read it, then check on a device.

Build and test: `bash scripts/android-build.sh build testDebugUnitTest assembleDebug` (builds on the dev VM over SSH).
