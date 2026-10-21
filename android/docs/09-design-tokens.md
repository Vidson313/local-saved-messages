# 09 — Design Tokens

The tokens below are the single source of truth for the app's appearance. They
come from the Stitch design system, with the corrections recorded in
[10-stitch-review.md](10-stitch-review.md) applied.

**Nothing in the codebase may hard-code a colour or a size.** Everything
references `ui/theme/Color.kt`, `ui/theme/Type.kt` or `ui/theme/Theme.kt`.

---

## 1. Colour

### 1.1 Light

| Token | Hex | Used for |
|-------|-----|----------|
| `primary` | `#2481CC` | Actions, the active navigation item, the FAB, focus rings |
| `onPrimary` | `#FFFFFF` | Text and icons on `primary` |
| `primaryContainer` | `#D1E4FF` | The selected chip, the selected folder row |
| `onPrimaryContainer` | `#001D35` | Text on `primaryContainer` |
| `secondary` | `#2AABEE` | Secondary highlights, the search icon |
| `secondaryContainer` | `#C9E6FF` | The pinned strip, the match highlight in search results |
| `onSecondaryContainer` | `#004869` | Text on `secondaryContainer` |
| `tertiary` | `#4FAE52` | The item-count badge, positive states |
| `onTertiary` | `#FFFFFF` | Text on `tertiary` |
| `tertiaryContainer` | `#23862F` | The "unlocked" badge |
| `tertiaryFixed` | `#97F993` | The vault icon background, the notice background |
| `onTertiaryFixed` | `#002204` | Text on `tertiaryFixed` |
| `background` | `#F4F6F8` | The canvas behind every list |
| `surface` | `#FFFFFF` | Cards, list rows, the app bar |
| `surfaceContainerLow` | `#F0F4F7` | The search field, the inset icons |
| `surfaceContainer` | `#EAEEF1` | Inactive chips, the folder icon tiles |
| `surfaceContainerHigh` | `#E5E9EC` | The gallery tile, the type badge |
| `surfaceContainerHighest` | `#DFE3E6` | The innermost dividers |
| `onSurface` | `#171C1F` | Headings, file names, the note body |
| `onSurfaceVariant` | `#404751` | Timestamps, previews, helper text |
| `outline` | `#707882` | Placeholder text, empty-state icons |
| `outlineVariant` | `#C0C7D3` | Hairline dividers |
| `error` | `#BA1A1A` | Error text, the destructive action |
| `errorContainer` | `#FFDAD6` | The PDF icon tile, the delete icon tile |
| `onErrorContainer` | `#93000A` | Text on `errorContainer` |
| `inverseSurface` | `#2C3134` | The scrim behind a bottom sheet |

### 1.2 Dark

| Token | Hex |
|-------|-----|
| `primary` | `#6AB2F0` |
| `onPrimary` | `#00344F` |
| `primaryContainer` | `#005F9E` |
| `onPrimaryContainer` | `#D1E4FF` |
| `secondary` | `#6AB2F0` |
| `secondaryContainer` | `#006591` |
| `tertiary` | `#7BD87E` |
| `tertiaryContainer` | `#005313` |
| `background` | `#14181C` |
| `surface` | `#1C2126` |
| `surfaceContainerLow` | `#1C2126` |
| `surfaceContainer` | `#20262B` |
| `surfaceContainerHigh` | `#2A3136` |
| `surfaceContainerHighest` | `#353C41` |
| `onSurface` | `#E3E6E9` |
| `onSurfaceVariant` | `#C0C7D3` |
| `outline` | `#8A9199` |
| `outlineVariant` | `#404751` |
| `error` | `#FFB4AB` |
| `errorContainer` | `#93000A` |

### 1.3 Folder accents

Eight accents, chosen so that no two adjacent folders look alike and every
one keeps its contrast against both themes:

```
#2481CC  #4FAE52  #2AABEE  #E08A3C
#8B5CF6  #DB5C6B  #1FA8A0  #6B7280
```

A folder's accent is applied to its icon tile at 14% opacity, with the icon
itself drawn at full strength.

---

## 2. Typography

**Vazirmatn**, bundled in the app at four weights (Regular 400, Medium 500,
SemiBold 600, Bold 700). The app is offline and Persian is its primary
language, so the font cannot come from a download; bundling also means
Persian renders identically on every device.

| Token | Size | Line height | Weight | Used for |
|-------|------|-------------|--------|----------|
| `headlineLarge` | 22 sp | 32 sp | 700 | The empty-state headline |
| `titleLarge` | 20 sp | 28 sp | 700 | The folder name on a detail screen |
| `titleMedium` | 17 sp | 24 sp | 700 | The app-bar title |
| `titleSmall` | 15 sp | 22 sp | 600 | A folder or file name |
| `bodyLarge` | 15 sp | 24 sp | 400 | The note body |
| `bodyMedium` | 14 sp | 22 sp | 400 | Previews, descriptions, helper text |
| `bodySmall` | 12 sp | 18 sp | 400 | Timestamps, sizes, file types |
| `labelLarge` | 14 sp | 20 sp | 600 | Buttons, section labels |
| `labelMedium` | 12 sp | 16 sp | 600 | Filter chips |
| `labelSmall` | 11 sp | 14 sp | 500 | The count badge |

### 2.1 The Persian rules

- **Line heights are 1.45–1.6× the font size.** Persian glyphs have taller
  ascenders and deeper descenders than Latin ones; Latin defaults clip them.
- **Letter spacing is 0.** Some Persian fonts render poorly with tracking,
  and Compose's default is too tight for connected letterforms.
- **Line-height alignment is centred** rather than trimmed, so the extra
  Persian leading sits evenly above and below the text.
- **The font is bundled, not the system font**, so Persian renders the same
  everywhere. The system font size scale still applies.

---

## 3. Spacing

An 8 dp base grid with a 4 dp half-step.

| Token | Value | Used for |
|-------|-------|----------|
| `spaceXs` | 4 dp | Icon-to-label gaps |
| `spaceSm` | 8 dp | Chip gaps, list item internal gaps |
| `spaceMd` | 12 dp | Padding inside a list row |
| `spaceLg` | 16 dp | The screen margin, the card padding |
| `spaceXl` | 24 dp | Section separation |

The screen margin is a fixed 16 dp on both sides, so nothing presses against
a bezel.

---

## 4. Shape

| Token | Radius | Used for |
|-------|--------|----------|
| `extraSmall` | 4 dp | — |
| `small` | 8 dp | Small badges |
| `medium` | 12 dp | Input fields, search bars, icon tiles, list rows |
| `large` | 16 dp | Cards, the folder list rows |
| `extraLarge` | 24 dp | Bottom sheets, the media pager |

---

## 5. Elevation

**There is no elevation.** Depth comes from surface tone, hairline dividers
and spacing.

- The canvas is `background`; the cards are `surface`. That single step is
  what separates them.
- Dividers are `outlineVariant` at 50% opacity, 1 dp.
- The FAB uses a flat `primary` fill. It separates from the content beneath
  it by its colour, not by a shadow.
- The only exception in the whole app is a bottom sheet, which uses the
  system scrim (`inverseSurface` at 35%).

---

## 6. Icons

**Material Symbols**, mapped from the web app's Lucide set so the two apps
read as one product:

| Web (Lucide) | Android (Material Symbols) |
|---------------|------------------------------|
| `attach` | `AttachFile` |
| `send` | `Send` |
| `pin` / `unpin` | `PushPin` |
| `save` / `unsave` | `Bookmark` / `BookmarkAdd` |
| `folder` | `Folder` / `FolderOpen` |
| `search` | `Search` |
| `delete` | `Delete` |
| `share` | `Share` |
| `more-vert` | `MoreVert` |
| `edit` | `Edit` |
| `tag` | `Label` |
| `lock` | `Lock` / `LockOpen` |
| `settings` | `Settings` |
| `back` | `ArrowForward` (auto-mirrored) |
| `file` | `Description` |
| `image` | `Image` |
| `video` | `Movie` |
| `mic` | `Mic` |
| `play` | `PlayArrow` |

**Any icon with a direction must be an `AutoMirrored` variant.** The back
arrow, the chevron, the send arrow and the list arrow all mirror
automatically; the rest do not.

---

## 7. Motion

Short and purposeful. Nothing bounces.

| Interaction | Duration |
|-------------|----------|
| The list item press | Instant colour step, no ripple blur |
| The screen transition | The platform default |
| The FAB | Instant |
| The bottom sheet | The platform default |

Every animation respects the system "remove animations" setting.

---

## 8. The rule that catches the most mistakes

**Colour signals; it never decorates.**

- One blue, for actions.
- One green, for counts and positive state.
- One red, for destructive actions and errors.
- Nothing else carries a colour of its own.

A folder's accent is the single exception, and it exists so that a list of
fifteen folders stays scannable.
