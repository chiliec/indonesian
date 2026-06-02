# Unified "Listen & Translate" quiz with in-poll audio — design spec

- **Date**: 2026-06-01
- **Status**: Approved (Approach A). Ready for implementation planning.
- **Author**: reconstructed from session SUMMARY.md (original doc was lost before commit; this restores it from the recorded design decisions and is reconciled against the current code).

> Reconstruction note: the previous session's summary claimed this spec was committed, but no file/commit/stash existed. The design content below is recovered from SUMMARY.md "Recent decisions" + "Context to resume" and verified against the code at `1b2a605`.

---

## 1. Problem & goal

The Anki-sourced vocabulary quiz currently exposes **four** loosely-related question types and plays audio as a **separate voice message** sent just before the poll. This produces two bubbles per question (a voice player, then the poll) and an inconsistent learner experience: sometimes you read, sometimes you listen, with no pedagogical ordering.

**Goal:** collapse the four types into three coherent *modes* with a clear default ("listen"), and embed the audio **directly inside the poll question** (one bubble, player above the options) using Telegram Bot API 10.0's `sendPoll` `media` parameter.

This is a UX + internal-model refactor. No new content, no new commands.

---

## 2. Current state (code at `1b2a605`)

- `src/services/quiz/types.ts`
  - `QuestionType = 'audio-en' | 'audio-id' | 'id-en' | 'en-id'`
  - `Question` carries `type`, `promptText`, optional `audioFile`, `options`, `correctIndex`, `explanation`.
- `src/services/quiz/QuestionFactory.ts`
  - `eligibleTypes(card)`: all four if the card has audio, else the two non-audio types.
  - `build(card, pool, opts)`: picks a **random** eligible type (or `opts.type` if eligible), assembles 3 distractors, clamps to Telegram poll limits.
- `src/services/QuizService.ts`
  - `start()` already loads a `prog: Map<cardId, QuizProgress>` for the session's cards and orders them by mastery (unseen → wrong → mastered). It then calls `build(card, cards)` with **no type or mastery hint**.
  - "mastered" is defined elsewhere (`moduleList`) as `(prog.get(id)?.correct ?? 0) > 0`.
- `src/handlers/quiz.ts`
  - `askQuestion()`: if `question.audioFile`, calls `sendQuizAudio()` (→ `api.sendVoice`) **then** `api.sendPoll(...)` — two messages.
  - `sendQuizAudio()`: cache lookup → `api.sendVoice(fileId)`, else upload `InputFile` via `sendVoice`, store the returned **voice** `file_id`.
- `src/db/audioCache.ts`
  - `AudioCache { audioFile, fileId }`, unique index on `audioFile`. **No `kind`.** Only caller is `quiz.ts`.
- grammY **1.43.0** already types `sendPoll`'s `media?: InputPollMedia` (union incl. `InputMediaAudio`). No dependency bump needed.

---

## 3. Approved design (Approach A)

### 3.1 Three modes

Collapse `QuestionType` to:

```ts
type QuestionType = 'listen' | 'produce' | 'text';
```

| Mode      | Stimulus                    | Options       | Prompt example                  | When chosen |
|-----------|-----------------------------|---------------|---------------------------------|-------------|
| `listen`  | **Audio in poll**, ID hidden | English        | "What does this mean?"          | Default whenever the card has audio |
| `produce` | English shown               | Indonesian     | `How do you say "<english>"?`   | ~1-in-5, only on **mastered** cards |
| `text`    | Indonesian text shown        | English        | `What does "<indonesian>" mean?`| Fallback when the card has **no audio** |

Mapping from the old types: `audio-en → listen`, `en-id → produce`, `id-en → text`, and **`audio-id` is dropped** (its "which word did you hear" framing is replaced by `listen` with English options).

### 3.2 Mode selection (in `QuestionFactory.build()`)

`build()` gains an `isMastered: boolean` input (via `BuildOpts`). Selection logic:

```
if !card.audio            → text
else if isMastered && roll(rng) < 1/5 → produce
else                      → listen
```

- `opts.type` (explicit override, used by tests) still wins when provided and valid for the card.
- The 1-in-5 `produce` roll uses the injected `rng` so tests are deterministic.

### 3.3 Who supplies `isMastered`

`QuizService.start()` already has the `prog` map. For each chosen card it passes:

```ts
build(card, cards, { isMastered: (prog.get(card.id)?.correct ?? 0) > 0 })
```

No new DB query.

### 3.4 In-poll audio

Replace the two-message flow in `askQuestion()` with a single `sendPoll` carrying `media`:

```ts
const media = question.audioFile
  ? { type: 'audio' as const, media: await resolveAudio(deps, question.audioFile) }
  : undefined;
await api.sendPoll(chatId, question.promptText, options, {
  type: 'quiz', correct_option_ids: [question.correctIndex],
  is_anonymous: false, explanation: question.explanation,
  ...(media ? { media } : {}),
});
```

- `resolveAudio` returns either a cached **audio** `file_id` (string) or a fresh `InputFile` read from `content/quiz/audio`.
- The separate `sendVoice` call and `sendQuizAudio` voice path are removed from the quiz flow.

### 3.5 Audio cache namespacing (voice vs audio `file_id`)

**Voice `file_id`s (from `sendVoice`) are NOT reusable as `InputMediaAudio`.** They are distinct media kinds. To avoid collisions and stale reuse:

- Add `kind: 'voice' | 'audio'` to `AudioCache`, **default `'voice'`**.
- Make the unique index compound: `{ audioFile, kind }`.
- `AudioCacheRepo.get/set` take an optional `kind` (default `'voice'`), so any future voice caller is unaffected and existing rows remain valid.
- The quiz flow uses `kind: 'audio'`.

> Existing cached rows have no `kind`; defaulting to `'voice'` keeps them addressable by the (currently nonexistent) voice path and prevents the quiz path from ever reading a voice `file_id` as audio.

---

## 4. Open question (flagged) — resolved

**English-only options for Russian-locale users.** The card dataset has only Indonesian + English; there are no Russian glosses. Options are therefore English regardless of UI locale — this is the **current behavior** and is intentionally **kept**. Russian users still get English chrome on options (the meaning side). No change.

---

## 5. Caveats & risks

- **Caching the audio `file_id`.** ~~Uncertain~~ **Resolved:** the `Message` returned by `sendPoll`-with-`media` exposes it at `message.poll.media?.audio?.file_id` (grammY 1.43 `Poll.media: PollMedia`, `PollMedia.audio: Audio`, `Audio.file_id`). So the quiz path caches the audio `file_id` under `kind:'audio'` after the first send and reuses it thereafter — no re-upload fallback needed for v1.
- **In-flight sessions at deploy.** `QuizSession.questions[].type` stores the type string. Old sessions hold `'audio-en'` etc. `toQuestion()` only passes `type` through; rendering uses the already-stored `promptText`/`options`/`audioFile`, so old in-flight sessions still render correctly. **No migration needed.**
- **Telegram poll limits** (question 300 / option 100 / explanation 200) are already clamped in `build()` and must remain clamped.

---

## 6. Touch list (for the plan)

1. `src/services/quiz/types.ts` — replace `QuestionType` enum; keep `Question` shape (still has optional `audioFile`).
2. `src/services/quiz/QuestionFactory.ts` — new `eligibleTypes`/mode selection; `BuildOpts.isMastered`; new `buildPrompt`/`answerOf` per mode; drop `audio-id`.
3. `src/services/QuizService.ts` — pass `isMastered` into `build()`.
4. `src/handlers/quiz.ts` — `askQuestion` attaches `media`, drops `sendVoice`/`sendQuizAudio`; add `resolveAudio`.
5. `src/db/audioCache.ts` — add `kind` (+ compound unique index), thread through `get`/`set`.
6. Tests — update `QuestionFactory`/`QuizService` specs for 3 modes + `isMastered` rolls; add/adjust audio-cache `kind` coverage. Keep 80/80 green.

---

## 7. Out of scope

- New content, decks, or commands.
- Re-upload fallback / pre-warm cache optimization (deferred follow-up).
- Fixture id-format cleanup, handler-level cache tests, transcode hardening (deferred follow-ups).
