# Who sees what

Last reviewed: 2026-08-25

The role is chosen at invite time and decides everything: the menu, which
screens are reachable, and what the person can move on a piece. **You cannot
find this out from the UI before choosing** — which is why this page exists.

---

## The eight roles

| Role | Sees | In the social module can |
|---|---|---|
| **Direction** | everything | approve the text before anything is drawn; coordinate; publish |
| **Management** | nearly everything, minus Commercial and System | coordinate and publish — **cannot** approve text |
| **Social media** | content and clients | coordinate and publish |
| **Design · social** | their own work | draw. No backlog, fortnight, publishing or shared logins |
| **Design · identity** | identity projects | **nothing** — cannot open the module |
| **Development** | website builds | **nothing** |
| **Accounting** | Finance and Administration | **nothing** |
| **Client** | only their own portal | read and approve their pieces |

## The distinction that matters most

**Direction and Management look identical and are not.** They see the same
screens. One thing separates them: **only Direction approves the text** before
a piece goes into design.

That is the cheapest point in the flow to change your mind — nothing has been
drawn yet. Give someone Management and they write and coordinate, but the text
still stops with you.

## The choice with public consequences

**Publishing accounts** is the only screen that requires coordination on its
own. Whoever opens it decides **what the system publishes as** on a client's
real account. Getting it wrong is public and permanent.

Direction, Management and Social media have it. Design does not.

## What the system does not do

**There is no remove-member button.** Revoking access today needs SQL or the
Supabase dashboard. If someone leaves the studio, that has to happen outside
the app — not using it is not the same as losing access.

**Assigning the "Client" role from the Team screen does not work.** It creates
the tenant membership but links the person to no client, and they land in an
empty portal. To give a client a portal, use the Client portal card on their
page — see [new-client.md](new-client.md).

## "View as"

At the foot of the sidebar, Direction can see the app as any role.

Three things to know:

1. **It genuinely hides screens.** Forget you are viewing as Design · social
   and you will think features disappeared.
2. **It lasts 24 hours**, in a cookie. Closing the browser does not clear it.
3. **Viewing as Client** shows the **first client alphabetically** — you
   cannot pick which. The portal carries an amber band naming whose it is.
   Read it before answering anyone's question with that screen in front of you.

With the sidebar collapsed, the amber badge in the footer ends the preview in
one click.
