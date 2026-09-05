# Project Context

## Environment
- Language: TypeScript strict, React Native 0.86.2, React 19.2.3, Expo SDK 57
- Runtime: Hermes, New Architecture (Fabric), Bun package manager
- Build: bun install, bunx expo prebuild, expo run:ios / run:android, GitHub Actions AAB
- Test: jest + jest-expo (`jest --watchAll`, minimal coverage)
- Package Manager: bun (bun.lock)

## Project Type
- [x] Application (Mobile iOS + Android, school-life Papillon v8.5.0)
- [ ] Library/Package
- [ ] Microservice
- [ ] Monorepo

## Infrastructure
- Container: None (Expo prebuild generates native)
- Orchestration: None
- CI/CD: GitHub Actions (build-android.yml on main, merge.yml dev->main manual, release.yml version dispatch manual)
- Cloud: None (PostHog analytics, school APIs remote)

## Structure
- Source: app/ (expo-router groups (tabs)(onboarding)(settings)(modals)(features)(new)(dev))
- Tests: services/mock/*.test.ts only
- Docs: none (README empty)
- Entry: index.js -> expo-router/entry -> app/_layout.tsx -> AppProviders -> RootNavigator
- State: stores/ (zustand+MMKV persist, WatermelonDB v37 21 tables, SecureStore)
- Services: services/ 14 plugins (pronote, skolengo, ecoledirecte, appscho, alise, izly, ard, turboself, multi, local iCal, mock)
- i18n: locales/ 39 JSONs + i18next + Crowdin, 40 langs in Info.plist
- Native iOS: ios/Papillon/ (bundle xyz.getpapillon.ios, team 7RXNP6V83P, minOS 17.6, AppGroup group.xyz.getpapillon)
- Native Android: android/app/src/main/AndroidManifest.xml (package xyz.getpapillon.app, versionCode timestamp, edgeToEdge, predictiveBack, 16KB)

## Conventions (OBSERVED)
- Naming: camelCase files, PascalCase components
- Imports: @/* alias, simple-import-sort, unused-imports autofix
- Error handling: typed errors (AuthenticationError, ServiceUnavailableError) + Pawnote taxonomy, warn/error logger
- Testing: almost none (gap)

## Notes
- Review-only mission, no source changes. Deliverable /home/frerox/Aether-Review.md (39KB, 346 lines).
- Sub-agents stalled on large locale/emoji files; Commander synthesized directly from verified reads.
