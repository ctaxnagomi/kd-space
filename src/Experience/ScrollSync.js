// Real-time scroll relay between the navigable panel iframe and the 3D screen
// iframe. A parent page cannot read or set scrollY on a cross-origin frame, so
// the embedded page must opt in with a tiny script (see docs/scroll-relay.html).
// The parent only routes messages; it never needs frame access.

const REPORT = 'kd-scroll:report'
const APPLY = 'kd-scroll:apply'
const INIT = 'kd-scroll:init'

export default class ScrollSync
{
    constructor()
    {
        this.frames = new Map()
        this.loadListeners = new WeakSet()

        window.addEventListener('message', (_event) => this.receive(_event))
    }

    register(_iframe, _role, _url)
    {
        if(!_iframe) return

        let origin = '*'
        try
        {
            origin = new URL(_url, window.location.href).origin
        }
        catch(_error)
        {
            // Keep the wildcard for unusual URLs; the embedded script still works.
        }

        this.frames.set(_iframe, { role: _role, url: _url, origin })
        this.sendInit(_iframe)

        if(!this.loadListeners.has(_iframe))
        {
            this.loadListeners.add(_iframe)
            _iframe.addEventListener('load', () =>
            {
                if(this.frames.has(_iframe)) this.sendInit(_iframe)
            })
        }
    }

    sendInit(_iframe)
    {
        const meta = this.frames.get(_iframe)
        if(!meta) return
        try
        {
            _iframe.contentWindow.postMessage({ type: INIT, role: meta.role }, meta.origin)
        }
        catch(_error)
        {
            // The frame is not ready yet; its load handler will retry.
        }
    }

    unregister(_iframe)
    {
        this.frames.delete(_iframe)
    }

    unregisterAll()
    {
        this.frames.clear()
    }

    receive(_event)
    {
        const data = _event.data
        if(!data || data.type !== REPORT || typeof data.y !== 'number') return

        let sender = null
        for(const [iframe, meta] of this.frames)
        {
            if(iframe.contentWindow === _event.source) { sender = meta; break }
        }
        if(!sender) return
        if(sender.origin !== '*' && _event.origin !== sender.origin) return

        for(const [iframe, meta] of this.frames)
        {
            if(meta === sender || meta.url !== sender.url) continue
            try
            {
                iframe.contentWindow.postMessage({ type: APPLY, y: data.y }, meta.origin)
            }
            catch(_error)
            {
                // The peer frame may be navigating; the next report retries it.
            }
        }
    }
}
