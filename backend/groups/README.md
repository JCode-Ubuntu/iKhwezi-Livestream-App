# Group Chat — iKHWEZI

Premium group chat for the iKHwezi platform. Lives **inside Messages** (no new
nav tabs). Telegram-level usability, Instagram-quality visuals, on-brand with
the Ultima design system.

## Layout

```
backend/groups/
  index.js        mount({ app, io, sequelize, User, DataTypes, Op, ... })
  models.js        Sequelize models (synced on boot)
  validation.js    input sanitization, profanity, paging, UUID
  permissions.js   role rank helpers (owner > admin > member)
  services.js      business logic + security boundary
  routes.js        REST under /api/groups
  socket.js        Socket.IO group handlers

frontend/src/
  services/groups.js                  REST client (buildGroupsApi(fetchWithAuth))
  components/groups/
    GroupAvatar.jsx                   auto mosaics (2=split, 3-4=grid, 5+=stacked)
    MemberPicker.jsx                  search + multi-select
    CreateGroupWizard.jsx             3-step wizard
    GroupMessageList.jsx               virtualized list
    GroupMessageItem.jsx               bubble + linkify + reactions
    GroupComposer.jsx                  text + media input
    ReactionTray.jsx                   long-press emoji tray
  components/messages/
    DmThread.jsx                       (extracted) 1:1 DM
    NewConversationModal.jsx           (extracted) user search
  pages/
    GroupChat.jsx                      group conversation
    GroupInfo.jsx                      info + member management
    Messages.jsx                       shell: filters + merged list + routing
  context/SocketContext.jsx            added group* socket helpers
```

## Mount (backend)

One line added to `backend/index.js`, right after the rate limiters and before
the auth routes:

```js
require('./groups').mount({
  app, io, sequelize, User, DataTypes, Op,
  authenticate, requireRegistered, interactionRateLimit, logAudit,
});
```

Nothing else in `index.js` changes. `sequelize.sync()` (already called in
`initialize()`) creates the group tables on boot.

## Data model

`Group`, `GroupMember` (role owner|admin|member, unique groupId+userId,
lastReadMessageId), `GroupMessage` (text|image|video|system),
`GroupMessageRead`, `GroupInvite` (pending|accepted|declined),
`GroupMute`, `GroupBan`, `GroupReaction` (unique messageId+userId → one
reaction per user per message, toggles).

Future hooks already in the schema:
- `Group.linkedCreatorId` — creator subscriber auto-add (VIP/Inner Circle).
- `Group.expiresAt` — watch-party temporary group auto-archive.

## REST

```
GET    /api/groups                              list current user's threads
POST   /api/groups                              create (multipart: avatar + fields)
GET    /api/groups/:id                          meta (member count, unread, last msg)
PATCH  /api/groups/:id                          update (admin/owner)
DELETE /api/groups/:id                          delete (owner)
GET    /api/groups/:id/members
GET    /api/groups/:id/messages?page=&limit=
POST   /api/groups/:id/messages                 text or multipart media
POST   /api/groups/:id/join
POST   /api/groups/:id/leave
POST   /api/groups/:id/invite                  { userId }
POST   /api/groups/:id/promote                  { userId, role: 'admin'|'member' }
POST   /api/groups/:id/remove                   { userId }
POST   /api/groups/:id/transfer                 { userId }
POST   /api/groups/:id/mute                     { muted }
POST   /api/groups/messages/:messageId/reaction { emoji }
```

All routes require a registered (non-guest) JWT. A user only ever sees groups
they are a member of — there is no public discovery, so group enumeration is
not possible.

## Socket.IO

Room: `group_<groupId>`. `socket.user` is populated by the existing
`io.use` auth middleware. Events:

- client → server: `group-join`, `group-leave`, `group-message`,
  `group-typing`, `group-read`, `group-reaction`
- server → client: `group-message`, `group-typing`, `group-read`,
  `group-reaction`, `group-member-added`, `group-member-removed`,
  `group-updated`, `group-deleted`

REST is the source of truth; the socket `group-message` handler also persists
so a client may use either. Recommended client flow: REST send (optimistic) +
listen on server→client events.

## Security

- JWT verification (existing `authenticate`).
- Membership validated on every read/write in the service layer.
- Role checks via `permissions.js` before mutations.
- Input sanitization + length limits (name 3–100, message 2000, desc 280).
- Profanity blocklist for name/description.
- Duplicate group name per owner rejected (409).
- Banned users cannot join/act; owner cannot leave without transferring.
- XSS: message text rendered via React (auto-escaped); link enrichment splits
  on a URL regex and renders `<a>` tags — no `dangerouslySetInnerHTML`.
- Rate limiting reuses the existing `interactionRateLimiter` on sends/reactions.
- Upload validation: avatar images ≤20MB; media images/video ≤100MB.

## Performance

- Message list: `content-visibility:auto` + `contain-intrinsic-size` on rows,
  render cap of 120 most-recent, top-sentinel paging via IntersectionObserver,
  `React.memo` rows. No new dependency.
- Optimistic send/reaction for instant feel.
- Auto-scroll only when already near the bottom (no history yank).

## Migration strategy

SQLite dev DB: no action needed — `sequelize.sync()` creates the tables on
next boot. The models use only standard Sequelize column types, so the same
definitions work against Postgres for a future move; in that case run
`sequelize.sync()` once or generate a migration with `sequelize-cli` from the
model definitions. No data migration from existing tables is required —
group tables are additive and reference `User.id` only.

## Creator economy (future)

When a user subscribes to a creator (`/api/users/:id/subscribe`), a hook can
findOrCreate a `Group` with `linkedCreatorId = creator.id` and add the
subscriber as a member; on expiry, remove them. The schema and service are
already shaped for this — only the subscription webhook wiring is needed.

## Watch parties (future)

A watch party can create a `Group` with `expiresAt` set; a scheduled job (or
on-read check) archives groups past their expiry. Not implemented beyond the
column.
