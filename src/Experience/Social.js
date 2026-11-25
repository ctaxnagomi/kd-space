// Local-first groundwork for the social layer.
// No network calls yet: identity and space metadata live in browser storage so
// presence, visits and messaging can attach to stable ids later.

const IDENTITY_KEY = 'kd-space-identity-v1'
const SPACE_KEY = 'kd-space-space-v1'
const VISITOR_KEY = 'kd-space-visitors-v1'
const PENDING_NAME_KEY = 'kd-space-pending-name'
const SPACE_PARAM = 'space'

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
        this.spaceState = this.readSpaceState()
        this.visitors = this.readVisitors()
        this.space = this.resolveSpace()

        this.syncUrl()
    }

    createId()
    {
        if(window.crypto && typeof window.crypto.randomUUID === 'function')
            return window.crypto.randomUUID()

        return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    createShortId()
    {
        const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
        const bytes = new Uint8Array(8)

        if(window.crypto && typeof window.crypto.getRandomValues === 'function')
            window.crypto.getRandomValues(bytes)
        else
            for(let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

        return Array.from(bytes, (_byte) => alphabet[_byte % alphabet.length]).join('')
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

    readVisitors()
    {
        const stored = this.readJson(VISITOR_KEY)
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
    }

    addVisitor(_spaceId, _person)
    {
        if(!_person) return false

        const id = _person.id || _person.sessionId
        if(!id || id === this.identity.id) return false

        const spaceId = String(_spaceId || this.space.id)
        const list = Array.isArray(this.visitors[spaceId]) ? this.visitors[spaceId] : []
        const name = String(_person.name || 'Guest').trim().slice(0, 24) || 'Guest'
        const color = /^#[0-9a-f]{6}$/i.test(_person.color || '') ? _person.color : '#00e5ff'
        const role = _person.role === 'owner' ? 'owner' : 'visitor'
        const now = Date.now()

        const existing = list.find((_visitor) => _visitor.id === id)
        let changed = false

        if(existing)
        {
            existing.lastSeen = now
            if(existing.name !== name) { existing.name = name; changed = true }
            if(existing.color !== color) { existing.color = color; changed = true }
            if(existing.role !== role) { existing.role = role; changed = true }
        }
        else
        {
            list.push({ id, name, color, role, firstSeen: now, lastSeen: now })
            changed = true
        }

        list.sort((_a, _b) => _b.lastSeen - _a.lastSeen)
        this.visitors[spaceId] = list.slice(0, 50)

        if(changed) this.writeJson(VISITOR_KEY, this.visitors)
        return changed
    }

    getVisitors(_spaceId)
    {
        const spaceId = String(_spaceId || this.space.id)
        const list = Array.isArray(this.visitors[spaceId]) ? this.visitors[spaceId] : []
        return list.map((_visitor) => ({ ..._visitor })).sort((_a, _b) => _b.lastSeen - _a.lastSeen)
    }

    // The relay returns the canonical visitor list for a space. Merge it with
    // browser-local entries so history saved before a relay was connected is
    // still visible, while the relay's names and timestamps win on conflict.
    mergeVisitors(_spaceId, _list)
    {
        if(!Array.isArray(_list)) return false

        const spaceId = String(_spaceId || this.space.id)
        const merged = (Array.isArray(this.visitors[spaceId]) ? this.visitors[spaceId] : [])
            .map((_visitor) => ({ ..._visitor }))

        for(const entry of _list)
        {
            if(!entry || typeof entry !== 'object') continue

            const id = String(entry.id || entry.sessionId || '')
            if(!id || id === this.identity.id) continue

            const name = String(entry.name || 'Guest').trim().slice(0, 24) || 'Guest'
            const color = /^#[0-9a-f]{6}$/i.test(entry.color || '') ? entry.color : '#00e5ff'
            const role = entry.role === 'owner' ? 'owner' : 'visitor'
            const firstSeen = Number(entry.firstSeen) || Date.now()
            const lastSeen = Number(entry.lastSeen) || firstSeen
            const existing = merged.find((_visitor) => _visitor.id === id)

            if(existing)
                Object.assign(existing, { name, color, role, firstSeen, lastSeen })
            else
                merged.push({ id, name, color, role, firstSeen, lastSeen })
        }

        merged.sort((_a, _b) => (_b.lastSeen || 0) - (_a.lastSeen || 0))
        const trimmed = merged.slice(0, 50)
        const changed = JSON.stringify(trimmed) !== JSON.stringify(this.visitors[spaceId] || [])
        this.visitors[spaceId] = trimmed

        if(changed) this.writeJson(VISITOR_KEY, this.visitors)
        return changed
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

        // The intro screen writes the chosen name just before the room loads.
        let pendingName = null
        try
        {
            pendingName = localStorage.getItem(PENDING_NAME_KEY)
            if(pendingName) localStorage.removeItem(PENDING_NAME_KEY)
        }
        catch(_error)
        {
            pendingName = null
        }

        if(pendingName)
        {
            identity.name = String(pendingName).trim().slice(0, 24) || identity.name
            identity.guest = false
            this.writeJson(this.identityKey, identity)
        }

        return identity
    }

    readSpaceState()
    {
        const stored = this.readJson(this.spaceKey)
        const empty = { currentId: null, spaces: {} }

        if(!stored || typeof stored !== 'object') return empty

        // Migrate the phase-0/1 single-space record into the new registry.
        if(stored.spaces && typeof stored.spaces === 'object')
        {
            return {
                currentId: typeof stored.currentId === 'string' ? stored.currentId : null,
                spaces: stored.spaces
            }
        }

        if(typeof stored.id === 'string')
        {
            return { currentId: stored.id, spaces: { [stored.id]: stored } }
        }

        return empty
    }

    writeSpaceState()
    {
        this.writeJson(this.spaceKey, this.spaceState)
    }

    readSpaceIdFromUrl()
    {
        const value = new URLSearchParams(window.location.search).get(SPACE_PARAM)
        if(!value || !/^[a-z0-9]{4,12}$/i.test(value)) return null
        return value.toLowerCase()
    }

    resolveSpace()
    {
        const fromUrl = this.readSpaceIdFromUrl()

        if(fromUrl && this.spaceState.spaces[fromUrl])
        {
            this.spaceState.currentId = fromUrl
            this.writeSpaceState()
            return this.spaceState.spaces[fromUrl]
        }

        if(fromUrl) return this.createSpace(fromUrl)

        const current = this.spaceState.spaces[this.spaceState.currentId]
        if(current) return current

        return this.createSpace()
    }

    createSpace(_id)
    {
        const space = {
            id: _id || this.createShortId(),
            ownerId: this.identity.id,
            ownerName: this.identity.name,
            name: 'My KD Space',
            createdAt: new Date().toISOString()
        }
        this.spaceState.spaces[space.id] = space
        this.spaceState.currentId = space.id
        this.writeSpaceState()
        return space
    }

    syncUrl()
    {
        const url = new URL(window.location.href)

        if(url.searchParams.get(SPACE_PARAM) === this.space.id) return

        url.searchParams.set(SPACE_PARAM, this.space.id)
        window.history.replaceState(window.history.state, '', url.href)
    }

    getIdentity()
    {
        return { ...this.identity }
    }

    getSpace()
    {
        return { ...this.space, isOwner: this.isOwner() }
    }

    getSpaces()
    {
        return Object.values(this.spaceState.spaces).map((_space) => ({
            ..._space,
            isOwner: _space.ownerId === this.identity.id
        }))
    }

    isOwner()
    {
        return !!this.space && this.space.ownerId === this.identity.id
    }

    getSpaceLink()
    {
        const url = new URL(window.location.href)
        url.searchParams.set(SPACE_PARAM, this.space.id)
        url.hash = ''
        return url.href
    }

    setDisplayName(_name)
    {
        const name = String(_name || '').trim().slice(0, 24)
        if(!name) return this.getIdentity()

        this.identity.name = name
        this.writeJson(this.identityKey, this.identity)

        // Keep shared-link hints in sync with the owner's display name.
        for(const space of Object.values(this.spaceState.spaces))
        {
            if(space.ownerId === this.identity.id) space.ownerName = name
        }
        this.writeSpaceState()

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
        if(!this.isOwner()) return this.getSpace()

        const name = String(_name || '').trim().slice(0, 32)
        if(!name) return this.getSpace()

        this.space.name = name
        this.spaceState.spaces[this.space.id] = this.space
        this.writeSpaceState()
        return this.getSpace()
    }

    claimSpace()
    {
        // Only an unclaimed space can be claimed; visiting someone else's
        // local record never silently transfers ownership.
        if(this.space.ownerId) return this.getSpace()

        this.space.ownerId = this.identity.id
        this.space.ownerName = this.identity.name
        this.spaceState.spaces[this.space.id] = this.space
        this.writeSpaceState()
        return this.getSpace()
    }

    // A visitor learns the real owner's name from the relay and caches it so the
    // next visit can show an accurate intro hint before the relay connects.
    setOwnerName(_name)
    {
        if(this.isOwner()) return this.getSpace()

        const name = String(_name || '').trim().slice(0, 24)
        if(!name || name === 'Room owner') return this.getSpace()

        this.space.ownerName = name
        this.spaceState.spaces[this.space.id] = this.space
        this.writeSpaceState()
        return this.getSpace()
    }
}
