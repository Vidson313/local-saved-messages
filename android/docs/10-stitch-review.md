# 10 — Stitch Design Review

The Stitch project `5443394552272251730` holds ~25 screens and a design system
for this app. It was reviewed before implementation, and it is good in most
respects — the palette, the density and the RTL flow all work.

But it contains **false security claims** and a few defects. This document
records what was found and what was decided, so the issues are not
reintroduced and so any future pass over the design has a checklist.

---

## 1. The serious one: the security claims are untrue

The vault screens display:

- «رمزگشایی شد» (decrypted) as a status badge
- «نشست امن TEE فعال است» (secure TEE session active)
- «AES-256» as a badge
- «کلید سخت‌افزاری Android Keystore احراز شد»
- A «DECRYPTED» progress label and a «تازه‌سازی کلید» (refresh key) action
- «تمام کلیدهای رمزگشایی در حافظه موقت سخت‌افزاری پردازش شده و هرگز در
  فایل‌های کش یا دیسک نوشته نمی‌شوند»
- In settings: «رمزنگاری دیتابیس SQLite — کلید در Android Keystore سخت‌افزاری»

**None of this would be true of the implementation.** SQLite is not encrypted
(only SQLCipher does that), the TEE is not involved, there is no key, and
nothing is "decrypted" — the files sit in app-private storage in the clear.

This is not a cosmetic problem. A vault that says "AES-256" invites a user to
put a seed phrase or a passport scan inside, believing it is encrypted when it
is not. Telling a user their data is protected when it is not is worse than
having no vault at all.

**Decision — the vault is a privacy gate, and it says so.**

| Was | Is |
|-----|-----|
| «AES-256» badge | Removed |
| «رمزگشایی شد» | «با قفل دستگاه محافظت می‌شود» |
| «نشست امن TEE فعال است» | Removed |
| «DECRYPTED» progress | Removed |
| «تازه‌سازی کلید» | Removed |
| «رمزنگاری دیتابیس SQLite» | Removed |

The mechanism is `BiometricPrompt` with a `DEVICE_CREDENTIAL` fallback. The
copy in the settings screen must state the limitation plainly: the gate
protects against someone picking up an unlocked phone, not against a rooted
device or a forensic image.

## 2. Dangerous sample content

The vault screen's sample items include «کلمات بازیابی کیف‌پول (Seed Phrase)»
with the body `abandon ability able about… (۱۲ کلمه)`. A user could read that
as a template and paste a **real** seed phrase into an app that is not
encrypting anything.

**Decision:** no seed phrases, no passwords, no key material, in any sample
data. Samples are limited to ordinary things — an invoice, a contract, a
screenshot, a receipt.

## 3. Inert affordances

| Item | Problem | Decision |
|------|---------|----------|
| Microphone icon in the search field | Implies voice search, which does not exist | Removed |
| «۰.۰۴ ثانیه» under the result count | A performance number the user cannot act on | Removed |
| «۷ پوشه و ۱۹۲ فایل محلی» | Hard-coded counts in a static mock | Computed from the database |
| «Search» in a Persian header | An untranslated string | «جستجو» |

An icon that does nothing is worse than a missing icon: it teaches the user
that this app has features it does not have.

## 4. Contradictions with the design brief

| Item | The brief says | The screens do | Decision |
|------|----------------|----------------|----------|
| Glassmorphism | «no glassmorphism, frosted glass, or translucent blurred panels» | `backdrop-blur-xl` on the header and the bottom bar | Removed. Surfaces are flat and opaque. |
| Gradients | «no gradient backgrounds» | The app icon uses a gradient | The **icon** keeps it — the brief's exclusion is about UI surfaces. |
| Chat bubbles | «Chat-like bubbles for saved items» | Every list item is a flat rectangular card | Flat cards for lists; a bubble only for a text note, which is the one thing that genuinely reads as a message. |
| Primary colour | The style guide says `#2481CC` | The generated Material palette says `#005F9E`, and the pages use `bg-primary` | `#2481CC`. The Telegram blue is the one that matches the product, and the design guide says so explicitly. |
| Screenshot blocking | — | On by default | Off by default. Blocking a user from screenshotting their own archive is hostile. |

## 5. Layout defects

| # | Defect | Fix |
|---|--------|-----|
| 1 | The FAB sits **on top of** the bottom navigation bar. The spec says 16 px from the bottom; the bar is 64 px tall. | The FAB is anchored above the bar with the standard 16 dp gap. |
| 2 | Three different header patterns across the screens. | One `AppTopBar` component, used everywhere. |
| 3 | The storage screen's header says «۱.۲۵ گیگابایت مصرف‌شده» while the chart below says «۰ گیگابایت». | One source: the sum of the stored file sizes. |
| 4 | The send button in a folder's composer is labelled «ارسال» (send). Nothing is sent — the app has no network. | «ذخیره» (save). |
| 5 | The back arrow points left. | It points **right**. In a right-to-left layout, back means going right. |

## 6. Screens that were never designed

| Missing | Why it matters |
|---------|----------------|
| **The save screen** (preview + note + folder picker) | This is the product. It was not in the twenty-five screens. It is now specified in [05-ui-ux.md](05-ui-ux.md) §3.2. |
| **The entry detail screen** | Preview plus metadata plus actions. Specified in [05-ui-ux.md](05-ui-ux.md) §3.4. |
| **The audio player** | Only a video player was designed. Specified in [05-ui-ux.md](05-ui-ux.md) §3.6. |

## 7. Things the design got right — keep them

- **The restrained palette.** One blue for actions, one green for counts and
  positive state, a cool grey-blue canvas. Colour signals, it does not decorate.
- **RTL flow.** The icon on the right, the title next to it, the timestamp and
  count on the left. Correct, and the reason the app reads as native rather
  than mirrored.
- **The chip row** with the type filters and a count on the active chip.
- **Inset grouped lists** over a flat canvas, with hairline dividers instead
  of shadows.
- **Vazirmatn** with the 1.45–1.6× line heights Persian needs.
- **The filter scope dropdown** in search («محدوده: در همهٔ پوشه‌ها»).

---

## Checklist for any future design pass

- [ ] No security claim the implementation does not honour
- [ ] No seed phrase, password, or key material in sample data
- [ ] Every icon triggers something
- [ ] Every number comes from the database
- [ ] No `backdrop-blur` anywhere
- [ ] Primary is `#2481CC`
- [ ] The FAB clears the bottom bar
- [ ] One header component
- [ ] The back arrow points right
- [ ] «ارسال» is never used where nothing is sent
