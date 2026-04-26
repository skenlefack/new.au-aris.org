# AI Degraded Mode Audit

**Date:** 2026-04-25
**Scope:** Frontend UX behavior when the AI Orchestrator service is down or unreachable.

---

## 1. Component-Level Analysis

### 1.1 `AiHealthIndicator.tsx`

**Location:** `apps/web/src/components/ai/AiHealthIndicator.tsx`

**Behavior:**
- Calls `useAiHealth()` which polls `/api/v1/ai/health` every 60 seconds.
- Displays a colored dot on the Sparkles icon in the header:
  - Green (`bg-emerald-500`) when `status === 'ok'`
  - Amber (`bg-amber-500`) when `status === 'degraded'`
  - Red (`bg-red-500`) when `isError`, no data, or `status === 'down'`
- Tooltip on hover/click shows status text and Ollama connection info.

**UX Level:** EXCELLENT
- The indicator correctly falls back to "down" (red dot) when the API returns an error or is unreachable.
- The `useAiHealth` hook catches errors and returns `{ status: 'down' }` so the component never crashes.
- Polling every 60s with `staleTime: 30s` and `retry: 0` avoids excessive retries when down.

**No action needed.**

---

### 1.2 `useAiHealth()` in `ai-hooks.ts`

**Location:** `apps/web/src/lib/api/ai-hooks.ts` (lines 72-86)

**Behavior:**
- `retry: 0` -- does not retry on failure, preventing cascading calls to a dead service.
- `staleTime: 30_000` -- caches result for 30 seconds.
- `refetchInterval: 60_000` -- re-checks health every minute.
- On error (network failure, 404, 500, timeout), the `catch` block returns `{ data: { status: 'down' } }`, so `isError` on the query is `false` but the health status is correctly `'down'`.

**UX Level:** EXCELLENT
- Graceful fallback, no uncaught exceptions, no spinner stuck forever.

**Minor note:** Because the catch returns a fallback, `isError` on the React Query result is always `false`. The `AiHealthIndicator` also checks `!health && !isError` as a fallback to `isDown`, which handles the initial loading state correctly.

**No action needed.**

---

### 1.3 `AiSuggestionDialog.tsx`

**Location:** `apps/web/src/components/ai/AiSuggestionDialog.tsx`

**Behavior when AI is down:**
1. User types a prompt and clicks "Generate with AI".
2. The mutation (`useSuggestForm`, etc.) calls the API endpoint.
3. The API call fails (network error, 404, 500).
4. `mutation.isError` becomes `true`.
5. An amber warning box appears: "AI unavailable" + "aiUnavailableHint" message.
6. A "Retry" button appears below the error message.
7. The user can close the dialog or retry.

**UX Level:** EXCELLENT
- Error state is clearly communicated with an amber warning (not a red crash).
- Retry button is available.
- The dialog remains functional (close button works, prompt is preserved).
- No infinite loading or stuck state.

**No action needed.**

---

## 2. Builder Pages -- "Suggest with AI" Button Audit

### 2.1 Form Builder (`/collecte/forms/new`)

**Location:** `apps/web/src/app/(dashboard)/collecte/forms/new/page.tsx` (line 147-153)

**Button behavior:**
- Always visible, always clickable, regardless of AI health status.
- `onClick={() => setAiDialogOpen(true)}` -- opens the AI suggestion dialog unconditionally.
- No check on `useAiHealth()` -- the hook is not imported in this page.

**UX Level:** ACCEPTABLE
- The button is always clickable, but clicking it opens the dialog where the user discovers the error only after submitting a prompt. This is a 2-step failure path (click button -> type prompt -> click generate -> see error).
- The error handling in `AiSuggestionDialog` is good enough that users are not confused, just mildly inconvenienced.

**Recommendation:** Consider disabling the button or showing a subtle "(offline)" badge when `useAiHealth` reports `down`. Low priority.

---

### 2.2 Campaign Builder (`/collecte/campaigns/new`)

**Location:** `apps/web/src/app/(dashboard)/collecte/campaigns/new/page.tsx` (lines 213-219)

**Button behavior:**
- Identical pattern: always visible, always clickable, no AI health check.
- `onClick={() => setAiDialogOpen(true)}` -- unconditional.

**UX Level:** ACCEPTABLE
- Same 2-step failure path as the form builder.

**Recommendation:** Same as 2.1.

---

### 2.3 Indicator Builder (`/settings/indicators/new`)

**Location:** `apps/web/src/app/(dashboard)/settings/indicators/new/page.tsx` (lines 197-203)

**Button behavior:**
- Identical pattern: always visible, always clickable, no AI health check.
- `onClick={() => setAiDialogOpen(true)}` -- unconditional.

**UX Level:** ACCEPTABLE
- Same 2-step failure path.

**Recommendation:** Same as 2.1.

---

### 2.4 Dashboard Editor (`/dashboards/[id]/edit`)

**Location:** `apps/web/src/app/(dashboard)/dashboards/[id]/edit/page.tsx` (lines 177-183)

**Button behavior:**
- Identical pattern: always visible, always clickable, no AI health check.
- `onClick={() => setAiDialogOpen(true)}` -- unconditional.

**UX Level:** ACCEPTABLE
- Same 2-step failure path.

**Recommendation:** Same as 2.1.

---

## 3. Summary Table

| Component | AI Down Behavior | UX Level | Action |
|-----------|-----------------|----------|--------|
| `AiHealthIndicator` | Red dot + "AI Offline" tooltip | EXCELLENT | None |
| `useAiHealth()` hook | Returns `{ status: 'down' }`, no retry | EXCELLENT | None |
| `AiSuggestionDialog` | Amber warning + retry button on error | EXCELLENT | None |
| Form Builder button | Always visible + clickable | ACCEPTABLE | Low priority: disable/badge when down |
| Campaign Builder button | Always visible + clickable | ACCEPTABLE | Low priority: disable/badge when down |
| Indicator Builder button | Always visible + clickable | ACCEPTABLE | Low priority: disable/badge when down |
| Dashboard Editor button | Always visible + clickable | ACCEPTABLE | Low priority: disable/badge when down |

---

## 4. Recommendations (future improvement, not blocking)

1. **Add a shared `useIsAiAvailable()` hook** that reads from the existing `useAiHealth()` cache (queryKey `['ai', 'health']`) and returns a boolean. No additional network calls needed since `AiHealthIndicator` already polls.

2. **Conditionally style the "Suggest with AI" buttons** in all 4 builders:
   - When AI is down: reduce opacity to 50%, add a small red dot or "(offline)" text.
   - The button should remain clickable (not `disabled`) so users can still try, but the visual cue sets correct expectations.

3. **Pre-check in `AiSuggestionDialog`**: On dialog open, if the cached health is `down`, show the amber warning immediately instead of waiting for the user to type a prompt and click generate.

These are UX polish items. The current behavior is functional and does not break any workflow -- users can always complete their task manually without AI assistance.
