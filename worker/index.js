// Cloudflare Worker entry point for KD Space live presence + chat signalling.
// One Durable Object per space id keeps the roster and relays WebRTC offers,
// answers, ICE candidates and owner status between real devices.

export { SpaceRoom } from './room.js'

export default {
    async fetch(_request, _env)
    {
        const url = new URL(_request.url)

        if(url.pathname === '/health')
        {
            return new Response('ok', {
                headers: { 'Access-Control-Allow-Origin': '*' }
            })
        }

        const match = url.pathname.match(/^\/space\/([a-z0-9]{4,12})\/?$/i)
        if(!match) return new Response('Not found', { status: 404 })

        const spaceId = match[1].toLowerCase()
        const id = _env.ROOM.idFromName(spaceId)
        const room = _env.ROOM.get(id)

        const headers = new Headers(_request.headers)
        headers.set('x-kd-space', spaceId)

        return room.fetch(new Request(_request, { headers }))
    }
}
