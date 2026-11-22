// macOS-style floating dock: Chat / Studio / Status / Room in one place.
// Hover, selection and taps magnify the item icon like a MacBook dock.

import Experience from './Experience.js'

const PLAQUE_KEY = 'kd-space-plaque-visible-v1'

export default class FloatingNav
{
    constructor()
    {
        this.experience = new Experience()
        this.nav = document.querySelector('.floating-nav')
        this.items = new Map()

        for(const element of document.querySelectorAll('.floating-nav .nav-item'))
            this.items.set(element.dataset.nav, element)

        this.outdoor = false
        this.restoreStatus()
        this.bind()
        this.sync()
    }

    restoreStatus()
    {
        const plaque = this.experience.world && this.experience.world.ownerPlaque
        if(!plaque) return

        let visible = true
        try
        {
            const stored = localStorage.getItem(PLAQUE_KEY)
            if(stored !== null) visible = stored === '1'
        }
        catch(_error)
        {
            // Storage may be unavailable; keep the default.
        }

        plaque.setVisible(visible)
    }

    bind()
    {
        for(const [name, element] of this.items)
        {
            element.addEventListener('click', () =>
            {
                this.activate(name)
                this.pop(element)
            })

            // Dock-style magnification: the hovered icon grows most and its
            // immediate neighbours rise slightly, like macOS.
            element.addEventListener('pointerenter', () => this.setHovered(element))
            element.addEventListener('pointerleave', () => this.clearHovered())
            element.addEventListener('focus', () => this.setHovered(element))
            element.addEventListener('blur', () => this.clearHovered())
        }
    }

    setHovered(_element)
    {
        const elements = [...this.items.values()]
        for(const element of elements) element.classList.remove('is-hovered', 'is-near')

        _element.classList.add('is-hovered')
        const index = elements.indexOf(_element)
        if(index > 0) elements[index - 1].classList.add('is-near')
        if(index < elements.length - 1) elements[index + 1].classList.add('is-near')
        if(this.nav) this.nav.classList.add('is-hovering')
    }

    clearHovered()
    {
        for(const element of this.items.values()) element.classList.remove('is-hovered', 'is-near')
        if(this.nav) this.nav.classList.remove('is-hovering')
    }

    // A short springy bump on click/tap, matching the hover magnification.
    pop(_element)
    {
        _element.classList.remove('pop')
        void _element.offsetWidth
        _element.classList.add('pop')
        window.setTimeout(() => _element.classList.remove('pop'), 420)
    }

    activate(_name)
    {
        if(_name === 'chat')
        {
            const ui = this.experience.messagingUI
            if(!ui) return
            if(ui.panel.classList.contains('visible')) ui.close()
            else ui.open()
        }
        else if(_name === 'studio')
        {
            if(this.experience.studio) this.experience.studio.toggle()
        }
        else if(_name === 'status')
        {
            this.toggleStatus()
        }
        else if(_name === 'room')
        {
            this.toggleRoom()
        }

        this.sync()
    }

    toggleStatus()
    {
        const plaque = this.experience.world && this.experience.world.ownerPlaque
        if(!plaque) return

        plaque.setVisible(!plaque.isVisible())
        try
        {
            localStorage.setItem(PLAQUE_KEY, plaque.isVisible() ? '1' : '0')
        }
        catch(_error)
        {
            // Visibility still applies for this session.
        }
    }

    toggleRoom()
    {
        this.outdoor = !this.outdoor
        if(this.experience.navigation)
            this.experience.navigation.focusArea(this.outdoor ? 'outdoor' : 'indoor')
    }

    sync()
    {
        const e = this.experience

        this.setActive('chat', !!(e.messagingUI && e.messagingUI.panel.classList.contains('visible')))
        this.setActive('studio', !!(e.studio && e.studio.active))
        this.setActive('status', !!(e.world && e.world.ownerPlaque && e.world.ownerPlaque.isVisible()))

        const room = this.items.get('room')
        if(room)
        {
            this.setActive('room', this.outdoor)
            const value = room.querySelector('.nav-value')
            if(value) value.textContent = this.outdoor ? 'OUT' : 'IN'
            room.title = this.outdoor ? 'Switch to indoor room' : 'Switch to outdoor room'
        }

        const studio = this.items.get('studio')
        if(studio)
        {
            const label = studio.querySelector('.nav-label')
            if(label) label.textContent = e.studio && e.studio.active ? 'Exit' : 'Studio'
            studio.title = e.studio && e.studio.active ? 'Exit Studio mode' : 'Studio mode'
        }
    }

    setActive(_name, _active)
    {
        const element = this.items.get(_name)
        if(!element) return

        element.classList.toggle('active', !!_active)
        element.setAttribute('aria-pressed', _active ? 'true' : 'false')
    }
}
