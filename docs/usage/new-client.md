# A new client, end to end

Last reviewed: 2026-08-25

Order matters in two places, and the system warns you at neither. Follow the
sequence.

---

## 1. Create the client

**Clients → New client.**

The create form has **no** social-module toggle and no posts-per-fortnight
field. Both exist only on the edit form. A new client is created with:

- the social module **on**
- **2 publications per fortnight**

If either is wrong for this client, step 2 is not optional.

## 2. Set up the module — even when it looks unnecessary

**Clients → the client → Edit.**

Here are the two settings the create form hid. Confirm:

- **Social module**: on or off.
- **Publications per fortnight**: how many pieces this client gets each
  fortnight. It is the number the shelf measures against — "two fortnights of
  stock" means twice this.

> Blank the field and save, and it silently resets to 2.

**Two common mistakes:**

Attaching the "Social Media" **service** on the services card does **not**
switch the module on. They are unrelated: the service is commercial, the
module is operational.

A client with the module off does **not** appear in the Publishing accounts
dropdown, with nothing on screen explaining why.

## 3. Give them portal access

**Clients → the client → Client portal card → Client's email → Send invite.**

They get an email to set a password. After that they see their own portal:
text, artwork, approvals, calendar, report and meetings. Nothing internal.

**What they never see**, even when it exists on the piece: notes for design,
notes for publishing, design feedback, and the reason a piece went back to the
shelf. They also never see pieces in backlog, writing, with direction, in
design, or internally rejected — a client never learns that a piece about them
was refused inside the studio.

**The shared link below is not equivalent.** It shows scheduled and published
posts, and cannot approve any social-module piece. Whoever uses it also gets
**no daily digest**. Use the invite.

## 4. Connect the publishing account

**Social Media → Publishing accounts.** (Coordination only.)

Without a connected, enabled account **nothing publishes on its own**. The
piece joins the queue, the cron tries, and it is marked "Did not go out".

In practice today **only Instagram publishes**. LinkedIn is waiting on
LinkedIn's own approval, and TikTok on domain verification.

See [credentials.md](credentials.md) for how to obtain the token.

## 5. Stock the shelf

**Social Media → Backlog → Add a theme.**

A theme needs a title and a **"Why this, now"** — the system refuses without
it. That field is the only one that survives all the way to the client: it is
what they read when the piece reaches them.

Fill until the bar passes **two fortnights**. Below that the client's card
turns amber; below one, red.

A client with no pieces at all shows **grey**, not red — that is the normal
state of someone who just arrived.

---

## Checking your work

After the five steps, the client should show a green or grey dot on the
module's overview, and:

- their login should open a portal with empty-but-present screens, not the
  "not linked yet" box;
- they should appear in the Publishing accounts selector;
- the backlog should have stock.

If their portal says "not linked yet", the invite did not complete. Send it
again.
