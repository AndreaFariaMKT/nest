# Using Nest

For the people who operate the system. Everything else in `docs/` is technical,
for whoever develops it.

- **[A new client, end to end](new-client.md)** — order matters, and the system
  does not warn you.
- **[Who sees what](who-sees-what.md)** — the eight roles, and what each can do.
- **[When a post does not go out](when-a-post-fails.md)** — where to look and
  how to read the error.
- **[Credentials](credentials.md)** — what expires, when, and how to renew it.
- **[What Nest tells people](what-nest-tells-people.md)** — and mostly, what it
  does not.

## What is deliberately not here

**How a fortnight works.** The module's own front page shows the rhythm with
the real dates of the week, and every refusal explains itself as it happens —
"add the folder link before sending; the client would get an approval request
with no artwork". A document would be a worse copy, and would go stale before
the screen did.

If you cannot tell why the system refused something, the sentence it showed is
the documentation. If that sentence was not enough, the sentence is the bug.

## The rule about which flow

**The social module is the official flow.** The content engine exists to turn a
meeting transcript into a carousel, and nothing else.

Approval links (`/a/...`) belong to the content engine. The system now refuses
to mint one for a social piece: such a link records the answer in a table no
module screen reads, so the client would approve and the piece would keep
waiting, until it was approved on silence as though they had never replied.
