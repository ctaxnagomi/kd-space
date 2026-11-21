// Phase 3 presence: local-first "who is here" across tabs in the same browser.
// The transport is BroadcastChannel (with a storage-event fallback), but the
// data model is transport-agnostic so a signalling service can replace it later.

const CHANNEL_PREFIX = 'kd-space-presence-v1'
const HEARTBEAT_MS = 4000
const STALE_MS = 12000

export default class Presence
{
    constructor(_social)
    {
        this.social = _social
        this.spaceId = _social.getSpace().id
        this.identity = _social.getIdentity()
        this.sessionId = this.createId()

        this.peers = new Map()
        this.listeners = new Set()
        this.signalListeners = new Set()
        this.running = false

        this.openTransport()
        this.start()
    }

    createId()
    {
        if(window.crypto && typeof window.crypto.randomUUID === 'function')
            return window.crypto.randomUUID()

        return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    envelope(_type)
    {
        return {
            type: _type,
            spaceId: this.spaceId,
            sessionId: this.sessionId,
            identity: { ...this.identity },
            sentAt: Date.now()
        }
    }

    openTransport()
    {
        if(typeof BroadcastChannel !== 'undefined')
        {
            const channel = new BroadcastChannel(`${CHANNEL_PREFIX}:${this.spaceId}`)
            channel.onmessage = (_event) => this.receive(_event.data)
            this.transport = {
                send: (_message) => channel.postMessage(_message),
                close: () => channel.close()
            }
            return
        }

        // Older Safari: storage events reach every other tab on the same origin.
        const key = `${CHANNEL_PREFIX}-bus:${this.spaceId}`
        const onStorage = (_event) =>
        {
            if(_event.key !== key || !_event.newValue) return
            try
            {
                this.receive(JSON.parse(_event.newValue))
            }
            catch(_error)
            {
                // Ignore malformed or unrelated bus writes.
            }
        }
        window.addEventListener('storage', onStorage)
        this.transport = {
            send: (_message) =>
            {
                try
                {
                    // nonce guarantees a fresh value so the event always fires.
                    localStorage.setItem(key, JSON.stringify({ ..._message, nonce: this.createId() }))
                }
                catch(_error)
                {
                    // Storage may be unavailable (private mode / quota).
                }
            },
            close: () => window.removeEventListener('storage', onStorage)
        }
    }

    start()
    {
        if(this.running) return
        this.running = true

        this.send('hello')
        this.heartbeat = window.setInterval(() =>
        {
            this.send('ping')
            this.prune()
        }, HEARTBEAT_MS)

        this.onLeave = () => this.send('bye')
        window.addEventListener('pagehide', this.onLeave)
        window.addEventListener('beforeunload', this.onLeave)
    }

    destroy()
    {
        if(!this.running) return
        this.send('bye')
        window.clearInterval(this.heartbeat)
        window.removeEventListener('pagehide', this.onLeave)
        window.removeEventListener('beforeunload', this.onLeave)
        this.transport.close()
        this.running = false
        this.peers.clear()
        this.emit()
    }

    send(_type)
    {
        this.transport.send(this.envelope(_type))
    }

    receive(_message)
    {
        if(!_message || _message.spaceId !== this.spaceId) return
        if(!_message.sessionId || _message.sessionId === this.sessionId) return

        // Hand every message to transport-agnostic listeners before the presence
        // types are filtered below, so messaging can reuse this same channel.
        this.emitSignal(_message)

        if(_message.type === 'bye')
        {
            if(this.peers.delete(_message.sessionId)) this.emit()
            return
        }

        if(_message.type !== 'hello' && _message.type !== 'ping') return
        if(!_message.identity || typeof _message.identity.name !== 'string') return

        this.peers.set(_message.sessionId, {
            sessionId: _message.sessionId,
            id: _message.identity.id,
            name: _message.identity.name,
            color: _message.identity.color || '#00e5ff',
            lastSeen: Date.now()
        })

        // Answer a newcomer immediately so both sides converge without waiting
        // for the next heartbeat.
        if(_message.type === 'hello') this.send('ping')
        this.emit()
    }

    prune()
    {
        const now = Date.now()
        let removed = false

        for(const [_sessionId, peer] of this.peers)
        {
            if(now - peer.lastSeen > STALE_MS)
            {
                this.peers.delete(_sessionId)
                removed = true
            }
        }

        if(removed) this.emit()
    }

    getSelf()
    {
        return {
            sessionId: this.sessionId,
            id: this.identity.id,
            name: this.identity.name,
            color: this.identity.color,
            isSelf: true
        }
    }

    getPeers()
    {
        return [...this.peers.values()].map((_peer) => ({ ..._peer, isSelf: false }))
    }

    getCount()
    {
        return 1 + this.peers.size
    }

    onChange(_callback)
    {
        this.listeners.add(_callback)
        return () => this.listeners.delete(_callback)
    }

    publish(_type, _payload)
    {
        this.transport.send({ ...this.envelope(_type), payload: _payload })
    }

    onSignal(_callback)
    {
        this.signalListeners.add(_callback)
        return () => this.signalListeners.delete(_callback)
    }

    emitSignal(_message)
    {
        for(const callback of this.signalListeners) callback(_message)
    }

    emit()
    {
        for(const callback of this.listeners) callback(this.getPeers())
    }
}
