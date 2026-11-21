// Local-first groundwork for the social layer.
// No network calls yet: identity and space metadata live in browser storage so
// presence, visits and messaging can attach to stable ids later.

const IDENTITY_KEY = 'kd-space-identity-v1'
const SPACE_KEY = 'kd-space-space-v1'

export const IDENTITY_COLORS = [
    '#00e5ff',
    '#66d9a0',
    '#ffd166',
    '#ff6b6b',
    '#b388ff',
    '#ff9f68'
]

export default class Social
{
    constructor()
    {
        this.identityKey = IDENTITY_KEY
        this.spaceKey = SPACE_KEY

        this.identity = this.readOrCreateIdentity()
        this.space = this.readOrCreateSpace()
    }

    createId()
    {
        if(window.crypto && typeof window.crypto.randomUUID === 'function')
            return window.crypto.randomUUID()

        return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    readJson(_key)
    {
        try
        {
            const json = localStorage.getItem(_key)
            return json ? JSON.parse(json) : null
        }
        catch(_error)
        {
            console.warn('KD Space: could not read social state', _error)
            return null
        }
    }

    writeJson(_key, _value)
    {
        try
        {
            localStorage.setItem(_key, JSON.stringify(_value))
            return true
        }
        catch(_error)
        {
            console.warn('KD Space: could not save social state', _error)
            return false
        }
    }

    readOrCreateIdentity()
    {
        let identity = this.readJson(this.identityKey)

        if(!identity || typeof identity.id !== 'string' || typeof identity.name !== 'string')
        {
            const id = this.createId()
            identity = {
                id,
                name: `KD-${id.slice(0, 4).toUpperCase()}`,
                color: IDENTITY_COLORS[Math.floor(Math.random() * IDENTITY_COLORS.length)],
                guest: true,
                createdAt: new Date().toISOString()
            }
            this.writeJson(this.identityKey, identity)
        }

        return identity
    }

    readOrCreateSpace()
    {
        let space = this.readJson(this.spaceKey)

        if(!space || typeof space.id !== 'string')
        {
            space = {
                id: this.createId(),
                ownerId: this.identity.id,
                name: 'My KD Space',
                createdAt: new Date().toISOString()
            }
            this.writeJson(this.spaceKey, space)
        }

        return space
    }

    getIdentity()
    {
        return { ...this.identity }
    }

    getSpace()
    {
        return { ...this.space }
    }

    setDisplayName(_name)
    {
        const name = String(_name || '').trim().slice(0, 24)
        if(!name) return this.getIdentity()

        this.identity.name = name
        this.writeJson(this.identityKey, this.identity)
        return this.getIdentity()
    }

    setColor(_color)
    {
        if(typeof _color !== 'string' || !/^#[0-9a-f]{6}$/i.test(_color)) return this.getIdentity()

        this.identity.color = _color.toLowerCase()
        this.writeJson(this.identityKey, this.identity)
        return this.getIdentity()
    }

    renameSpace(_name)
    {
        const name = String(_name || '').trim().slice(0, 32)
        if(!name) return this.getSpace()

        this.space.name = name
        this.writeJson(this.spaceKey, this.space)
        return this.getSpace()
    }

    claimSpace()
    {
        // Reserved for when a signed-in identity replaces the local guest.
        this.space.ownerId = this.identity.id
        this.writeJson(this.spaceKey, this.space)
        return this.getSpace()
    }
}
