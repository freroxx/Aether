# Mission: Fork Papillon → Aether (Android-only FOSS, Pronote-only, M3 icons, no telemetry)

> Pawnote (`@blockshub/pawnote-lts`) is CRITICAL — never remove. Pronote-only means keep pawnote + shared + local + mock.

## M1: Rebrand Papillon→Aether | status: completed
### T1.1: App identity | agent:Worker
- [x] S1.1.1: app.config.ts name/slug/scheme/package (com.aether.app, aether://) | size:S
- [x] S1.1.2: AndroidManifest schemes → aether only, remove exp+papillon | size:S
- [x] S1.1.3: package.json name (aether), permission strings Aether | size:S
- [x] S1.1.4: settings URLs + soon.tsx rebrand (locales bulk deferred) | size:M

## M2: Debloat (Pronote-only, no cards/transport/telemetry) | status: completed
### T2.1: Pronote-only services | agent:Worker | depends:M1
- [x] S2.1.1: Delete non-Pronote services (keep pronote/shared/local/mock, keep pawnote-lts) + trim Services enum + onboarding constants | size:L
- [x] S2.1.2: Drop unused deps (skolengojs, alise, turboself, esup-multi, blockscho/directe/rd) keep pawnote | size:S
### T2.2: Remove cards+transport | agent:Worker | depends:T2.1
- [x] S2.2.1: Delete cards routes, settings cards/transport, Transit, restaurant/transport utils, store transport fields, calendar transportInfo | size:M
### T2.3: Telemetry purge (keep Magic off-by-default) | agent:Worker
- [x] S2.3.1: Remove posthog/analytics/consent/app-consent + Provider + screen() + track* calls + secrets CI | size:M
- [x] S2.3.2: Magic disabled by default (defaultPersonalization + verify init gate) | size:S

## M3: Fix messages + menu (were "coming soon") | status: completed
### T3.1: Messages for Pronote | agent:Worker | depends:M2
- [x] S3.1.1: Messages list + thread + send UI (service+DB ready, zero UI), rewire soon links | size:L
### T3.2: Menu for Pronote | agent:Worker | depends:M2
- [x] S3.2.1: Menu week UI via getWeeklyCanteenMenu + cache, rewire soon links | size:M
- [x] S3.0.1: HomeHeader dead cards route replaced with Chats placeholder, release URL → github | size:S
- [x] S3.1.2: Fixed sents-only bug in fetchPronoteChatMessages (merge received) | size:S

## M4: M3 icons-only | agent:Worker | depends:M2
- [x] S4.1.1: MaterialIcon wrapper + migrated HomeHeader/soon/menu/messages, removed LiquidGlass from HomeHeader (full 86-file codemod = follow-up) | size:L

## M5: Android-only progressive | agent:Worker | depends:M1
- [x] S5.1.1: app.config platforms android-only, dropped iOS plugins, removed iOS scene dep (ios/ frozen) | size:M

## M6: Quality + FOSS docs | agent:Reviewer
- [x] S6.1.1: README fork notes, quality CI, dropped PostHog secrets step (toolchain absent locally: no bun/node_modules, CI runs gates) | size:M
