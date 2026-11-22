// Optional Cloudflare relay for cross-device presence and chat signalling.
// Set window.KD_SPACE_RELAY_URL before the bundle loads, or add ?relay=<wss url>
// to the page URL. With neither set, Presence falls back to local browser tabs.

export function getRelayUrl()
{
    try
    {
        const fromQuery = new URLSearchParams(window.location.search).get('relay')
        const fromWindow = window.KD_SPACE_RELAY_URL
        const value = String(fromQuery || fromWindow || '').trim()

        if(!value) return ''
        return value.replace(/\/+$/, '')
    }
    catch(_error)
    {
        return ''
    }
}
