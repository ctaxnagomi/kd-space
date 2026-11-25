# KD Space relay

A small Cloudflare Worker + Durable Object that gives every `?space=<id>` room a
live WebSocket bus. It carries:

- presence rosters (who is here, and who owns the room),
- owner status (`online` / `idle` / `offline`),
- WebRTC signalling (`rtc-offer`, `rtc-answer`, `rtc-ice`) relayed to one peer,
- visitor GLB/GLTF submissions (`model-start`, `model-chunk`, `model-end`) and
  the owner's `model-result`, addressed to one peer,
- a shared visitor list, so every device sees who has entered the room.

Chat messages are not stored. One Durable Object is created per space id. Only
visitor names and timestamps are persisted, capped at 50 entries per space.
Model files are capped at 5 MB client-side and split into ~256 KB frames so each
WebSocket message stays under the platform limit.

## Deploy

```bash
npx wrangler login
npx wrangler deploy
```

Wrangler prints the workers.dev URL, for example
`https://kd-space-relay.<account>.workers.dev`.

## Connect the site

Pass that URL to the browser as a `relay` query parameter or set it before the
bundle loads:

```
https://kd-space-v2.pages.dev/?space=a1b2c3d4&relay=wss%3A%2F%2Fkd-space-relay.<account>.workers.dev
```

```html
<script>window.KD_SPACE_RELAY_URL = 'wss://kd-space-relay.<account>.workers.dev'</script>
```

With no relay configured, KD Space keeps working with its original same-browser
BroadcastChannel transport.
