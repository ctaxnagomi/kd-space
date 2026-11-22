# KD Space relay

A small Cloudflare Worker + Durable Object that gives every `?space=<id>` room a
live WebSocket bus. It carries:

- presence rosters (who is here, and who owns the room),
- owner status (`online` / `idle` / `offline`),
- WebRTC signalling (`rtc-offer`, `rtc-answer`, `rtc-ice`) relayed to one peer.

No messages are stored. One Durable Object is created per space id.

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
