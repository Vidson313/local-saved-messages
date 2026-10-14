# Local Saved Messages

A lightweight, self-hosted web app replicating Telegram's "Saved Messages" feature with real-time sync across devices on local networks.

## Tech Stack
- Framework: Next.js 15 (App Router), React 19, TypeScript 5
- Styling: Tailwind CSS 4
- Storage: Atomic JSON file persistence (`data/messages.json`, `data/chats.json`) with automated backup
- Real-Time: Server-Sent Events (SSE) with ring buffer and `Last-Event-ID` catch-up
- PWA: Service Worker + Web Manifest

## Verified Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start server: `npm start`
- Run test suite: `npm test`

## Project Structure
- `app/` - Next.js App Router pages, layout, and API routes
  - `app/api/messages/` - Message CRUD and cursor-based pagination
  - `app/api/chats/` - Chat CRUD endpoints
  - `app/api/events/` - Real-time SSE stream with replay buffer
  - `app/api/upload/` - Secure file upload with stream pipeline
  - `app/api/files/[filename]/` - Anti-XSS file serving with RFC 5987 download headers
- `components/` - React UI components (`ChatApp.tsx`, `components/ui/`)
- `hooks/` - Custom client hooks (`useRealtimeSync`, `useTheme`, `useKeyboardShortcuts`)
- `lib/` - Server libraries (`events.ts`, `store.ts`, `storage/atomic.ts`, `security/upload.ts`)
- `types/` - Shared TypeScript definitions (`types/store.ts`)
- `scripts/` - Automated test suites executed by `npm test`

## Code Conventions
- Keep files modular and focused (aim for under 500 lines)
- Never expose or commit secrets (`.env`, API tokens)
- Use strong typing and avoid `any`
- All code, comments, and commit messages in clean English

## Workflow
- **Start a task**: Run `gh issue view <n>`, then branch `<type>/<n>-<short-name>` (`fix/`, `feat/`, `refactor/`, `docs/`, `chore/`).
- **Finish a task**: Run `npm test && npm run build`, commit as `<type>: <message> (#<n>)`, and open a PR with `gh pr create` referencing `Fixes #<n>`. Never merge the PR.
- **Creating issues**: Use `gh issue create` with the right label, clear title, and a "definition of done" checklist for features.
- **Triage**:
  - "summarize bugs" = `gh issue list --label bug` grouped by urgency.
  - "what next?" = inspect `urgent` issues first, then suggest execution order.
- **Rules**:
  - 1 issue = 1 branch = 1 PR.
  - Never push directly to `main` or `master`.
  - Ask before deleting files, changing dependencies, or large refactorings.
  - Ask when a task or requirement is unclear.
