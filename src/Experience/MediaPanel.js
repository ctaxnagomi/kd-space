import Experience from './Experience.js'

export default class MediaPanel
{
    constructor()
    {
        this.experience = new Experience()

        this.element = document.querySelector('.media-panel')
        this.titleEl = document.querySelector('.media-panel-title')
        this.addressEl = document.querySelector('.media-panel-address')
        this.frameEl = document.querySelector('.media-panel-frame')
        this.closeBtn = document.querySelector('.media-panel-close')
        this.openBtn = document.querySelector('.media-panel-open')
        this.goBtn = document.querySelector('.media-panel-go')

        this.current = null

        this.closeBtn.addEventListener('click', () => this.close())
        this.openBtn.addEventListener('click', () => this.openExternally())
        this.goBtn.addEventListener('click', () => this.navigate(this.addressEl.value))
        this.addressEl.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'Enter') this.navigate(this.addressEl.value)
        })
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

    open(_options = {})
    {
        const url = this.normalizeUrl(_options.url)
        const embedUrl = this.normalizeUrl(_options.embedUrl || _options.url)
        if(!url && !embedUrl) return

        this.current = { url, embedUrl, label: _options.label || 'Live site' }
        this.titleEl.textContent = this.current.label
        this.addressEl.value = url || embedUrl

        this.element.classList.add('visible')
        this.frameEl.src = embedUrl || url
    }

    navigate(_value)
    {
        const url = this.normalizeUrl(_value)
        if(!url || !this.current) return

        this.current = { ...this.current, url, embedUrl: url, label: this.hostLabel(url) }
        this.titleEl.textContent = this.current.label
        this.addressEl.value = url
        this.frameEl.src = url
    }

    hostLabel(_url)
    {
        try
        {
            return new URL(_url).hostname.replace(/^www\./, '')
        }
        catch(_error)
        {
            return 'Live site'
        }
    }

    openExternally()
    {
        if(!this.current) return
        window.open(this.current.url || this.current.embedUrl, '_blank', 'noopener,noreferrer')
    }

    close()
    {
        this.element.classList.remove('visible')
        this.frameEl.src = 'about:blank'
        this.current = null
    }
}
