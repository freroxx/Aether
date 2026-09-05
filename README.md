# Aether

Aether is a lightweight, Android-only, FOSS fork of [Papillon](https://github.com/PapillonApp/Papillon)
(GPL-3.0), focused on what students actually need: **Pronote** grades, timetable,
homework, attendance, news — plus working **messages** and **canteen menu**.

## What changed vs Papillon

- **Pronote-only**: Skolengo, EcoleDirecte, Univ (Multi/Appscho), canteen-card
  services (Izly, Turboself, ARD, Alise) and transport removed.
- **No cards, no transport**: canteen QR cards, restaurant accounts and
  transport directions deleted.
- **No telemetry, no tracking**: PostHog, consent screen and all analytics
  calls removed. Logging is local-only (`utils/logger/logger.ts`).
  On-device Magic AI (`react-native-fast-tflite`) is kept but **disabled by
  default** (opt-in in Settings → Magic).
- **Material 3 icons**: new screens use `@expo/material-symbols` via
  `ui/components/MaterialIcon.tsx`; same layout, expressive symbols.
- **Android-only**: `platforms: ["android"]`, package `com.aether.app`,
  scheme `aether://`. The `ios/` snapshot is frozen, not built.

## Develop

```bash
bun install --frozen-lockfile
bunx expo start            # dev (use --dev-client for native modules)
bunx expo run:android
bunx tsc --noEmit
bunx eslint . --max-warnings=0
bunx prettier --check .
bunx jest --ci
```

CI: `quality.yml` (typecheck + lint + format + tests + doctor) and
`build-android.yml` (signed AAB on `main`).

> Signing still uses the Papillon keystore secrets (`KEYSTORE`,
> `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). Before the first public
> Aether release, generate a new upload key and update the secrets, or Play
> will reject the `com.aether.app` artifact.

## Add a school service

Only Pronote is supported. Implement `SchoolServicePlugin`
(`services/shared/types.ts`), register it in
`AccountManager.getServicePluginForAccount` (`services/shared/index.ts`),
add an onboarding entry in `app/(onboarding)/utils/constants.tsx`.

## License

GPL-3.0 (see `LICENSE`), fork of Papillon. Pawnote
(`@blockshub/pawnote-lts`) is a runtime dependency of the Pronote plugin.
