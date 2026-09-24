# KD Space

![Version](https://img.shields.io/badge/version-1.0.0-00e5ff?style=flat-square)
![Three.js](https://img.shields.io/badge/Three.js-0.130-000000?style=flat-square&logo=three.js)
![Webpack](https://img.shields.io/badge/Webpack-5-8DD6F9?style=flat-square&logo=webpack)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-Deployed-F38020?style=flat-square&logo=cloudflare)
![License](https://img.shields.io/badge/license-UNLICENSED-ff453a?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

A creative 3D room/space exploration built with **Three.js** — featuring a **Studio Mode** for uploading, editing, and composing 3D objects in real time.

> **Live:** [kd-space.pages.dev](https://kd-space.pages.dev)  
> **Source:** [github.com/ctaxnagomi/kd-space](https://github.com/ctaxnagomi/kd-space)

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
       ├── Select Object ──► TransformControls attach
       │    │                 Move / Rotate / Scale gizmo
       │    └── Remove ──► Deletes from scene & list
       │
       └── OrbitControls ──► Free camera navigation
```

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

*Inspired by [Bruno Simon's My Room in 3D](https://github.com/brunosimon/my-room-in-3d).*