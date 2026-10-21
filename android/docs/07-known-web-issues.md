# 07 — Known Web-App Issues (Not to Be Inherited)

Every item below was found by reading the web app's source in this repository.
They are catalogued so the Android client does not reproduce them, and so that
a future web-app fix is a deliberate, informed change rather than an accident.

**Status legend:** `open` = still present in the web app · `fixed` = fixed in
the web app · `n/a` = the Android client does not have this code path at all.

---

### W1 — The upload progress bar never moves

**Status:** `open` · **Web file:** `components/ChatApp.tsx`

`uploadProgress` is declared and rendered, but `setUploadProgress` is **never
called** — the grep across the whole file returns only the declaration and the
`useState` initialiser. The progress bar therefore stays at `null` and the
user sees no feedback during a long upload.

**In the Android app:** the share flow shows a real determinate progress bar
driven by bytes copied, and the copy runs *before* the user confirms, so the
wait is visible while they are still choosing a folder. See
[04-ingestion.md](04-ingestion.md) §5.

---

### W2 — The mobile bottom navigation is non-functional

**Status:** `open` · **Web file:** `components/ChatApp.tsx` (the `mobileNavTab`
state and the `tg-mobile-bottom-nav` block)

`mobileNavTab` is set to `"chats"`, `"search"`, `"saved"`, or `"settings"`, but
the state value is **only read to pick the active CSS class**. The actual
content of the list panel is never switched on it. Consequences:

- "Search" merely focuses the search input and highlights the tab.
- "Saved" highlights the tab and **shows nothing** — the saved messages are
  unreachable.
- "Chats" highlights the tab and shows the chat list, regardless of what was
  selected before.

The mobile navigation bar looks interactive and does nothing.

**In the Android app:** the bottom bar drives real navigation between four
destinations, each with its own screen. See [05-ui-ux.md](05-ui-ux.md) §2.1.

---

### W3 — Uploading a chat avatar creates a spurious message

**Status:** `open` · **Web files:** `components/ChatApp.tsx`
(`uploadChatAvatar`), `app/api/upload/route.ts`

`uploadChatAvatar` posts the image to `/api/upload` **without a `chatId`**, so
the server defaults it to `"default"`. The endpoint then calls
`createFileMessage(...)` and **broadcasts a `created` event**. The result: the
avatar image appears as a message in the Saved Messages chat, on every client
that is connected. The avatar URL is reused, so the image is stored once but
listed as a message.

**In the Android app:** avatars are set directly on the folder row; there is no
separate "upload" endpoint and no message is created. See
[03-local-data.md](03-local-data.md) §1.1.

---

### W4 — The reply indicator is cosmetic

**Status:** `open` · **Web files:** `components/ChatApp.tsx`,
`types/store.ts`, `app/api/messages/route.ts`

The UI shows a "Replying to X" bar above the composer, but:

- `POST /api/messages` only reads `content` and `chatId`; any reply reference
  is silently dropped.
- The `Message` type has no `replyToId` field, so there is nowhere to store it.
- `sendText` never reads `replyToMessage`.

The user sees a reply indicator, types a message, and the message arrives with
no trace of what it replied to.

**In the Android app:** there is no reply affordance in v1. A feature that
cannot work is worse than an absent feature.

---

### W5 — The media, links, and files panel is unreachable on mobile

**Status:** `open` · **Web file:** `app/globals.css`

The right-hand panel (Media / Links / Files tabs) is `display: none` below
780 px. On a phone, the content it holds — every image, every link, every
file in the chat — has **no other entry point**.

**In the Android app:** media has its own top-level screen, so it is *more*
reachable on a phone than on the web. See [05-ui-ux.md](05-ui-ux.md) §3.5.

---

### W6 — The PIN is stored in plaintext

**Status:** `open` · **Web file:** `components/ui/AppLockModal.tsx`

`localStorage.setItem("app-lock-pin", pin)` stores the PIN in cleartext, with
no salt, no hash, and no iteration. Anyone with access to the browser profile
reads the PIN directly. The lock is theatre.

**In the Android app:** the app does not implement a PIN at all. The optional
gate uses `BiometricPrompt` with a `DEVICE_CREDENTIAL` fallback, which is
hardware-backed on the device and involves the app storing nothing. See
[05-ui-ux.md](05-ui-ux.md) §3.6.

---

### W7 — The web app has no authentication

**Status:** `open` (by design) · **Web files:** every route in `app/api/`

Any device on the LAN can read every message and file, and can write to the
store. There is no token, no session, no origin check. This is a deliberate
choice for a trusted home network — but it means a guest on the wifi, or any
process on the network, has full access.

**In the Android app:** the issue does not arise, because the app holds no
network permission at all. The data never leaves the device except through an
explicit export the user performs.

---

### W8 — `DELETE /api/chats/{id}` is not atomic

**Status:** `open` · **Web file:** `lib/store.ts`

`deleteChat` writes `chats.json` and `messages.json` with
`Promise.all([...])`. Both writes are individually atomic, but the pair is
not: if the process dies between them, the chat is gone from one file and its
messages remain in the other — orphaned messages that no chat references, and
no way to recover them.

**In the Android app:** the equivalent operation is a single Room transaction
plus a cascade delete, so the two can never diverge. See
[03-local-data.md](03-local-data.md) §3.

---

### W9 — Downloading a file scans the entire message list

**Status:** `open` · **Web file:** `app/api/files/[filename]/route.ts`

To recover the original filename and MIME type, the endpoint calls
`getMessages()` — **the whole message list** — and then does a `find()` over
it. The result is sorted and copied on every call, so every file download
sorts the entire history. On a large archive this is O(n log n) per download.

**In the Android app:** the metadata is stored in the row next to the file, so
opening a file is a single indexed read.

---

### W10 — The upload endpoint buffers the whole file in memory

**Status:** `open` · **Web file:** `app/api/upload/route.ts`

`await req.formData()` parses the entire multipart body into memory before
anything is written to disk. A 100 MB upload therefore costs 100 MB of
server RAM, and the `Content-Length` check happens *before* parsing but the
actual bytes are still fully buffered. The subsequent streaming write to disk
does not prevent the buffering — it happens afterwards.

**In the Android app:** the app never uploads, and the import path streams
from the content URI straight to disk with a 64 KB buffer.

---

### W11 — The web app's service worker does not make it offline-capable

**Status:** `open` · **Web file:** `public/sw.js`

The service worker explicitly skips every `/api/` request:

```js
if (url.pathname.startsWith("/api/")) return;
```

The navigation request falls back to the cached `/` shell, so the app *launches*
offline — and then shows an empty list and an error toast, because no data
was ever cached. The web app is therefore **not** offline-capable in any
meaningful sense, despite the PWA install flow and the README's claim of
"offline support via the service worker".

**In the Android app:** offline is the only mode. There is no service worker,
no cache, and no network.

---

### W12 — Search is scoped to the active chat only

**Status:** `open` · **Web file:** `components/ChatApp.tsx` (`filteredMessages`)

The search filters `chatMessages`, which is already filtered to the active
chat. A user searching for "that PDF from last week" cannot find it unless
they already know which chat it is in — which is the opposite of what a search
is for.

**In the Android app:** search covers the entire archive, with a folder label
on every result. See [05-ui-ux.md](05-ui-ux.md) §3.4.

---

### W13 — Deletion is immediate and irreversible

**Status:** `open` · **Web file:** `components/ChatApp.tsx`

Deleting a message or a chat happens the instant the menu item is tapped.
There is no confirmation and no undo. A mis-tap permanently destroys data that
was not backed up anywhere.

**In the Android app:** deletion is deferred behind a 5-second undo snackbar,
and the row is only really removed when the window closes. See
[05-ui-ux.md](05-ui-ux.md) §4.1 and [03-local-data.md](03-local-data.md) §1.5.

---

### W14 — The message list is limited to 80 items with no server paging

**Status:** `open` · **Web file:** `components/ChatApp.tsx` (`visibleCount`)

The client keeps the 80 most recent messages in view and grows the window by
60 with a "Load earlier messages" button. Meanwhile the server has a cursor
pagination endpoint (`?limit=&before=`) that **the web app never calls** —
`GET /api/messages` is always fetched in full. So the app downloads the entire
history to display 80 messages.

**In the Android app:** the local database is the history. The list is a lazy
column over SQLite with an index on `(folder_id, created_at)`, and there is no
"load earlier" button because there is no limit to load around.

---

### W15 — The settings modal shows desktop-only shortcuts on a phone

**Status:** `open` · **Web file:** `components/ui/SettingsModal.tsx`

The Security section is followed by a "Keyboard Shortcuts" block listing
`Ctrl+K`, `/`, `Ctrl+,`, and `Esc`. On a phone, none of these exist. The
"Command Palette" is a desktop affordance with no phone equivalent, and
`/shortcuts` is not bound in `useKeyboardShortcuts` — the documented shortcut
does not even work on the web app.

**In the Android app:** the shortcut list is gone, and the space is used for
archive management, which is what a phone user actually needs.

---

### W16 — The composer uses a desktop interaction model

**Status:** `open` · **Web file:** `components/ChatApp.tsx`

The composer is a desktop pattern in several ways: the send button is a
separate round button to the right of a growing textarea, `Enter` sends and
`Shift+Enter` inserts a newline, and there is no send-on-newline setting. On
a phone the soft keyboard's "Enter" key is right there, and the round send
button competes with it for space.

**In the Android app:** the composer is a `TextField` with a trailing send
icon that enables when the text is non-blank. The IME action is "Send" and
sends on newline, matching what the user expects from every other messaging
app.

---

### W17 — The web app cannot be shared *to* from a file manager

**Status:** `n/a` (a platform difference, not a bug) · **Web file:** none

The web app has no `Content-Type` manifest and no registered share target, so
no other application can share a file into it. The only way to add content is
to use the web app's own upload UI.

**In the Android app:** the share target *is* the product. See
[04-ingestion.md](04-ingestion.md).

---

## Summary

| # | Issue | Severity | Android answer |
|---|-------|----------|----------------|
| W1 | Upload progress never updates | Medium | Real progress bar during the copy |
| W2 | Mobile bottom nav does nothing | **High** | Real navigation with four screens |
| W3 | Avatar upload creates a message | **High** | Avatars are set on the row, no endpoint |
| W4 | Reply indicator is cosmetic | Medium | No reply affordance |
| W5 | Media panel unreachable on mobile | **High** | A dedicated media screen |
| W6 | PIN stored in plaintext | **High** | OS-level device lock |
| W7 | No authentication | Low (by design) | No network at all |
| W8 | Chat delete is not atomic | Medium | Single transaction |
| W9 | File download scans all messages | Medium | Metadata stored in the row |
| W10 | Upload buffers the whole file | Medium | The app never uploads |
| W11 | Service worker does not cache the API | **High** | Offline is the only mode |
| W12 | Search is chat-scoped | Medium | Archive-wide search |
| W13 | Deletion is irreversible | Medium | 5-second undo |
| W14 | Full history fetched to show 80 messages | Medium | SQLite is the history |
| W15 | Desktop shortcuts shown on mobile | Low | Removed |
| W16 | Desktop composer model on mobile | Low | Native composer |
| W17 | Cannot receive a share | **High** | The share target is the product |

**Recommendation:** W2, W3, W5, W6, W11, and W17 are worth fixing in the web
app too — they are real defects, not opinions. They are out of scope for the
Android work, but each is a small, isolated change if you want them.
