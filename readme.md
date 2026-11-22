# KD Space

![Version](https://img.shields.io/badge/version-1.0.0-00e5ff?style=flat-square)
![Three.js](https://img.shields.io/badge/Three.js-0.130-000000?style=flat-square&logo=three.js)
![Webpack](https://img.shields.io/badge/Webpack-5-8DD6F9?style=flat-square&logo=webpack)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-Deployed-F38020?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/license-UNLICENSED-ff453a?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

A creative 3D room/space exploration built with **Three.js** — featuring a **Studio Mode** for uploading, editing, and composing 3D objects in real time.

> **Live:** [kd-space-v2.pages.dev](https://kd-space-v2.pages.dev)  
> **Source:** [github.com/ctaxnagomi/kd-space](https://github.com/ctaxnagomi/kd-space)

The older [kd-space.pages.dev](https://kd-space.pages.dev) still exists but is
hosted in a different Cloudflare account and serves a stale build. The current
build is deployed to **kd-space-v2.pages.dev** in the
`Wan.mohd.azizi.seggaf@gmail.com` account. Deployment is a manual direct upload
of `dist/` (the Cloudflare Pages GitHub app is not installed on this repo, so
there is no automatic Git build yet). To refresh it: `npm run build`, zip the
**contents** of `dist/` with forward-slash paths, then upload the zip as a new
production deployment in the Cloudflare Pages project.

---

## Vision & Roadmap

KD Space is more than a 3D room — it's a **social metaverse gateway** for the KD community. Every KD member is entitled to their own personal KD Space — a custom 3D room they can decorate, modify, and call their own.

### Objectives

- **Personal KD Spaces** — Every member gets their own 3D room with unique identity and layout
- **Real-Time Presence** — Visit other members' spaces and see who's online / offline in real time
- **Peer Messaging** — Seamless messaging between members inside any KD Space via WebRTC
- **Social Evolution** — Gradually evolve from 3D chat rooms into a lightweight social game layer
- **Tally Integration** — Connect with [jalanmalaysia.com](https://kl.jalanmalaysia.com) as a partner platform for cross-experience engagement

### The Journey

```
     ┌─────────────────────────────────────────────────┐
     │               KD Space Ecosystem                │
     ├─────────────────────────────────────────────────┤
     │                                                 │
     │  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
     │  │   Your   │    │  Their   │    │   The    │   │
     │  │ KD Space │◄──►│ KD Space │◄──►│  Square  │   │
     │  │          │    │          │    │(Coming)  │   │
     │  └──────────┘    └──────────┘    └──────────┘   │
     │       │               │               │          │
     │       ▼               ▼               ▼          │
     │  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
     │  │  Decorate│    │  Visit   │    │  Events  │   │
     │  │  Upload  │    │  Chat    │    │  Social  │   │
     │  │  Studio  │    │  Online  │    │  Games   │   │
     │  └──────────┘    └──────────┘    └──────────┘   │
     │                                                 │
     └─────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Checkpoint → Enter │
              │   Your KD Space     │
              └─────────────────────┘
```

### Social layer plan

The social layer is **local-first**. Share links already work with no backend,
so identity and space ownership are scaffolded in browser storage first;
presence and messaging attach to those same ids when a signalling service exists.

| Phase | Feature | Status | Depends on |
|-------|---------|--------|------------|
| 0 | Guest identity + space metadata in `localStorage` | **Done** | — |
| 1 | Profile chip and display-name/color editing in the room | **Done** | Phase 0 |
| 2 | Named spaces via short `?space=` id + ownership claim | **Done** | Phase 1 |
| 3 | Presence — who is online in a space (local-first) | **Done** | Phase 2 |
| 4 | Peer messaging over a WebRTC data channel (local-first) | **Done** | Phase 3 |
| 5 | Tally / KrackedDevs cross-experience handoff | Planned | Partner API |

Phase 0 stores two records. Neither is a credential and neither leaves the browser:

```js
// kd-space-identity-v1
{ id: 'uuid', name: 'KD-AB12', color: '#00e5ff', guest: true, createdAt: '…' }

// kd-space-space-v1
{
  currentId: 'a1b2c3d4',
  spaces: {
    a1b2c3d4: { id: 'a1b2c3d4', ownerId: '<identity.id>',
                name: 'My KD Space', createdAt: '…' }
  }
}
```

The old single-space record is migrated into this registry on first load.
`window.experience.social` exposes `getIdentity()`, `getSpace()`, `getSpaces()`,
`getSpaceLink()`, `setDisplayName()`, `setColor()`, `renameSpace()` and
`claimSpace()`. `claimSpace()` is reserved for the moment a signed-in identity
replaces the local guest — today it simply re-stamps the owner id.

**Phase 1** adds a **You** chip pinned to the bottom-left of the room. It shows
your display name and a color dot; click it to open a popover with a name field
and six color swatches. Changes save instantly through the Social module and
survive a reload. The chip is driven by `src/Experience/ProfileChip.js`.

**Phase 2** adds named spaces. Every space has an 8-character short id and is
addressed by a `?space=<id>` query parameter (e.g.
`https://kd-space-v2.pages.dev/?space=a1b2c3d4`). The URL is kept in sync as you
browse, so the address bar is always a shareable link; **Copy Space Link** in the
chip popover copies a clean one. Opening a link for an unknown id claims it for
the current guest; opening a link for a space owned by a different local
identity opens it read-only (**Visiting**) with the name field disabled.
Renaming is owner-only and all state remains in `localStorage` — ownership is a
local convention, not real authentication, until a backend introduces sign-in.

**Phase 3** adds presence. A `Presence` instance joins a BroadcastChannel scoped
to the current space id, announces itself with `hello`, answers newcomers with
`ping`, heartbeats every 4s and expires silent peers after 12s. Tabs in the same
browser on the same space see each other; `pagehide` broadcasts `bye` for fast
leave detection, and a `localStorage` storage-event fallback covers older
browsers. The widget above the profile chip shows a live count, stacked color
dots and a **In this space** list. Each tab gets its own session id, so multiple
tabs sharing one local identity appear as separate presences.

This is deliberately limited to one browser — presence is local-first and no
data leaves the device. The transport is isolated behind `send()`/`receive()`
and `onChange()`, so phase 4 can swap in a hosted signalling service without
touching the UI or the peer model.

**Phase 4** adds peer-to-peer chat. `Presence.publish()` / `onSignal()` carry
SDP offers, answers and ICE candidates over the same space-scoped channel. The
peer with the lexicographically smaller session id always offers, which avoids
simultaneous-offer glare. Each pair gets a real `RTCPeerConnection` with a
`kd-chat` data channel; no STUN/TURN is needed because same-browser tabs connect
over host candidates. The **Chat** button top-left opens a slide-in panel with
a live connection count and a composer. Peers are torn down as soon as presence
reports a tab leaving. Swapping `onSignal()`/`publish()` for a hosted service is
the only change needed to take chat cross-device.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              KD Space Ecosystem                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│        ┌─────────────────────────────────┐          │
│        │   Checkpoint → Enter KD Space   │          │
│        └──────────┬──────────────────────┘          │
│                   ▼                                 │
│  ┌──────────────┬──────────────────────────────────┐│
│  │   Normal Mode│  Studio Mode                    ││
│  │  ┌─────────┐ │  ┌──────────┐ ┌───────────┐     ││
│  │  │  Room  │ │  │ Upload   │ │ Transform │     ││
│  │  │  Tour  │ │  │ GLB/GLTF │ │ Controls  │     ││
│  │  │        │ │  └──────────┘ └───────────┘     ││
│  │  │  Baked │ │  ┌──────────┐ ┌─────────────┐   ││
│  │  │  Scene │ │  │Primitives│ │ Object List │   ││
│  │  │        │ │  │Box/Sphere│ │Sel / Remove │   ││
│  │  │ Bounce │ │  │Cyl/Plane │ └─────────────┘   ││
│  │  │  Logo  │ │  └──────────┘                    ││
│  │  └─────────┘ │  ┌────────────────┐              ││
│  │              │  │  OrbitControls│              ││
│  │              │  │  + Grid + LIght              ││
│  │              │  └────────────────┘              ││
│  └──────────────┴──────────────────────────────────┘│
│                   │                                 │
│                   ▼                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  Social Layer (Future)                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Visit    │ │ Chat     │ │ Tally        │  │  │
│  │  │ Spaces   │ │ WebRTC   │ │ Integration  │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Studio Mode Flow

```
User clicks "Studio" ──► Panel slides in from left
       │
       ├── Upload GLB/GLTF ──► Auto-scale to fit (max dim = 2 units)
       │                        Auto-center at origin
       │                        Add to object list
       │
       ├── Add Primitive ──► Cube / Sphere / Cylinder / Plane
       │                      Placed at origin with default material
       │
       ├── Add Prop ──► Desk Plant / Desk Lamp (Blender-made GLBs)
       │                 Placed at origin; editable with transform gizmos
       │
       ├── Wall Portrait ──► Framed photo on the back wall behind the desk
       │                     (static texture in /assets/portrait.jpg)
       │
       ├── Objects ──► Starts with every scene object (room, props;
       │               lights excluded) as the default catalog
       │    ├── Select ──► TransformControls attach
       │    │               Move / Rotate / Scale gizmo
       │    └── Remove ──► Deletes from scene & list
       │
       ├── Save Layout ──► Stores object kinds, transforms and
       │                   embedded uploaded GLBs in localStorage
       │
       ├── Load Layout ──► Rebuilds the saved arrangement
       │                   (layouts also auto-restore on page reload)
       │
       ├── Copy Share Link ──► Encodes the arrangement in the URL hash
       │                       (built-in props + primitives only)
       │
       ├── Screens ──► Per-screen mode: Local video / YouTube / Live site / Off
       │               YouTube URL + site URL fields, saved in localStorage
       │               "Open KrackedDevs" launches the community site externally
       │
       ├── Reset Layout ──► After confirmation, clears the saved layout and
       │                    share hash, then restores the default scene
       │
       └── OrbitControls ──► Free camera navigation
```

### Live screens & interaction

The **monitor** and **laptop** screens are interactive. Hovering any Studio
object or screen adds a subtle cyan glow, a pointer cursor and a small tooltip;
clicking a screen opens a docked, navigable panel on the right.

Each screen has its own mode selector in Studio Mode:

| Mode | What it shows |
|------|---------------|
| Local video | The original looping MP4 texture (default look) |
| YouTube | A real autoplaying, muted iframe overlaid on the 3D screen, with play/pause and mute buttons stacked down its right edge |
| Live site | An embeddable site iframe overlaid on the 3D screen |
| Off | Blank screen |

The monitor defaults to **Live site** (`https://example.com`) and the laptop
defaults to **YouTube**. The YouTube field accepts any watch URL, `youtu.be`
link or raw 11-character id. Clicking a screen in YouTube or Live site mode
opens the right-side panel (with address bar, Go, Open-externally and Close);
drag it by the header or resize it from the bottom-right corner, then navigate
without leaving the room. The panel mirrors its current address onto the screen
it was opened from while it is open, so navigating in the panel updates the 3D
screen too; closing the panel restores the screen's configured mode. In
**Live site** mode a navigation also becomes the screen's saved home URL.
Settings persist in `kd-space-screen-settings-v1`.

> Mirror tracking follows the panel's address bar and **Go** button. Browsers do
> not expose a cross-origin iframe's URL to the parent page, so clicking a link
> *inside* the panel iframe cannot be mirrored.

**Live projection:** clicking a screen opens the panel and asks to capture this
browser tab. Accept the browser's share picker (choose **This tab**) and
`ScreenCapture.js` crops the capture to the panel iframe's rectangle on every
frame and paints it onto the 3D screen — scrolling, clicks, video and animation
inside the panel all appear live on the monitor. The **Project ▣ / Stop ▣**
button in the panel header toggles it; closing the panel or stopping sharing
restores the normal iframe. A window or whole-screen capture is projected in
full instead of cropped. Nothing is uploaded or recorded; the stream stays in
the page and ends when you stop sharing.

**Real-time scroll mirroring:** an embedded page can opt into a small
`postMessage` protocol so scrolling the panel scrolls the 3D screen in real
time. `ScrollSync.js` registers both frames, sends a `kd-scroll:init` message
with each frame's role, and relays `kd-scroll:report` positions to the other
frame as `kd-scroll:apply`. The embed script is in
`docs/scroll-relay.html` — paste it before `</body>` in the embedded site's
HTML. It is already required on **deckergui.my**, which is the substituted
site for blocked hosts. Sites without the script keep URL-only mirroring; no
scroll data leaves the browser and nothing is stored.

> **krackeddevs.com** sends `X-Frame-Options: DENY` and
> `frame-ancestors 'none'`, so browsers refuse to embed it. Its URL is kept in
> the Studio field and the **Open KrackedDevs ↗** button still launches the
> community site externally, but any site on the known-blocked list (GitHub,
> X, Facebook, etc.) is automatically substituted with **https://deckergui.my**
> inside the frame — so the screens and panel always show working content
> instead of a blank "can't connect" error. The panel title shows the
> substitution (e.g. `krackeddevs.com → deckergui.my`).

### Shareable spaces

**Copy Share Link** encodes the current Studio arrangement into the URL hash
(`#space=...`). Opening that link rebuilds the same scene in another browser —
no backend or account needed. A shared link takes priority over the local saved
layout. Uploaded GLBs are excluded from links because embedding their file data
would make URLs unusable; the status line tells you how many were skipped.

Only changes from the default scene are stored: removed scene objects, moved or
resized ones, and added objects. An untouched room therefore produces a link a
few hundred bytes long instead of listing all 28 objects. Saving a layout
clears an old share hash so it cannot override the newer saved layout.

**Reset Layout** asks for confirmation, then removes the browser save and any
share hash and rebuilds the default 28-object scene — a clean starting point
after experimenting with a shared space.

---

## Content

- [Setup](#setup)
- [Contributing](#contributing)
- [Credits](#credits)

---

## Setup

Download [Node.js](https://nodejs.org/en/download/).  
Run this followed commands:

```bash
# Install dependencies (only the first time)
npm install

# Run the local server at localhost:8080
npm run dev

# Build for production in the dist/ directory
npm run build
```

> **Note for Node.js 22+:** The legacy webpack config requires `NODE_OPTIONS=--openssl-legacy-provider`.  
> Use the provided build command or set the env var manually.

---

## Contributing

We welcome contributions! Please follow the standard fork-and-PR workflow:

1. **Fork** the repository
2. Create a new branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Commit (`git commit -m "Add my feature"`)
5. Push (`git push origin feature/my-feature`)
6. Open a **Pull Request**

### PR Requirements

- Use the [Pull Request template](.github/PULL_REQUEST_TEMPLATE.md)
- Test on desktop **and** mobile/tablet
- If adding Studio Mode features, test with a real `.glb` upload
- Run `npm run build` before submitting — confirm no errors
- Add screenshots for UI changes

### Issue Templates

- [Bug Report](https://github.com/ctaxnagomi/kd-space/issues/new?template=bug-report.yml)
- [Feature Request](https://github.com/ctaxnagomi/kd-space/issues/new?template=feature-request.yml)

### Integrating DGUI HyperMem MCP

For contributors building **Studio Mode extensions**, this project integrates with **[DGUI HyperMem MCP](https://github.com/ctaxnagomi/dgui-hypermem)** — a memory-augmented agent framework that persists context across sessions.

If you want to extend Studio Mode with stateful features, use the HyperMem MCP to store and retrieve:

- **World state** — object positions, scales, materials, and scene layout across reloads
- **GLB metadata** — uploaded model names, file references, and transform histories
- **Studio extensions** — register custom tools, panels, or behaviors that persist

**Quick guideline for HyperMem integration:**

```js
// Example: persisting a placed object's state
const memory = {
  type: "studio-state",
  object: {
    name: "my-uploaded-model",
    position: { x: 1.2, y: 0.5, z: -0.3 },
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    rotation: { x: 0, y: 1.57, z: 0 },
    source: "user-upload"
  }
};

// Store via HyperMem MCP
await hypermem.add({
  content: JSON.stringify(memory),
  scope: "kd-space-studio",
  type: "project"
});
```

When building extensions:
- Use the `scope: "kd-space-studio"` namespace for all KD Space memories
- Tag entries with `"studio-worldstate"`, `"studio-glb"`, or `"studio-extension"` for easy filtering
- Query with `hypermem.search({ query, scope: "kd-space-studio" })` to restore previous state

---

## Credits

### Required Attribution

If you **fork**, **clone**, or **use this project** in any way, you **must** retain credit to:

| Credit | Link |
|--------|------|
| **KrackedDevs** | [www.krackeddevs.com](https://www.krackeddevs.com) |
| **Bruno Simon** (original inspiration) | [github.com/brunosimon/my-room-in-3d](https://github.com/brunosimon/my-room-in-3d) |
| **ctaxnagomi** | [github.com/ctaxnagomi](https://github.com/ctaxnagomi) |

### How to credit

Add a line in your README or application footer:

```
Built with KD Space — inspired by Bruno Simon, powered by KrackedDevs (github.com/ctaxnagomi/kd-space)
```

### Show your support

⭐ **Star this repo** if you find it useful — it helps others discover the project.

---

*Inspired by [Bruno Simon's My Room in 3D](https://github.com/brunosimon/my-room-in-3d)*  
*Built by [@ctaxnagomi](https://github.com/ctaxnagomi) · Powered by [KrackedDevs](https://www.krackeddevs.com)*  
*Infrastructure by [DeckerGUI](https://deckergui.my) · [CTECX](https://ctecx.deckergui.my) · [TypeSafe JEV](https://typesafe.ai)*

> ⚠️ **Bro Credit Notice** — If you fork, clone, or deploy any version of this project, you must retain all six credits above (Bruno Simon, @ctaxnagomi, KrackedDevs, DeckerGUI, CTECX, TypeSafe JEV) in your README, application footer, or credits screen. No exceptions. Bro code.