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
