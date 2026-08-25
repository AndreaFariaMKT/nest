# When a post does not go out

Last reviewed: 2026-08-25

---

## Where to look

**Scheduling.** It is the only screen that shows failures. Direction and
Management have it in the menu; the **Social media role does not** — if you
are the one publishing and cannot see that screen, ask someone who can for the
link.

The module's **Publishing** screen now shows "Did not go out" and the error on
the piece, but Scheduling is where the whole queue lives, including what has
already run.

## What each state means

| State | Means |
|---|---|
| **Waiting** | queued, its time has not come |
| **Sending** | the cron is trying now |
| **Published** | it went out |
| **Did not go out** | tried three times and gave up. Only this is a failure |

**"Waiting" forever** is not a failure — it is a piece the cron skipped every
time, usually for want of a connected account. The error column is blank
because there was never an attempt.

## Reading the error

The text in the Problem column comes from the platform. The prefixes:

- `account_...` — a problem with the client's account, not the piece.
  `account_no_account` (never connected), `account_not_enabled` (switched off),
  `account_no_secret` (no token), `account_secret_unreadable` (the token will
  not decrypt — see below).
- `ig_api:` / `li_api:` / `tt_api:` — the platform refused. The number after is
  theirs. `ig_api:190` is usually an expired token.

## Fixing and requeueing

1. Resolve what the error names — usually reconnecting the account in
   **Social Media → Publishing accounts**.
2. Go back to **Social Media → Publishing** and **Build the order** again.

The piece rejoins the queue.

## Two traps

**`account_secret_unreadable` on everything at once.** That is not the client's
account — it is the server's encryption key (`SOCIAL_SECRET_KEY`) having
changed. Every stored token becomes unreadable at the same moment, and each
account has to be reconnected.

**TikTok in "inbox" mode.** The system records it as published, but the video
sits as a draft inside TikTok waiting for someone to finish it. Published in
Nest does not mean published on TikTok.

## An AI button that does nothing

If an AI button in the content engine does not respond, the screen now names
which step failed and says nothing was changed. It is almost always the
Anthropic key — expired, absent, or rate-limited.

## The error log

**Administration → Error log** (Direction only). Keeps what broke, with a short
`NST-XXXXXX` code to quote.

It records screen errors and publishing failures. **It does not record
everything** — most server-side errors still go only to the Vercel logs.
