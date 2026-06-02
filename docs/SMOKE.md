# Smoke test checklist

Run after `docker compose up -d`.

## Flow A — happy path (free user)
- [ ] `/start` → welcome message in en
- [ ] `/lang` → switch to ru → confirmation in ru
- [ ] `/scenarios` → list shows 8 scenarios
- [ ] Pick `ojek-to-canggu` → opener "Halo! Mau ke mana, bos?" arrives
- [ ] Reply with text "Mau ke Canggu" → driver replies in Indonesian
- [ ] Tap "Correct me" → recap arrives with ❌/✅ lines
- [ ] Send voice "berapa harganya" → transcript echoes back + character voice reply
- [ ] `/end` → "Scenario ended after N turns"

## Flow B — quota
- [ ] First scenario start of UTC day → allowed
- [ ] Second scenario start same UTC day → "Free limit reached" + /subscribe hint
- [ ] Wait until next UTC day (or set system clock) → allowed again

## Flow C — payment
- [ ] `/subscribe` → invoice card appears
- [ ] Complete Stars payment → "Subscription active" confirmation
- [ ] Start 2nd scenario same day → allowed (no quota gate)
- [ ] Set `subscriptionPeriodEnd` in DB to past → within 15 min, user back on free tier

## Flow D — admin
- [ ] `/stats` from non-admin → no response
- [ ] `/stats` from admin → table with counts

## Quiz
- [ ] `/quiz` lists 8 modules (plus 🎲 Mixed) with mastery %.
- [ ] Picking a module sends a single quiz poll with the audio player **inside** the poll question (one bubble — no separate voice message). Options are English; the Indonesian word is hidden ("listen" mode).
- [ ] Answering reveals ✓/✗ + explanation and the next question appears.
- [ ] After 10 questions a summary shows score + missed words + retry buttons.
- [ ] Re-answering the same audio clip reuses the cached file_id, no re-upload (`db.audio_cache.find({ kind: 'audio' })` has rows).
- [ ] A card with no audio shows the Indonesian word as text with English options ("text" mode).
- [ ] A mastered card occasionally appears as "How do you say …?" with Indonesian options and no audio (~1-in-5, "produce" mode).

> Note: on an existing DB, drop the legacy index first — `db.audio_cache.dropIndex('audioFile_1')` — so the new `{audioFile, kind}` index can store per-kind file_ids.
