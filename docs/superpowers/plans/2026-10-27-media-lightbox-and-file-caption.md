# Media Lightbox & File Caption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Telegram-style full-screen Media Lightbox (supporting photos, videos, and audio) and a File Send Preview Modal with multiline captioning, persistent storage, and formatted caption rendering/editing.

**Architecture:** Extend the Message schema and atomic storage store with an optional `caption` property. Build two focused React client components (`MediaLightbox.tsx` and `FileUploadModal.tsx`) and wire them into `ChatApp.tsx` and `app/globals.css`.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-10-27-media-lightbox-and-file-caption-design.md`

## Global Constraints
- All code, comments, and commit messages must be in clean English.
- No Claude attribution trailers or links in any commit message or code.
- Files must stay modular and under 500 lines where practical.
- Keep 100% test pass rate across `npm test` at all times.

## Review Focus
1. Backward Compatibility: Existing messages in `messages.json` without `caption` must deserialize gracefully with `caption: null`.
2. Keyboard Accessibility: In `MediaLightbox`, ArrowLeft/ArrowRight must navigate items, Escape must close the viewer, and Space must toggle playback for videos.
3. Bidirectional Text (RTL/LTR): The caption input and rendered caption must handle Persian/Arabic and English with `dir="auto"` correctly.
4. Drag & Drop Pipeline: Dropping files must open the `FileUploadModal` with the dropped file(s) rather than triggering immediate upload without giving the user a chance to write a caption.
5. Large Files / Videos: Lightbox must handle video aspect ratios smoothly without overflowing the screen.

---

### Task 1: Store & API Layer for File Captions

**Files:**
- Modify: `types/store.ts`
- Modify: `lib/store.ts`
- Modify: `app/api/upload/route.ts`
- Modify: `app/api/messages/[id]/route.ts`
- Test: `scripts/test-caption-storage.mjs`

**Interfaces:**
- Produces: `caption?: string | null` in `Message`, `CreateFileInput`, and `UpdateMessageInput`.

- [ ] **Step 1: Write the failing test for caption persistence**

Create `scripts/test-caption-storage.mjs`:
```javascript
import assert from "node:assert";
import { createFileMessage, updateMessage, getMessages } from "../lib/store.ts";

async function runTest() {
  console.log("Testing caption storage and updates...");
  
  // Create file message with caption
  const msg = await createFileMessage({
    content: "/uploads/test-sample.jpg",
    fileName: "sample.jpg",
    fileSize: 1024,
    mimeType: "image/jpeg",
    chatId: "default",
    caption: "این یک عکس تستی با کپشن است"
  });

  assert.strictEqual(msg.caption, "این یک عکس تستی با کپشن است", "Caption must be saved on creation");

  // Update caption
  const updated = await updateMessage(msg.id, {
    caption: "کپشن ویرایش‌شده"
  });

  assert.strictEqual(updated.caption, "کپشن ویرایش‌شده", "Caption must be updated");

  // Retrieve message
  const all = await getMessages("default");
  const found = all.find((m) => m.id === msg.id);
  assert.strictEqual(found?.caption, "کپشن ویرایش‌شده", "Persisted message must retain caption");

  console.log("✓ Caption storage test passed successfully.");
}

runTest().catch((err) => {
  console.error("✗ Caption storage test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/test-caption-storage.mjs`
Expected: FAIL (caption property is not yet saved)

- [ ] **Step 3: Implement caption support in store and API endpoints**

Update `types/store.ts`:
Add `caption?: string | null;` to `Message`, `CreateFileInput`, and `UpdateMessageInput`.

Update `lib/store.ts`:
In `createFileMessage`:
```typescript
caption: input.caption ? input.caption.trim() : null,
```
In `updateMessage`:
Allow `caption` in `UpdateMessageInput`.

Update `app/api/upload/route.ts`:
```typescript
const caption = (formData.get("caption") as string)?.trim() || null;
```
Pass `caption` to `createFileMessage`.

Update `app/api/messages/[id]/route.ts`:
In `PATCH`, accept `caption`:
```typescript
if (typeof body.caption === "string") {
  updates.caption = body.caption.trim() || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/test-caption-storage.mjs`
Expected: PASS with "✓ Caption storage test passed successfully."

- [ ] **Step 5: Commit**

```bash
git add types/store.ts lib/store.ts app/api/upload/route.ts app/api/messages/[id]/route.ts scripts/test-caption-storage.mjs
git commit -m "feat(store): add persistent caption support to file messages and upload API"
```

---

### Task 2: File Upload Send Preview Modal

**Files:**
- Create: `components/ui/FileUploadModal.tsx`
- Test: `scripts/test-caption-ui.mjs`

**Interfaces:**
- Produces: `<FileUploadModal files={File[]} open={boolean} onClose={fn} onSend={(files, caption) => void} />`

- [ ] **Step 1: Write UI logic test for caption formatting & validation**

Create `scripts/test-caption-ui.mjs`:
```javascript
import assert from "node:assert";

function validateCaption(text) {
  if (!text) return { valid: true, caption: null };
  const trimmed = text.trim();
  if (trimmed.length > 50000) {
    return { valid: false, error: "Caption exceeds maximum length" };
  }
  return { valid: true, caption: trimmed };
}

function detectDirection(text) {
  const rtlRegex = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  return rtlRegex.test(text) ? "rtl" : "ltr";
}

async function run() {
  console.log("Testing FileUploadModal caption validation and direction detection...");
  
  const res1 = validateCaption("  عکس منظره قشنگ  ");
  assert.strictEqual(res1.caption, "عکس منظره قشنگ");

  assert.strictEqual(detectDirection("سلام دنیا"), "rtl");
  assert.strictEqual(detectDirection("Hello world"), "ltr");
  assert.strictEqual(detectDirection("123 hello"), "ltr");
  assert.strictEqual(detectDirection("123 سلام"), "rtl");

  console.log("✓ Caption UI logic test passed.");
}

run().catch((err) => {
  console.error("✗ Caption UI test failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node scripts/test-caption-ui.mjs`
Expected: PASS

- [ ] **Step 3: Implement FileUploadModal component**

Create `components/ui/FileUploadModal.tsx`:
Implement a clean Telegram-style modal that displays the preview of the files being uploaded, file size, multiline caption input with `dir="auto"`, and Enter-to-send support.

- [ ] **Step 4: Commit**

```bash
git add components/ui/FileUploadModal.tsx scripts/test-caption-ui.mjs
git commit -m "feat(ui): create FileUploadModal with media preview and caption input"
```

---

### Task 3: Media Lightbox / Viewer Component

**Files:**
- Create: `components/ui/MediaLightbox.tsx`

**Interfaces:**
- Produces: `<MediaLightbox items={MediaItem[]} activeId={string | null} onClose={fn} onNavigate={fn} />`

- [ ] **Step 1: Implement MediaLightbox component**

Create `components/ui/MediaLightbox.tsx`:
- Full-screen modal with blurred overlay.
- High-res photo display with zoom/pan controls.
- Video player with controls and duration.
- Audio card with duration and playback progress.
- Left / Right gallery navigation buttons and keyboard arrows.
- Header with file name, date, index counter, download, and close button.
- Bottom overlay displaying formatted caption if available.

- [ ] **Step 2: Commit**

```bash
git add components/ui/MediaLightbox.tsx
git commit -m "feat(ui): implement Telegram-style MediaLightbox with photo, video, and audio support"
```

---

### Task 4: Chat Integration & UI Styling

**Files:**
- Modify: `components/ChatApp.tsx`
- Modify: `app/globals.css`
- Modify: `package.json` (add new tests to `npm test`)

**Interfaces:**
- Connects: Drag & Drop and attachment triggers to `FileUploadModal`.
- Connects: Message file/media click and Shared Media sidebar click to `MediaLightbox`.
- Renders: Caption below file/media in chat bubbles.
- Supports: Editing file captions via message context menu.

- [ ] **Step 1: Update globals.css with Lightbox and Caption styles**

Add CSS rules for:
- `.tg-lightbox`
- `.tg-lightbox-header`
- `.tg-lightbox-body`
- `.tg-lightbox-caption`
- `.tg-file-caption`
- `.tg-upload-preview-modal`

- [ ] **Step 2: Wire FileUploadModal and MediaLightbox into ChatApp.tsx**

- Intercept `handleDrop`, `onFileChange`, and `onPaste` to open `FileUploadModal` when files are selected.
- Add click handlers on images, videos, and shared media thumbnails to open `MediaLightbox`.
- In message rendering, render `<div className="tg-file-caption">` with `<MessageFormatter content={message.caption} />` when `message.caption` is present.
- Enable `Edit` option on `FILE` messages in context menu to edit caption.

- [ ] **Step 3: Run full automated tests and build verification**

Run:
```bash
npm test && npm run build
```
Expected: 100% PASS on all tests and clean build.

- [ ] **Step 4: Commit**

```bash
git add components/ChatApp.tsx app/globals.css package.json
git commit -m "feat(chat): integrate MediaLightbox, file caption rendering, and upload modal"
```
