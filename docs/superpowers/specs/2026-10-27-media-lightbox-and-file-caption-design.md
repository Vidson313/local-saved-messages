# Telegram-Style Media Lightbox & File Caption Design Spec

## 1. Executive Summary
This specification defines the architectural design, data models, APIs, and UI/UX implementation for two major Telegram-style features in Local Saved Messages:
1. **Media Lightbox / Viewer**: An immersive, full-screen media viewer for photos, videos, and audio files with zooming, keyboard navigation, download capabilities, and seamless integration with both chat bubbles and the shared media sidebar.
2. **File Caption & Send Preview**: A Telegram-style send preview modal with caption input for files and media (uploaded via Drag & Drop, attach button, or clipboard paste), persistent caption storage in messages, formatted caption rendering with Markdown/spoilers/links, and caption editing capability.

---

## 2. Feature 1: Media Lightbox / Viewer (`components/ui/MediaLightbox.tsx`)

### 2.1 Core Capabilities
- **Full-Screen Immersion**: Modal layer over the entire app with a darkened, blurred backdrop (`background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(12px)`).
- **Multi-Media Support**:
  - **Photos**: Responsive aspect ratio scaling, smooth zoom in/out controls (+ / - / Reset / Scroll), pan support, and high-resolution rendering.
  - **Videos**: Centered full-size video player with timeline scrubber, volume control, play/pause, time display, and native browser fullscreen option.
  - **Audio**: Dedicated Telegram-style media card featuring an audio disc/waveform graphic, track name, file size, download link, and playback scrubber.
- **Sequential Gallery Navigation**:
  - Automatically identifies all media items (images, videos, audio) in the current active chat.
  - Next / Previous buttons with hover indicators.
  - Keyboard shortcuts: `ArrowRight` (Next), `ArrowLeft` (Previous), `Escape` (Close), `+` / `-` / `0` (Zoom In / Out / Reset), `Space` (Play / Pause).
  - Item counter display (e.g., `3 of 12`).
- **Media Information & Action Bar**:
  - Top header displaying file name, date/time sent, item counter, zoom buttons, direct download button, and close button.
  - Bottom bar displaying the item's caption (if present), formatted cleanly over a semi-transparent pill.
- **Integration Touchpoints**:
  - Clicking any image, video, or audio player in chat messages opens the Lightbox focused on that item.
  - Clicking any thumbnail in the right sidebar's **Shared Media** tab opens the Lightbox focused on that item.

---

## 3. Feature 2: File Captioning & Send Preview Modal

### 3.1 Data Model & Persistence Architecture
- **`types/store.ts`**:
  - Update `Message`: add optional field `caption?: string | null`.
  - Update `CreateFileInput`: add optional field `caption?: string | null`.
  - Update `UpdateMessageInput`: add optional field `caption?: string | null`.
- **`lib/store.ts`**:
  - In `createFileMessage`: assign `caption: input.caption ? input.caption.trim() : null`.
  - In `updateMessage`: allow updating `caption` independently or alongside tags/content.
- **`app/api/upload/route.ts`**:
  - Extract `formData.get("caption") as string | null`.
  - Pass `caption` to `createFileMessage`.
  - Broadcast new message with `caption` over SSE.
- **`app/api/messages/[id]/route.ts`**:
  - In `PATCH`, accept `caption` in request body (`body.caption`), trim and validate string length up to `MAX_MESSAGE_LENGTH`.

### 3.2 UI/UX: File Send Preview Modal (`components/ui/FileUploadModal.tsx`)
- **Trigger**:
  - Dropping files via Drag & Drop on the window.
  - Selecting file(s) via the paperclip / attach button.
  - Pasting image/file data from clipboard (`Ctrl + V`).
- **Modal Structure**:
  - Header: File count and cancel button.
  - Center: Preview area:
    - If image/video: scaled thumbnail preview with resolution and size badge.
    - If document/archive/audio: Telegram file card icon with original file name and formatted byte size.
  - Input: Multiline caption input (`textarea`) with:
    - Placeholder: `Add a caption...`
    - Dynamic auto-direction (`dir="auto"`) supporting Persian/Arabic (RTL) and English/Latin (LTR).
    - Keyboard handling: `Enter` sends the file with caption; `Shift + Enter` inserts a newline; `Escape` cancels.
  - Footer: "Cancel" button and primary "Send" button with Telegram icon.

### 3.3 Message Bubble Rendering & Editing
- **Message Rendering (`components/ChatApp.tsx`)**:
  - Inside `.tg-file-message`:
    - File heading / preview component.
    - If `message.caption` exists, render below the preview:
      ```tsx
      <div className="tg-file-caption" dir="auto">
        <MessageFormatter content={message.caption} searchNeedle={searchNeedle} />
      </div>
      ```
    - Full support for markdown bold/italic, code blocks, links, spoilers, and search needle highlighting.
- **Editing Existing Captions**:
  - In message context menu, enable the **Edit** action for `FILE` messages.
  - When editing a `FILE` message, the composer enters edit mode with the message's current caption text.
  - Saving the edit updates `caption` via `PATCH /api/messages/[id]`.

---

## 4. CSS & Styling Enhancements (`app/globals.css`)
- **`.tg-lightbox`**: Fixed viewport overlay (`z-index: 2000`) with high-depth shadows and smooth zoom animations.
- **`.tg-file-caption`**: Styled caption block underneath media with appropriate padding, font size, and text color matching Telegram's bubble aesthetics.
- **`.tg-file-upload-modal`**: Compact Telegram-style preview card with responsive max dimensions.

---

## 5. Verification & Testing Strategy
1. **Unit & Integration Tests**:
   - Update `scripts/test-storage.mjs`: Test storing, retrieving, and updating messages with `caption`.
   - Update `scripts/test-ux-components.mjs`: Validate caption Markdown parsing, spoiler detection, and RTL direction.
   - Run full test suite (`npm test`) ensuring 100% pass rate.
2. **Build Verification**:
   - `npm run build` must compile cleanly with zero errors.
   - Electron asset preparation and packaging must remain functional.
