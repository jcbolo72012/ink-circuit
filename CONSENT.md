# Ink Circuit — consent copy

Draft for review. Placeholders in `[brackets]` must be filled before launch.
An IRB will likely add or reword sections; the structure below is designed so
that additions land in the "Full details" page rather than the first screen,
which needs to stay short enough that people actually read it.

Voice notes: sentence case, plain verbs, no filler, no "we value your privacy."
It should read like the rest of the game — understated and direct. It is not a
cookie banner and should not look like one.

---

## 1. First-visit screen

Shown once, before the first lap. Not after a run, and never per-run: consent
collected after a result is correlated with how good that result was, which
biases the sample in a way no analysis can undo.

> ### Before you drive
>
> Ink Circuit is part of a small research project comparing how people and
> machine-learning agents learn to drive circuits they've never seen.
>
> Your lap gets saved either way — that's how one attempt a day works. The
> question is whether we may also use it for research.
>
> If you say yes, we keep the circuit number, your lap time, how many walls you
> touched, and a recording of the arrow keys you pressed. No name, no email, no
> account — just a random ID kept in this browser.
>
> This covers your practice laps too, not just the one that counts.
>
> You can change your mind at any time from the link at the bottom of the page.
>
> **[ Use my laps for research ]**  **[ Just let me play ]**
>
> You need to be 18 or over to take part. Saying no changes nothing about the
> game.
>
> [What this means in full]

Notes on specific choices:

- "a recording of the arrow keys you pressed" — the input stream is a complete
  replay of the lap, and calling it "gameplay data" would understate that.
- "Your lap gets saved either way" — separating storage from research use is
  the sentence most likely to keep trust. Blurring it is what makes people feel
  tricked later.
- "Saying no changes nothing about the game" — has to be true. No nagging, no
  degraded features, no asking again.

---

## 2. Full details

Linked from the first screen and from the footer. Reachable without consenting.

> ### What we collect and why
>
> **What this is**
> A research project run by [name] at [institution or "independently"],
> comparing how people and reinforcement-learning agents drive circuits neither
> has seen before. Every player gets the same circuit on the same day, which
> makes those comparisons possible.
>
> **What we keep if you opt in**
> - The circuit number and the physics version it was driven under
> - Your lap time and the number of walls you touched
> - The sequence of arrow presses that produced the lap — roughly 400 entries
>   for a seven-second run, enough to replay it exactly
> - A random ID, so laps from the same person can be grouped across days
> - Rough device information: touch or keyboard, screen shape, refresh rate,
>   because those affect how a car handles
>
> **Practice laps count too**
> Once your daily attempt is done you can practise the same circuit as often as
> you like. Those laps are never shared and never affect your daily result, but
> if you have opted in we keep them the same way — time, contacts, and the
> arrow presses. They are marked as practice so they are never mixed up with
> the attempt that counted.
>
> They matter more than the daily lap for the research: one attempt a day is a
> very thin signal, whereas a practice session shows how someone learns a
> circuit over repeated tries, which is the thing we are actually studying.
> Only the most recent laps are kept on your device.
>
> **What we don't keep**
> No name, email, address book, or account. Nothing that identifies you. We
> never ask for anything personal, so there is nothing personal to lose.
>
> Our host keeps standard server logs, including IP addresses, the same as any
> website. We don't connect those to your laps.
>
> **What it's for**
> Comparing human laps against a trained agent on identical circuits; measuring
> whether wider tracks change how quickly people find a fast line; and studying
> what makes a circuit hard for a person but easy for a machine, or the reverse.
>
> **Who sees it**
> [Name] and any named collaborators. Findings are reported in aggregate — no
> individual is singled out. We may publish the anonymised dataset so others can
> check or build on the results. It would contain lap times, contact counts and
> input recordings under random IDs, and nothing else.
>
> **How long we keep it**
> Indefinitely, unless you withdraw.
>
> **Risks**
> Minimal. Lap times aren't sensitive information. The main risk with any stored
> data is a breach, which is why we don't hold anything that identifies you.
>
> **Changing your mind**
> Use the research link at the bottom of the page. Turning it off stops future
> laps being used and deletes the ones already collected.
>
> One honest limitation: your random ID lives in this browser. If you clear your
> browser data or switch device, we have no way to find your laps and therefore
> no way to delete them. They stay in the dataset, still unconnected to you.
> If that bothers you, decline now rather than later.
>
> **Taking part is optional**
> You can play forever without opting in, and you can stop at any time. Nothing
> about the game changes either way.
>
> **Questions**
> [email address]
> [If applicable: This study was approved by [IRB name], protocol [number]. For
> questions about your rights as a participant, contact [IRB contact].]

---

## 3. Microcopy

**Footer link (always visible)**
`Research: on` / `Research: off`

Stating the current value rather than "Research settings" means someone can
check their status without opening anything.

**Confirmation after opting in**
> Thanks — your laps are included from here on. You can turn this off any time.

**Confirmation after declining**
> No problem. Your laps stay on your device and won't be used for research.

**Turning it off later**
> ### Turn off research use?
>
> Your laps already collected will be deleted, and future ones won't be
> included. You'll keep playing exactly as now.
>
> **[ Turn it off and delete my laps ]**  **[ Keep it on ]**

**After withdrawal**
> Done. Your laps have been deleted and nothing further will be collected.

**If the delete request fails**
> We couldn't reach the server to delete your laps. Nothing has been removed
> yet — try again, or email [address] and we'll do it by hand.

Never report a deletion that hasn't happened.

---

## 4. The feature flag

`RESEARCH_ENABLED` at the top of the page script gates all of this. While it is
`false` the game never mentions research: no consent card, no footer link, and
no `research` field on a stored lap. Laps are still saved, because that is what
makes one attempt a day real rather than an honour system.

**Laps recorded while the flag is off cannot be added to the dataset later.**
They were collected without consent, and consent cannot be applied backwards.
The absence of a `research` field is the marker for that — treat it as
disqualifying, not as missing data to be filled in.

When you flip it on, returning players get the consent card on their next visit
that they haven't already played, which is the correct moment: before a lap,
never after one.

---

## 5. Things to settle before launch

- **Age.** 18+ is written above because research with minors needs parental
  consent, which is impractical here. A public game will still attract under-18s
  — an unenforceable checkbox is the normal compromise, but say so as a
  limitation in any writeup rather than pretending the sample is clean.
- **Ethics approval first.** Retroactive approval is often refused, so laps
  collected before approval can be unpublishable even though everyone consented.
  Sort this before the first player arrives, not before submission.
- **Public dataset.** Only promise release if you mean it, and only say it here,
  before collection. It cannot be added to the terms afterwards.
- **Practice mode.** Practice laps are logged when consent is on, and both the
  first screen and the details page now say so. Keep it that way if the storage
  behaviour changes — people will assume "one lap a day" means one recording a
  day, and finding out otherwise after the fact is exactly what destroys trust.
