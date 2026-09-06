# V1 Retirement Announcement — DRAFT (Comms Kit)

> **STATUS: DRAFT — pending owner review and final decisions.**
> **Nothing in this document has been sent to any user.**
> Fill every `[DATE]` and `[LINK]` placeholder before use. Purchase handling
> has been **decided** (see "DECIDED — V1 purchase handling" below); only the
> launch date remains open, and it is gated on the launch-candidate checklist,
> not a calendar wish.

---

## 1. What is happening (plain-language summary for internal alignment)

When iKHWEZI V2 launches on **[DATE]**, the V1 platform is retired.

- V1 **accounts** (profiles, followers, follows) do not carry over.
- V1 **uploaded content** (videos, stories, posts) does not carry over.
- V1 **livestream archives** (HLS recordings) do not carry over.
- Purchased **balances held in V1** (iKHWEZI coins / subscriptions) are
  retired with V1. **Decided handling:** re-registering with the same
  verified email/phone automatically credits
  min(V1 unspent balance, Stripe payments recorded) — or a 60-day refund
  path via support@ikhwezi.site. Details in the DECIDED section below.

What users need to do: **create a fresh account on V2** after launch using
their preferred email or phone number. Registration is quick, and V2 has
better performance, stability and creator monetization tooling.

---

## 2. Why (message basis — internal reference, not user copy)

V2 is a complete rebuild — new backend, new frontend, new streaming
architecture. Every V1 feature returns, with reliability fixes that V1
could not receive while users lived on it. Carrying V1 data across would
mean carrying V1's data-quality problems into a platform built
specifically to leave them behind.

**Tone rules for all variants below: premium, calm, no over-apologizing,
no fake urgency, no fear language.** State what happens, what to do, when.
We treat the user as an adult making one small action — not as a victim of
an outage.

**POPIA note (internal):** Because V1 accounts and content are deleted at
retirement, South African users' personal information is deleted with
them. Every channel variant below includes one short line about this that
reads as care and housekeeping, not legal boilerplate. Do not expand it
into legalese in user copy; the formal processing notice lives elsewhere
(see the platform privacy page [LINK]).

---

## 3. Channel variants

### (a) In-app banner (~45 words)

> **iKHWEZI V2 is coming on [DATE].**
> This version retires on that day — accounts and videos will not carry
> over. Create your new account when V2 launches. [LINK]
> Your old data will be deleted for good, keeping your info private.

 *(47 words. Pair with a persistent but dismissible banner; show from T-14.)*

### (b) Email (~180 words, plain text, warm, direct)

> **Subject: iKHWEZI V2 launches [DATE] — here's what that means for you**
>
> Hi [FIRST_NAME],
>
> iKHWEZI has been rebuilt from the ground up. On **[DATE]** we launch V2 —
> faster, more reliable, and built so creators can earn properly from their
> content.
>
> One thing to know: V2 is a clean start. Your V1 account, your uploads,
> and your livestream archives will not carry over, and V1 closes on
> **[DATE]**. When V2 goes live, simply create a new account with your
> email or phone number — it takes a minute.
>
> If you hold coins or a subscription on V1, we are handling that
> carefully: re-register with the same email or phone number and your
> paid coin balance is waiting for you — or email support@ikhwezi.site
> within 60 days of launch for a refund.
>
> When we retire V1, we delete your old personal information with it —
> part of keeping your data private under POPIA, not just a reset.
>
> Thank you for being part of V1. See you on V2.
>
> — The iKHWEZI Team
> [LINK] · You receive this because you have an iKHWEZI account.

 *(~172 words. One send at T-14; short resend reminder at T-72h with the
 subject "Reminder: iKHWEZI V2 launches in 3 days".)*

### (c) Push notification (~150 characters)

> **V1 closes [DATE].** Your account & videos won't carry over — create
> your new one when V2 launches. Old data deleted for your privacy.

 *(111 characters. Schedule at T-72h as reminder only — push is the last
 touch, not the first. Targeting: all installs with push tokens; users
 without tokens still get banner+email.)*

### (d) Play Store "What's new" listing copy (~500 characters)

> **iKHWEZI V2 — the rebuild is here.**
>
> Faster, more stable, and built for creators to earn from their content.
>
> * New engine — faster feeds, fewer dropped streams
> * Livestreaming and meetings with real voice & video
> * Creator earnings tools, all in one place
>
> **Important:** V2 is a clean slate. V1 accounts, uploads and livestream
> archives do not carry over — create your new account on launch day.
> Old personal info is deleted at retirement, keeping your data private
> under POPIA.
>
> [LINK]

 *(Store listing hard cap is 500 characters — the clean-text count for
 this draft is 480; re-count after filling [DATE]/[LINK]. The "clean
 slate" paragraph must stay — it is also discoverable by brand-new users,
 which is fair.)*

---

## 4. DECIDED — V1 purchase handling (authorized under the engineering-decision standard)

> Resolved 2026-09-06 by delegated authority. The options below are kept for
> the record; the bolded line is the operative decision.

- [x] **DECISION — Hybrid, grandfather-led:**
  - **Grandfather:** users who re-register on V2 with a **verified email or
    phone** matching a V1 account automatically receive a V2 coin credit of
    **min(V1 unspent wallet balance, total Stripe payments recorded for that
    account)**. The Stripe cap is the evidence boundary: free welcome coins
    and gift-chain leakage cannot pass through it; unspent *paid* balances
    carry over 1:1. If no Stripe record exists for an account (dev-mode
    topups, free coins only), the credit is 0 — nothing was collected.
  - **Refund window:** anyone who prefers money back over re-registering (or
    holds an unexpired subscription) emails **support@ikhwezi.site** within
    **60 days of launch**; handled per-case. After 60 days the liability
    window closes.
  - **Identity rule:** whoever can receive email/SMS at the V1 identifier
    owns the balance — identical to a password-reset trust level. Residual
    risk (abandoned email claimant disputes) accepted at V1 scale.
- [x] **Refund/support channel:** support@ikhwezi.site (in-app "Contact
  support" routes there).
- [x] **Privacy link:** https://ikhwezi.site/privacy (shipped page).
- [ ] **Launch date:** set only when the launch-candidate gate passes
  (Phases 2+3 complete, physical two-device A/V test green, Play Store
  review submitted). The T-14 comms clock starts at that gate — not from a
  calendar wish.
- [ ] **Push reachability check:** operational, run during the T-14 prep per
  the backup/wipe runbook Phase 2 (do not assume tokens exist).

---

## 5. Notes for use

- Placeholders: `[DATE]`, `[LINK]`, `[FIRST_NAME]` appear in the master
  copy; a send system must substitute them or the channel fails its look.
- This is a kit: (a) banner, (b) email, (c) push, and (d) store listing
  cover the plan, but the **operator checklist**
  (`v2-launch-backup-wipe-checklist.md`) controls when each actually
  goes out. Nothing sends without that checklist's GO gates.
- All variants must be re-reviewed against the **final decisions** above
  before any real send, and every `[DATE]`/`[LINK]` filled.
