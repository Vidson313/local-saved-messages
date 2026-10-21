# 08 — Persian Localisation & RTL

The app is published on the **Bazaar** app store, so Persian is the primary
language, not an afterthought. This document specifies the localisation
approach, the RTL rules, and the Persian-specific formatting behaviour.

---

## 1. Locale strategy

| Setting | Value |
|---------|-------|
| Default locale | **`fa`** (Persian) |
| Secondary locale | `en` (English) |
| Layout direction | Follows the system locale; Persian devices are RTL |
| Fallback | `en` — every string has an English fallback so a missing translation never shows a raw key |

Resource layout:

```
res/
├── values/strings.xml          ← English (the default / fallback)
├── values-fa/strings.xml       ← Persian
├── values-night/               ← dark-theme resources
└── xml/                        ← locale-independent configs
```

**The English file is the default**, and Persian overrides it. This is
backwards from what feels natural in a Persian-first product, but it is the
Android convention: `values/` is the fallback for every locale, and a missing
key in `values-fa/` falls back to `values/` rather than crashing.

The consequence for a Persian-only user: none. They see Persian. The
consequence for a reviewer who switches the phone to English: they see
English, and the app is still fully usable — which matters, because Bazaar
reviewers may not read Persian.

### 1.1 Every string is a resource

No user-facing string is written inline in a composable. This is enforced by
review, and it is the reason adding a second locale is resource-only work.

```kotlin
// ✗ Never
Text("Save to folder")

// ✓ Always
Text(stringResource(R.string.save_to_folder))
```

Plurals, quantities, and formatted values use the resource system:

```kotlin
// A count of entries: "۳ مورد" / "3 items"
pluralStringResource(R.plurals.entry_count, count, count)
```

### 1.2 String inventory

Roughly 180 strings. The categories:

| Category | Example (fa) | Example (en) |
|----------|--------------|--------------|
| Screen titles | `پوشه‌ها` | `Folders` |
| Actions | `ذخیره` / `اشتراک‌گذاری` / `حذف` | `Save` / `Share` / `Delete` |
| The share picker | `ذخیره در` / `یادداشت (اختیاری)` | `Save to` / `Note (optional)` |
| States | `چیزی اینجا نیست` / `در حال کپی…` | `Nothing here yet` / `Copying…` |
| Errors | `فایل بزرگ‌تر از حد مجاز است` | `The file is too large` |
| Settings | `پشتیبان‌گیری` / `حافظهٔ مصرفی` | `Backup` / `Storage used` |
| Relative time | `۲ دقیقه پیش` | `2 minutes ago` |

### 1.3 Terminology

One word per concept, everywhere. The glossary below is the single source; a
term is never translated two ways in two screens.

| English | Persian | Notes |
|---------|---------|-------|
| Folder | **پوشه** | The destination for entries. Never "گفتگو" (chat) or "چت" |
| Entry | **مورد** | A saved item. Avoid "پیام" (message), which implies a conversation |
| Note | **یادداشت** | The user's caption |
| Share | **اشتراک‌گذاری** | Matches the Android share-sheet wording |
| Save | **ذخیره** | |
| Tag | **برچسب** | |
| Pin | **سنجاق** | Verb form: "سنجاق‌کردن" |
| Export | **برون‌ریزی** | |
| Import | **درون‌ریزی** | |
| Draft | **پیش‌نویس** | |
| Storage used | **حافظهٔ مصرفی** | |
| Backup | **پشتیبان** | |

**"Save" is ambiguous in Persian.** `ذخیره` means "to save/store" and is
correct for the share picker. For the *action* of marking an entry as
important, the app uses `سنجاق‌کردن` (pin) and `نشان‌کردن` (mark), never
`ذخیره`. This is the same distinction the English UI makes between "Save"
and "Pin", so the two locales stay parallel.

---

## 2. RTL layout rules

### 2.1 The rule

**Never hard-code a direction.** Use `start` and `end` everywhere, and let
`layoutDirection` decide.

```kotlin
// ✗
Modifier.padding(start = 16.dp, end = 8.dp)   // "start" is fine, but…
Row { Spacer(Modifier.width(8.dp)) }            // a raw Spacer is direction-agnostic by luck
Text("...")                                      // fine — text direction is automatic

// ✗ The real mistake
Box(Modifier.fillMaxWidth().padding(left = 16.dp, right = 16.dp))
```

`left`/`right` are acceptable **only** for genuinely physical things:

| Physical | Logical | Use |
|----------|---------|-----|
| A back arrow that must point left | — | `Icons.AutoMirrored.Filled.ArrowBack` — the auto-mirrored variant |
| The chevron on a list row | `ChevronRight` → `Icons.AutoMirrored.Filled.KeyboardArrowRight` | Auto-mirrored |
| A progress bar filling up | — | Fill direction follows the layout direction automatically in Compose |
| A photo of a document | — | Never mirrored, obviously |

**Any icon that has a direction must be an `AutoMirrored` variant.**
`Icons.Default.ArrowBack` points left and must point right in RTL;
`Icons.AutoMirrored.Filled.ArrowBack` handles it. The same applies to
`KeyboardArrowRight`, `Send` (the paper plane in Material mirrors), `List`,
`Login`, `Logout`, `Reply`, `Redo`, `Sort`, `VolumeUp`, `ChevronRight`.

The Material Symbols set mirrors by default in recent versions, but the
`AutoMirrored` variants are explicit and safe. The icon audit in phase 5
checks every icon in the app for this.

### 2.2 Text direction inside a field

The note field uses `TextDirection.Content` for Persian and `TextDirection.ContentOrLtr` for
mixed content, so a field with an English URL inside Persian text renders
correctly:

```kotlin
BasicTextField(
    textStyle = TextStyle(textDirection = TextDirection.Content),
    …
)
```

The web app already does this with `dir="auto"` on its textarea and inputs —
the same idea, so the two apps behave identically for mixed content.

### 2.3 Mixed-direction content in a list

A file name, a note, or a URL can be Latin, Persian, or a mix. Each bubble's
text direction is derived from its content, not from the app locale:

```kotlin
val direction = if (isMostlyPersian(text)) TextDirection.Rtl else TextDirection.Ltr
```

A simple heuristic works: count Persian/Arabic codepoints versus Latin ones
and pick the majority. A URL or a Latin file name is LTR even in a Persian
list, and a Persian note is RTL even in an English locale.

This matters because a Persian file name — `فایل-صورتحساب.pdf` — contains a
Latin extension, and a naive LTR assumption renders the trailing `.pdf` in
the wrong place.

### 2.4 Numbers, dates, and sizes

All numbers, dates, and file sizes use `NumberFormat` / `DateTimeFormatter`
with the resolved locale. No string concatenation of a number into a Persian
sentence.

| Value | Persian (fa) | English (en) |
|-------|--------------|--------------|
| 1 234 567 | `۱٬۲۳۴٬۵۶۷` | `1,234,567` |
| Date | `۲۱ مهر ۱۴۰۵` | `21 Oct 2026` |
| Relative | `۲ دقیقه پیش` | `2 minutes ago` |
| Size | `۱٫۲ مگابایت` | `1.2 MB` |
| Time | `۱۲:۴۰` | `12:40` |

The **Persian calendar** (Jalali) is used for dates. The `java.time` API
covers this through the `chrono` package with the `persian` locale, or via
`android.icu` on API 24+:

```kotlin
val formatter = DateTimeFormatter
    .ofPattern("d MMMM yyyy", Locale.forLanguageTag("fa-IR-u-ca-persian"))
```

The device's calendar preference is honoured: if the user's system is set to
the Jalali calendar, the app shows Jalali dates; if it is set to Gregorian, the
app shows Gregorian. The app never forces one over the user's system setting.

**File sizes** are formatted with a binary/decimal decision made once: the
web app uses `formatBytes` with 1024-based units. The Android app uses the
same base so the two agree, but with locale-aware separators and units
(`کیلوبایت` / `KB`).

### 2.5 The bilingual problem: file names

The file name shown to the user is the **original** name from the source app.
It may be in any script, and it is never transliterated or translated. It is
displayed with `TextDirection.Content` so it renders correctly whatever it
contains.

The *stored* file name is always `<uuid>.<ext>` — a UUID is script-neutral,
so no filename ever depends on the locale. See
[03-local-data.md](03-local-data.md) §2.1.

---

## 3. Typography for Persian

Persian needs more vertical space than Latin at the same nominal size.

| Rule | Detail |
|------|--------|
| **Line height** | 1.6× for Persian body text, versus 1.4× for Latin. Compose's default line height is too tight for Persian descenders and diacritics. |
| **Font size** | Persian glyphs are visually smaller than Latin at the same `sp`. Body text is 16 sp in both, but Persian often reads better at 17–18 sp. The app uses 16 sp as the base and lets the system font scale handle the rest. |
| **Font family** | The system font is used, so the device's Persian font is respected. No bundled font — a bundled font would override the user's preference and ignore their accessibility text scale. |
| **Letter spacing** | `0.sp` explicitly. Some Persian fonts render badly with letter spacing, and Compose's default tracking can be too tight for connected Persian letterforms. |
| **ZWNJ** | Persian compound words use ZWNJ (`می‌رود`, `برنامه‌نویسی`). Strings must use `‌` where grammatically correct, and never a regular space. |
| **Yeh and Kaf** | Use the Persian forms `ی` (U+06CC) and `ک` (U+06A9), never the Arabic `ي` (U+064A) or `ك` (U+0643). Wrong forms break Persian word shaping. |
| **Persian digits** | Dates, numbers, and sizes use Persian digits in the `fa` locale. Input is accepted in both Arabic and Latin digits and normalised to Persian on save. |

### 3.1 The digit question

Android's `NumberFormat` with `Locale("fa")` produces Persian digits by default
(`۱۲۳`). That is correct for display in a Persian locale.

For **input** — the note field, the folder name — the user may type Latin
digits. Both are stored as typed; only *displayed* values (counts, sizes,
dates) are converted. A user writing "قرارداد 1405" sees it exactly as they
typed it, while the date separators show `۱۴۰۵`.

---

## 4. Layout adjustments for RTL

Beyond `start`/`end`, a few things behave differently:

| Element | LTR | RTL |
|---------|-----|-----|
| Chat bubble | Right-aligned, tail on the right | Left-aligned, tail on the left |
| Unread badge | Top-right of the avatar | Top-left of the avatar |
| Progress bar | Fills left to right | Fills right to left (automatic) |
| Checkmark on a sent item | After the timestamp | Before it |
| Bottom sheet drag handle | Centred | Centred (unchanged) |
| Text field cursor | Left-aligned text, cursor at the left edge | Right-aligned text, cursor at the right edge (automatic) |
| Swipe-to-delete | Left swipe reveals actions | Right swipe reveals actions (automatic) |

**Bubble alignment** is the one that needs explicit code: in Compose, a
message bubble is aligned with `Arrangement.End`/`Arrangement.Start` relative
to the layout direction, and a `Row` with `horizontalArrangement` mirrors
automatically. The bubble tail icon must be an auto-mirrored variant.

**Swipe actions** are mirrored by `SwipeToDismissBox` automatically, but the
action icons and their order must be reversed for RTL so the destructive
action is on the side the user expects.

---

## 5. Testing localisation

| Test | How |
|------|-----|
| Every key in `values/strings.xml` exists in `values-fa/strings.xml` | A unit test that parses both XML files and diffs the key sets. Fails the build on a missing key. |
| No Persian string uses Arabic Yeh or Kaf | A unit test that scans `values-fa/strings.xml` for `ي` and `ك` and fails. |
| No inline user-facing strings | A lint check over the Kotlin sources for `Text("` with a literal. |
| Layout renders correctly in RTL | A screenshot test in Robolectric with `Locale("fa")`, compared against the LTR baseline. |
| Numbers and dates | Unit tests asserting the formatted output for `fa` and `en`. |
| Text scale at 200% in Persian | A screenshot test with the font scale forced to 2.0 — Persian's extra line height makes clipping more likely here than in English. |

The missing-key test is the important one. It is a single JUnit test, it
catches the most common localisation bug, and it costs almost nothing to run.

---

## 6. What the Persian UI changes about the product

Nothing structural. The information architecture, the navigation, and the
share flow are identical. The differences are:

- Every label is Persian by default.
- Dates use the Persian calendar when the device asks for it.
- The share picker says «ذخیره در» instead of «Save to».
- The file-size and count readouts use Persian digits.
- The layout mirrors.

The one place the localisation genuinely improves the product is the **date
handling**: the web app renders dates with `Intl.DateTimeFormat(undefined, …)`,
which follows the *browser's* locale — a Persian user's phone shows Persian
dates there, but the web app's own English UI strings remain English. The
Android app is fully localised, which is the correct behaviour for a Bazaar
release.
