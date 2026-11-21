// Small helpers shared by the screen overlays and the side panel.
// Browsers expose no cross-origin way to read X-Frame-Options, so a curated
// list of known non-embeddable hosts lets us substitute a working site instead
// of showing a blank "can't connect" frame.

export const FALLBACK_SITE_URL = 'https://deckergui.my'

const BLOCKED_HOSTS = new Set([
    'krackeddevs.com',
    'github.com',
    'gist.github.com',
    'x.com',
    'twitter.com',
    'facebook.com',
    'instagram.com',
    'linkedin.com',
    'stackoverflow.com',
    'discord.com'
])

export function hostLabel(_url)
{
    try
    {
        return new URL(_url).hostname.replace(/^www\./, '')
    }
    catch(_error)
    {
        return 'site'
    }
}

export function isBlockedHost(_url)
{
    if(!_url) return false
    try
    {
        const host = new URL(_url).hostname.toLowerCase().replace(/^www\./, '')
        return BLOCKED_HOSTS.has(host)
    }
    catch(_error)
    {
        return false
    }
}

export function effectiveEmbedUrl(_url)
{
    return isBlockedHost(_url) ? FALLBACK_SITE_URL : _url
}

export function openExternally(_url)
{
    if(!_url) return
    window.open(_url, '_blank', 'noopener,noreferrer')
}
