// Social layer chip: identity editor plus named-space controls.
// Reads and writes through window.experience.social (localStorage, no network).

import Experience from './Experience.js'
import { IDENTITY_COLORS } from './Social.js'

export default class ProfileChip
{
    constructor()
    {
        this.experience = new Experience()
        this.social = this.experience.social

        this.root = document.querySelector('.profile-chip')
        this.button = document.querySelector('.profile-chip-btn')
        this.nameEl = document.querySelector('.profile-chip-name')
        this.dotEl = document.querySelector('.profile-chip-dot')
        this.popover = document.querySelector('.profile-popover')
        this.input = document.querySelector('.profile-name-input')
        this.swatches = document.querySelector('.profile-color-swatches')

        this.spaceNameInput = document.querySelector('.profile-space-name-input')
        this.spaceRoleEl = document.querySelector('.profile-space-role')
        this.spaceIdEl = document.querySelector('.profile-space-id')
        this.copyBtn = document.querySelector('.profile-copy-space-btn')
        this.statusEl = document.querySelector('.profile-space-status')

        this.statusTimer = null

        this.buildSwatches()
        this.render()

        this.button.addEventListener('click', (_event) =>
        {
            _event.stopPropagation()
            this.popover.classList.contains('visible') ? this.close() : this.open()
        })

        this.input.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'Enter') this.commitName()
            if(_event.key === 'Escape') this.close()
        })
        this.input.addEventListener('change', () => this.commitName())

        this.spaceNameInput.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'Enter') this.commitSpaceName()
            if(_event.key === 'Escape') this.close()
        })
        this.spaceNameInput.addEventListener('change', () => this.commitSpaceName())
        this.copyBtn.addEventListener('click', () => this.copySpaceLink())

        document.addEventListener('pointerdown', (_event) =>
        {
            if(!this.root.contains(_event.target)) this.close()
        })
    }

    buildSwatches()
    {
        for(const color of IDENTITY_COLORS)
        {
            const button = document.createElement('button')
            button.className = 'profile-swatch'
            button.style.background = color
            button.dataset.color = color
            button.title = color
            button.addEventListener('click', () =>
            {
                this.social.setColor(color)
                this.render()
            })
            this.swatches.appendChild(button)
        }
    }

    commitName()
    {
        const value = this.input.value.trim()
        if(value) this.social.setDisplayName(value)
        this.render()
    }

    commitSpaceName()
    {
        const value = this.spaceNameInput.value.trim()
        if(value) this.social.renameSpace(value)
        this.render()
    }

    async copySpaceLink()
    {
        const link = this.social.getSpaceLink()

        try
        {
            await navigator.clipboard.writeText(link)
            this.setStatus('Space link copied')
        }
        catch(_error)
        {
            // Clipboard access can be blocked outside a secure context.
            this.spaceNameInput.focus()
            this.spaceNameInput.select()
            this.setStatus('Copy blocked — use the URL bar')
        }
    }

    setStatus(_message)
    {
        this.statusEl.textContent = _message
        window.clearTimeout(this.statusTimer)
        this.statusTimer = window.setTimeout(() => { this.statusEl.textContent = '' }, 2500)
    }

    render()
    {
        const identity = this.social.getIdentity()
        const space = this.social.getSpace()

        this.nameEl.textContent = identity.name
        this.dotEl.style.background = identity.color
        this.dotEl.style.boxShadow = `0 0 8px ${identity.color}`
        this.input.value = identity.name

        this.spaceNameInput.value = space.name
        this.spaceNameInput.disabled = !space.isOwner
        this.spaceRoleEl.textContent = space.isOwner ? 'Owner' : 'Visiting'
        this.spaceRoleEl.classList.toggle('visiting', !space.isOwner)
        this.spaceIdEl.textContent = space.id

        for(const button of this.swatches.children)
            button.classList.toggle('selected', button.dataset.color === identity.color)
    }

    open()
    {
        this.popover.classList.add('visible')
        this.input.focus()
        this.input.select()
    }

    close()
    {
        this.popover.classList.remove('visible')
    }
}
