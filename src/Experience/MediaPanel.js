import Experience from './Experience.js'
import { isBlockedHost, effectiveEmbedUrl, hostLabel, openExternally } from './EmbedUtils.js'

export default class MediaPanel
{
    constructor()
    {
        this.experience = new Experience()

        this.element = document.querySelector('.media-panel')
        this.headerEl = document.querySelector('.media-panel-header')
        this.titleEl = document.querySelector('.media-panel-title')
        this.addressEl = document.querySelector('.media-panel-address')
        this.frameEl = document.querySelector('.media-panel-frame')
        this.closeBtn = document.querySelector('.media-panel-close')
        this.openBtn = document.querySelector('.media-panel-open')
        this.goBtn = document.querySelector('.media-panel-go')
        this.resizeHandle = document.querySelector('.media-panel-resize')

        this.current = null
        this.sourceScreen = null
        this.drag = null
        this.resize = null

        this.closeBtn.addEventListener('click', () => this.close())
        this.openBtn.addEventListener('click', () => this.openExternally())
        this.goBtn.addEventListener('click', () => this.navigate(this.addressEl.value))
        this.addressEl.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'Enter') this.navigate(this.addressEl.value)
        })

        this.headerEl.addEventListener('pointerdown', (_event) => this.startDrag(_event))
        this.resizeHandle.addEventListener('pointerdown', (_event) => this.startResize(_event))
        window.addEventListener('pointermove', (_event) => this.onPointerMove(_event))
        window.addEventListener('pointerup', () => this.stopInteraction())
    }

    normalizeUrl(_value)
    {
        let value = String(_value || '').trim()
        if(!value) return null
        if(!/^https?:\/\//i.test(value)) value = `https://${value}`

        try
        {
            return new URL(value).href
        }
        catch(_error)
        {
            return null
        }
    }

    showTarget(_url, _label, _originalUrl = null)
    {
        const blocked = isBlockedHost(_url)
        const target = effectiveEmbedUrl(_url)

        this.frameEl.style.display = 'block'
        this.frameEl.src = target || 'about:blank'
        this.titleEl.textContent = blocked
            ? `${hostLabel(_url)} → ${hostLabel(target)}`
            : _label

        // Keep the screen the panel was opened from in sync with the panel.
        if(this.sourceScreen) this.sourceScreen.mirrorUrl(_originalUrl || _url, target || _url)

        if(this.experience.scrollSync && target)
            this.experience.scrollSync.register(this.frameEl, 'panel', target)
    }

    open(_options = {})
    {
        const url = this.normalizeUrl(_options.url)
        const embedUrl = this.normalizeUrl(_options.embedUrl || _options.url)
        if(!url && !embedUrl) return

        this.current = { url, embedUrl, label: _options.label || 'Live site' }
        this.addressEl.value = url || embedUrl
        this.element.classList.add('visible')
        this.showTarget(embedUrl || url, this.current.label, url)
    }

    navigate(_value)
    {
        const url = this.normalizeUrl(_value)
        if(!url || !this.current) return

        this.current = { ...this.current, url, embedUrl: url, label: hostLabel(url) }
        this.addressEl.value = url
        this.showTarget(url, this.current.label, url)
    }

    openExternally()
    {
        if(!this.current) return
        openExternally(this.current.url || this.current.embedUrl)
    }

    close()
    {
        this.element.classList.remove('visible')
        this.frameEl.src = 'about:blank'
        if(this.experience.scrollSync)
        {
            this.experience.scrollSync.unregister(this.frameEl)
            if(this.sourceScreen) this.experience.scrollSync.unregister(this.sourceScreen.overlay.iframe)
        }
        if(this.sourceScreen) this.sourceScreen.clearMirror()
        this.sourceScreen = null
        this.current = null

        // Restore CSS positioning so the panel can slide out cleanly.
        this.element.style.left = ''
        this.element.style.top = ''
        this.element.style.width = ''
        this.element.style.height = ''
        this.element.style.transform = ''
        this.element.style.transition = ''
    }

    startDrag(_event)
    {
        if(_event.target.closest('button')) return
        if(!this.element.classList.contains('visible')) return

        const rect = this.element.getBoundingClientRect()
        this.drag = { x: _event.clientX, y: _event.clientY, left: rect.left, top: rect.top }
        this.element.style.transition = 'none'
        this.element.style.transform = 'none'
        this.element.style.left = `${rect.left}px`
        this.element.style.top = `${rect.top}px`
        _event.preventDefault()
    }

    startResize(_event)
    {
        const rect = this.element.getBoundingClientRect()
        this.resize = { x: _event.clientX, y: _event.clientY, width: rect.width, height: rect.height }
        this.element.style.transition = 'none'
        _event.preventDefault()
    }

    onPointerMove(_event)
    {
        if(this.drag)
        {
            const rect = this.element.getBoundingClientRect()
            const left = Math.min(Math.max(this.drag.left + _event.clientX - this.drag.x, 0), window.innerWidth - rect.width)
            const top = Math.min(Math.max(this.drag.top + _event.clientY - this.drag.y, 0), window.innerHeight - rect.height)
            this.element.style.left = `${left}px`
            this.element.style.top = `${top}px`
        }

        if(this.resize)
        {
            const width = Math.min(Math.max(this.resize.width + _event.clientX - this.resize.x, 280), window.innerWidth - 40)
            const height = Math.min(Math.max(this.resize.height + _event.clientY - this.resize.y, 240), window.innerHeight - 40)
            this.element.style.width = `${width}px`
            this.element.style.height = `${height}px`
        }
    }

    stopInteraction()
    {
        if(this.drag || this.resize) this.element.style.transition = ''
        this.drag = null
        this.resize = null
    }
}
