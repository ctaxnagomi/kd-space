// Presence: who is in a space, plus the transport used for chat signalling and
// owner status. Local BroadcastChannel still works on its own; when a relay URL
// is configured the same data model is carried over a WebSocket so visitors on
// other devices can see each other and reach the room owner.

import { getRelayUrl } from './RealtimeConfig.js'

const CHANNEL_PREFIX = 'kd-space-presence-v1'
const HEARTBEAT_MS = 4000
const STALE_MS = 12000
const IDLE_MS = 60000

export default class Presence
{
    constructor(_social)
    {
        this.social = _social
        this.spaceId = _social.getSpace().id
        this.identity = _social.getIdentity()
        this.sessionId = this.createId()
        this.isOwnerLocal = this.social.isOwner()

        this.peers = new Map()
        this.listeners = new Set()
        this.signalListeners = new Set()
        this.statusListeners = new Set()
        this.modelListeners = new Set()
        this.running = false

        this.remoteReady = false
        this.remoteRole = null
        this.remoteTransport = null
        this.ownerInfo = null
        this.ownerSessionId = null

        this.activityStatus = 'online'
        this.lastInput = Date.now()

        this.openTransport()
        this.startActivity()
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
        this.localTransport = this.createLocalTransport()

        this.transport = {
            send: (_message) =>
            {
                if(this.remoteReady && this.remoteTransport)
                    this.remoteTransport.send(_message)
                else
                    this.localTransport.send(_message)
            },
            close: () =>
            {
                this.localTransport.close()
                if(this.remoteTransport) this.remoteTransport.close()
            }
        }

        this.openRemoteTransport()
    }

    createLocalTransport()
    {
        if(typeof BroadcastChannel !== 'undefined')
        {
            const channel = new BroadcastChannel(`${CHANNEL_PREFIX}:${this.spaceId}`)
            channel.onmessage = (_event) => this.receive(_event.data)
            return {
                send: (_message) => channel.postMessage(_message),
                close: () => channel.close()
            }
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

        return {
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

    openRemoteTransport()
    {
        const baseUrl = getRelayUrl()
        if(!baseUrl || !window.WebSocket) return

        let socket
        try
        {
            socket = new WebSocket(`${baseUrl}/space/${this.spaceId}`)
        }
        catch(_error)
        {
            return
        }

        this.remoteTransport = {
            send: (_message) =>
            {
                if(socket.readyState !== 1) return

                // Messaging publishes rtc-* envelopes; the relay expects a
                // targeted signal frame so only the intended peer receives it.
                if(_message.type && _message.type.indexOf('rtc-') === 0 && _message.payload && _message.payload.to)
                {
                    socket.send(JSON.stringify({
                        type: 'signal',
                        signalType: _message.type,
                        to: _message.payload.to,
                        payload: _message.payload,
                        spaceId: this.spaceId,
                        sessionId: this.sessionId
                    }))
                    return
                }

                socket.send(JSON.stringify(_message))
            },
            // Targeted relay frames (model submissions) bypass the rtc-* rewrite.
            sendRaw: (_frame) =>
            {
                if(socket.readyState === 1) socket.send(JSON.stringify(_frame))
            },
            close: () =>
            {
                try
                {
                    socket.close()
                }
                catch(_error)
                {
                    // Already closed.
                }
            }
        }

        socket.addEventListener('open', () =>
        {
            this.remoteReady = true
            socket.send(JSON.stringify({
                ...this.envelope('hello'),
                claimsOwner: this.isOwnerLocal,
                status: this.activityStatus
            }))
            this.emit()
        })

        socket.addEventListener('message', (_event) =>
        {
            let message
            try
            {
                message = JSON.parse(_event.data)
            }
            catch(_error)
            {
                return
            }
            this.receive(message)
        })

        socket.addEventListener('close', () =>
        {
            this.remoteReady = false
            this.remoteRole = null
            this.ownerInfo = null
            this.ownerSessionId = null
            this.emit()
            this.emitStatus()
        })

        socket.addEventListener('error', () =>
        {
            // The close handler restores the local-only fallback.
        })
    }

    startActivity()
    {
        const mark = () =>
        {
            this.lastInput = Date.now()
            this.updateActivityStatus()
        }

        this.activityEvents = [
            ['pointermove', window, mark],
            ['pointerdown', window, mark],
            ['keydown', window, mark],
            ['wheel', window, mark],
            ['touchstart', window, mark]
        ]
        for(const [name, target, handler] of this.activityEvents)
            target.addEventListener(name, handler, { passive: true })

        this.onVisibility = () => this.updateActivityStatus()
        document.addEventListener('visibilitychange', this.onVisibility)
        this.activityTimer = window.setInterval(() => this.updateActivityStatus(), 5000)
    }

    updateActivityStatus()
    {
        let status = 'online'
        if(document.visibilityState !== 'visible') status = 'offline'
        else if(Date.now() - this.lastInput >= IDLE_MS) status = 'idle'

        if(status === this.activityStatus) return

        this.activityStatus = status
        this.sendStatus(status)
        this.emitStatus()
    }

    sendStatus(_status)
    {
        if(!this.remoteReady || !this.remoteTransport) return

        this.remoteTransport.send({
            type: 'status',
            spaceId: this.spaceId,
            sessionId: this.sessionId,
            status: _status,
            name: this.identity.name,
            sentAt: Date.now()
        })
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

        this.onLeave = () =>
        {
            this.sendStatus('offline')
            this.send('bye')
        }
        window.addEventListener('pagehide', this.onLeave)
        window.addEventListener('beforeunload', this.onLeave)
    }

    destroy()
    {
        if(!this.running) return
        this.sendStatus('offline')
        this.send('bye')
        window.clearInterval(this.heartbeat)
        window.clearInterval(this.activityTimer)
        window.removeEventListener('pagehide', this.onLeave)
        window.removeEventListener('beforeunload', this.onLeave)
        document.removeEventListener('visibilitychange', this.onVisibility)
        for(const [name, target, handler] of this.activityEvents)
            target.removeEventListener(name, handler)
        this.transport.close()
        this.running = false
        this.peers.clear()
        this.emit()
    }

    send(_type)
    {
        const message = this.envelope(_type)
        if(_type === 'ping') message.status = this.activityStatus
        this.transport.send(message)
    }

    receive(_message)
    {
        if(!_message || typeof _message !== 'object') return

        if(_message.type === 'welcome')
        {
            this.remoteRole = _message.role || null
            this.ownerSessionId = _message.ownerSessionId || this.ownerSessionId
            this.emit()
            return
        }

        // Model submissions/reviews are relayed frames addressed via `to`.
        if(typeof _message.type === 'string' && _message.type.indexOf('model-') === 0)
        {
            this.emitModel(_message)
            return
        }

        if(_message.type === 'roster')
        {
            this.applyRoster(_message)
            return
        }

        if(_message.type === 'status')
        {
            this.ownerInfo = {
                name: _message.name || (this.ownerInfo && this.ownerInfo.name) || 'Room owner',
                status: _message.status || 'offline'
            }
            this.cacheOwnerName()
            this.emitStatus()
            return
        }

        if(_message.type === 'signal')
        {
            this.emitSignal({
                type: _message.signalType,
                sessionId: _message.from,
                payload: _message.payload,
                sentAt: Date.now()
            })
            return
        }

        if(_message.type === 'pong') return

        if(_message.spaceId !== this.spaceId) return
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

        const peer = {
            sessionId: _message.sessionId,
            id: _message.identity.id,
            name: _message.identity.name,
            color: _message.identity.color || '#00e5ff',
            role: _message.role || 'visitor',
            status: _message.status || 'online',
            lastSeen: Date.now()
        }
        this.peers.set(_message.sessionId, peer)
        this.rememberVisitor(peer)

        // Answer a newcomer immediately so both sides converge without waiting
        // for the next heartbeat.
        if(_message.type === 'hello') this.send('ping')
        this.emit()
    }

    cacheOwnerName()
    {
        if(!this.ownerInfo || !this.social || !this.social.setOwnerName) return
        this.social.setOwnerName(this.ownerInfo.name)
    }

    rememberVisitor(_peer)
    {
        if(!_peer || _peer.role === 'owner') return
        if(!this.social || !this.social.addVisitor) return
        this.social.addVisitor(this.spaceId, _peer)
    }

    applyRoster(_message)
    {
        let owner = null
        this.ownerSessionId = _message.ownerSessionId || null
        this.peers.clear()

        for(const peer of Array.isArray(_message.peers) ? _message.peers : [])
        {
            if(!peer || !peer.sessionId) continue

            if(peer.sessionId === this.sessionId)
            {
                this.remoteRole = peer.role || null
                continue
            }

            const remotePeer = {
                sessionId: peer.sessionId,
                id: peer.identity && peer.identity.id,
                name: peer.identity && peer.identity.name ? peer.identity.name : 'Guest',
                color: peer.identity && peer.identity.color ? peer.identity.color : '#00e5ff',
                role: peer.role || 'visitor',
                status: peer.status || 'online',
                lastSeen: Date.now()
            }
            this.peers.set(peer.sessionId, remotePeer)
            this.rememberVisitor(remotePeer)

            if(peer.role === 'owner') owner = peer
        }

        if(owner)
        {
            this.ownerInfo = {
                name: owner.identity && owner.identity.name ? owner.identity.name : 'Room owner',
                status: owner.status || 'offline'
            }
        }
        else if(_message.ownerName)
        {
            this.ownerInfo = {
                name: _message.ownerName,
                status: _message.ownerStatus || 'offline'
            }
        }

        this.cacheOwnerName()
        this.emit()
        this.emitStatus()
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
            role: this.remoteRole || (this.isOwnerLocal ? 'owner' : 'visitor'),
            isSelf: true
        }
    }

    getPeers()
    {
        return [...this.peers.values()].map((_peer) => ({ ..._peer, isSelf: false }))
    }

    getVisitors()
    {
        if(!this.social || !this.social.getVisitors) return []
        return this.social.getVisitors(this.spaceId)
    }

    getCount()
    {
        return 1 + this.peers.size
    }

    getOwnerInfo()
    {
        if(this.ownerInfo) return { ...this.ownerInfo }

        if(this.remoteRole === 'owner' || this.isOwnerLocal)
            return { name: this.identity.name, status: this.activityStatus }

        return { name: 'Room owner', status: 'offline' }
    }

    isConnectedToRelay()
    {
        return this.remoteReady
    }

    getOwnerSessionId()
    {
        return this.ownerSessionId
    }

    // Send a targeted frame to the room owner through the relay. Returns false
    // when there is no live owner to receive it so callers can fall back local.
    sendToOwner(_type, _payload)
    {
        if(!this.remoteReady || !this.remoteTransport || !this.remoteTransport.sendRaw) return false
        if(!this.ownerSessionId) return false

        this.remoteTransport.sendRaw({
            type: _type,
            to: this.ownerSessionId,
            from: this.sessionId,
            spaceId: this.spaceId,
            payload: _payload,
            sentAt: Date.now()
        })
        return true
    }

    sendToSession(_sessionId, _type, _payload)
    {
        if(!this.remoteReady || !this.remoteTransport || !this.remoteTransport.sendRaw) return false
        if(!_sessionId) return false

        this.remoteTransport.sendRaw({
            type: _type,
            to: _sessionId,
            from: this.sessionId,
            spaceId: this.spaceId,
            payload: _payload,
            sentAt: Date.now()
        })
        return true
    }

    onChange(_callback)
    {
        this.listeners.add(_callback)
        return () => this.listeners.delete(_callback)
    }

    onOwnerStatus(_callback)
    {
        this.statusListeners.add(_callback)
        return () => this.statusListeners.delete(_callback)
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

    onModel(_callback)
    {
        this.modelListeners.add(_callback)
        return () => this.modelListeners.delete(_callback)
    }

    emitModel(_message)
    {
        for(const callback of this.modelListeners) callback(_message)
    }

    emitSignal(_message)
    {
        for(const callback of this.signalListeners) callback(_message)
    }

    emit()
    {
        for(const callback of this.listeners) callback(this.getPeers())
    }

    emitStatus()
    {
        const info = this.getOwnerInfo()
        for(const callback of this.statusListeners) callback(info)
    }
}
