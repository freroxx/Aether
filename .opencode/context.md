# Project Context (Aether fork — updated 2026-09-05)

## Current Status
- Mission: Fork Papillon → Aether (Android-only FOSS, Pronote-only, M3 icons, no telemetry). Todo 16/16 [x], tree clean, head e84f2b10.
- M1 Rebrand DONE (eb915e7b): Aether/aether, com.aether.app, aether://, strings, GitHub URLs.
- M2 Debloat DONE: telemetry purge (posthog/analytics/consent files + provider + gate + track* calls + logger upload + CI secrets step; Magic default false) in eb915e7b+7dbd7b42; Pronote-only cut (9 service dirs + 5 onboarding dirs deleted, loader/enum/types/fetchSchools/constants trimmed, 8 deps dropped, pawnote-lts KEPT) + cards/transport/restaurants/address-modal/store-fields removed in 28d40367.
- M3 DONE (7a8921d3): menu.tsx (week pager via getWeeklyCanteenMenu+cache), messages.tsx (list) + message.tsx (thread+send via getChats/getChatMessages/sendMessageInChat), routes in RootNavigator, home rewired; fixed sents-only bug in services/pronote/chat.ts (merge received).
- M4 DONE (scoped): ui/components/MaterialIcon.tsx (@expo/material-symbols wrapper); migrated HomeHeader/soon/menu/messages; LiquidGlass removed from HomeHeader. Full 86-file Papicons codemod = follow-up.
- M5 DONE (config): platforms ["android"], dropped expo-ios-scene-lifecycle-plugin + with-ios-native-files + dep; ios/ folder frozen.
- M6 DONE: README fork notes, .github/workflows/quality.yml (tsc/eslint/prettier/jest--ci/doctor), removed PostHog secrets step from build-android.yml.
- Verification: grep-clean (no posthog/consent/track/skolengo/service refs); tsc/eslint/jest/prebuild NOT run locally (no bun, no node_modules) — gated in CI.
- Review report: /home/frerox/Aether-Review.md (39KB).
- Open task IDs: none. task_c4b987d2 (atomic Worker test) left RUNNING — cancel on resume.

## Pending Tasks (follow-ups, not blockers)
- Device/CI: bun install, tsc --noEmit, eslint, prebuild android, test menu/messages on live Pronote.
- New keystore secrets for com.aether.app before public release.
- Full Papicons/Lucide→Symbols codemod (~80 files), locales Papillon→Aether bulk, message create-mail UI, .opencode untrack (committed by accident).

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
