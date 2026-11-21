// Phase 3 UI: a compact "N online" widget above the profile chip. Click it to
// see everyone currently in this space (same-browser tabs, local-first).

import Experience from './Experience.js'

export default class PresenceUI
{
    constructor()
    {
        this.experience = new Experience()
        this.presence = this.experience.presence

        this.root = document.querySelector('.presence-widget')
        this.toggle = document.querySelector('.presence-toggle')
        this.dots = document.querySelector('.presence-dots')
        this.count = document.querySelector('.presence-count')
        this.popover = document.querySelector('.presence-popover')
        this.list = document.querySelector('.presence-list')

        if(!this.root) return

        this.toggle.addEventListener('click', (_event) =>
        {
            _event.stopPropagation()
            this.popover.classList.contains('visible') ? this.close() : this.open()
        })

        document.addEventListener('pointerdown', (_event) =>
        {
            if(!this.root.contains(_event.target)) this.close()
        })

        this.unsubscribe = this.presence.onChange(() => this.render())
        this.render()
    }

    makeDot(_person, _className)
    {
        const dot = document.createElement('span')
        dot.className = _className
        dot.style.background = _person.color
        dot.style.boxShadow = `0 0 8px ${_person.color}`
        return dot
    }

    render()
    {
        const self = this.presence.getSelf()
        const people = [self, ...this.presence.getPeers()]

        this.count.textContent = `${people.length} online`

        this.dots.textContent = ''
        for(const person of people.slice(0, 4))
            this.dots.appendChild(this.makeDot(person, 'presence-dot'))

        this.list.textContent = ''
        for(const person of people)
        {
            const row = document.createElement('div')
            row.className = 'presence-row'

            const dot = this.makeDot(person, 'presence-row-dot')
            const name = document.createElement('span')
            name.className = 'presence-row-name'
            name.textContent = person.isSelf ? `${person.name} (you)` : person.name

            row.appendChild(dot)
            row.appendChild(name)
            if(person.isSelf) row.classList.add('self')
            this.list.appendChild(row)
        }
    }

    open()
    {
        this.popover.classList.add('visible')
    }

    close()
    {
        this.popover.classList.remove('visible')
    }
}
