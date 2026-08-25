# Credentials: what expires, when, and how to renew it

Last reviewed: 2026-08-25

**Nothing in the system warns you that a credential is about to expire.** This
page is the warning. Put a recurring reminder in your calendar.

---

## The calendar

| What | Expires | Who renews | If it lapses |
|---|---|---|---|
| Instagram token, per client | **~60 days** | you | that client stops publishing |
| Meta long-lived token (metrics) | ~60 days | you | the report stops updating |
| Anthropic key | does not expire | — | but can hit a usage limit |
| Client portal token (shared link) | **90 days** | you | the link stops opening |
| Google (Calendar/Meet) | renews itself | — | — |
| `SOCIAL_SECRET_KEY` | does not expire | — | **change it and every stored token becomes unreadable** |

## Instagram token, per client

The most important and the fastest to expire.

It lives encrypted under **Social Media → Publishing accounts**, per client.
There is no expiry date on screen — only a "rotated on" field somebody types by
hand.

**In practice:** put a reminder 55 days after connecting, and reconnect.

Obtaining the token needs the Meta developer console and a terminal command
(`npm run meta:exchange`). That is developer work — ask.

## Meta long-lived token (metrics)

Different from the one above. This one belongs to the studio, not a client, and
feeds metrics collection only.

To renew, call the refresh route with the cron secret:

```
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-APP/api/cron/meta-refresh
```

The new token comes back **in the response**, field `accessToken`. Copy it into
`META_LONG_LIVED_TOKEN` in Vercel and redeploy.

> Until today the instruction was to find the token in the Vercel logs. **That
> never worked** — the system redacts any field with "token" in its name before
> writing. It now comes back in the response and is written nowhere.

## `SOCIAL_SECRET_KEY`

The key that encrypts client tokens. **Never change it without a plan.**
Changing it makes every stored token unreadable at once, and each client has to
be reconnected by hand.

If it is not configured on the server, nothing publishes and the system refuses
to store a new token — deliberately.

## What does not publish today

- **LinkedIn** — the code is ready; LinkedIn's own approval is not.
- **TikTok** — domain verification pending.

Only Instagram actually publishes today.

## If a key leaks

Rotate first, investigate after. Rotating costs two minutes.

- **Supabase `service_role`** — the serious one. It bypasses every protection
  in the database. Supabase → Settings → API Keys → Roll.
- **Anthropic key** — console.anthropic.com → disable and create a new one.
- Then update Vercel and redeploy.

**No credential belongs in the repository, in any document.** It has happened
twice: login passwords in `ROADMAP.md`, and keys pasted into chat.
