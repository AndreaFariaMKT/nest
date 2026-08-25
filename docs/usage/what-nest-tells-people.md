# What Nest tells people, and what it does not

Last reviewed: 2026-08-25

The short rule: **the system notifies inside itself. It does not send email.**

---

| Event | Who finds out | How |
|---|---|---|
| Piece sent to the client | the client | bell inside the portal, in the daily digest |
| Client approves or asks for changes | whoever wrote the piece | bell inside the app |
| A post did not go out | **nobody** | only by opening Scheduling |
| A credential is expiring | **nobody** | only the calendar reminder you create |
| Backlog running thin | whoever opens the module | amber dot on the overview |
| A reply date passed | whoever opens the module | red pill on the piece |
| Team or portal invite | the invited person | **email** (the only one that leaves) |

## The consequence that matters

**A client who does not open the portal never learns a piece is waiting.** The
daily digest is an in-app notification — no visit, no sight of it.

And the module's rule is that **silence approves**: five working days later the
piece publishes as it stood. That is deliberate, and the portal explains it to
the client. But it means an absent client approves everything.

If a client is the sort who never logs in, agree another channel with them. The
system will not solve that for you.

## The shared link tells them nothing

A client using the link instead of a login **gets no digest at all** and
**cannot approve any social-module piece**. They see scheduled and published
posts, and that is all.

Use the login invite wherever you can.

## The emails that do leave

Two: the team invite and the portal invite. Both go through Supabase's default
mail service, which is **heavily rate-limited**. If an invite does not arrive,
that is the first suspect — and the screen says "invite sent" either way.
