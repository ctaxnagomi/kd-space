// One Durable Object instance per KD Space room.

const OWNER_STATUSES = ['online', 'idle', 'offline']
const VISITOR_KEY = 'visitors'
const VISITOR_LIMIT = 50

export class SpaceRoom
{
    constructor(_state)
    {
        this.state = _state
        this.sessions = new Map()
        this.ownerSessionId = null
        this.ownerIdentity = null
        this.ownerStatus = 'offline'
    }

    async fetch(_request)
    {
        if(_request.headers.get('Upgrade') !== 'websocket')
            return new Response('Expected a WebSocket upgrade', { status: 426 })

        const pair = new WebSocketPair()
        pair[1].accept()
        this.handleSocket(pair[1])

        return new Response(null, { status: 101, webSocket: pair[0] })
    }

    async handleSocket(_socket)
    {
        let sessionId = null

        _socket.addEventListener('message', async (_event) =>
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

            if(!message || typeof message !== 'object' || typeof message.type !== 'string') return

            if(message.type === 'hello')
            {
                const id = String(message.sessionId || '')
                if(!id) return

                sessionId = id
                const claimsOwner = !!message.claimsOwner

                // Only the device that actually owns the space claims the owner
                // seat. A visitor who arrives first must never be mistaken for it.
                if(claimsOwner && (!this.ownerSessionId || !this.sessions.has(this.ownerSessionId)))
                {
                    this.ownerSessionId = sessionId
                    this.ownerIdentity = message.identity || {}
                    this.ownerStatus = OWNER_STATUSES.includes(message.status) ? message.status : 'online'
                }

                const role = sessionId === this.ownerSessionId ? 'owner' : 'visitor'
                this.sessions.set(sessionId, {
                    socket: _socket,
                    identity: message.identity || {},
                    role,
                    status: role === 'owner' ? this.ownerStatus : 'online'
                })

                this.send(_socket, {
                    type: 'welcome',
                    sessionId,
                    role,
                    ownerSessionId: this.ownerSessionId
                })

                if(role === 'visitor') await this.addVisitor(message.identity, sessionId)
                await this.broadcastRoster()
                return
            }

            if(!sessionId || !this.sessions.has(sessionId)) return

            if(message.type === 'ping')
            {
                this.send(_socket, { type: 'pong', sentAt: Date.now() })
                return
            }

            if(message.type === 'signal' && message.to)
            {
                const target = this.sessions.get(String(message.to))
                if(target)
                {
                    this.send(target.socket, {
                        type: 'signal',
                        signalType: message.signalType,
                        from: sessionId,
                        payload: message.payload
                    })
                }
                return
            }

            // Relay model submissions and the owner's review decision to the
            // addressed peer. Chunks are small enough to stay under the 1 MiB
            // WebSocket message limit.
            if(message.type.indexOf('model-') === 0 && message.to)
            {
                const target = this.sessions.get(String(message.to))
                if(target)
                {
                    this.send(target.socket, {
                        type: message.type,
                        from: sessionId,
                        spaceId: message.spaceId,
                        payload: message.payload
                    })
                }
                return
            }

            if(message.type === 'status' && sessionId === this.ownerSessionId)
            {
                const status = OWNER_STATUSES.includes(message.status) ? message.status : 'online'
                this.ownerStatus = status
                const session = this.sessions.get(sessionId)
                if(session) session.status = status
                if(message.name && this.ownerIdentity && !this.ownerIdentity.name)
                    this.ownerIdentity.name = String(message.name).slice(0, 24)

                this.broadcast({
                    type: 'status',
                    status,
                    name: this.ownerIdentity && this.ownerIdentity.name ? this.ownerIdentity.name : ''
                })
            }
        })

        _socket.addEventListener('close', async () =>
        {
            if(!sessionId) return
            this.sessions.delete(sessionId)

            if(sessionId === this.ownerSessionId)
            {
                this.ownerStatus = 'offline'
                // Free the seat so a reloading owner can reclaim it.
                this.ownerSessionId = null
                this.broadcast({
                    type: 'status',
                    status: 'offline',
                    name: this.ownerIdentity && this.ownerIdentity.name ? this.ownerIdentity.name : ''
                })
            }

            await this.broadcastRoster()
        })

        _socket.addEventListener('error', () =>
        {
            // The close handler performs the cleanup.
        })
    }

    send(_socket, _message)
    {
        if(!_socket || _socket.readyState !== 1) return
        try
        {
            _socket.send(JSON.stringify(_message))
        }
        catch(_error)
        {
            // A peer may have vanished between the check and the send.
        }
    }

    broadcast(_message)
    {
        for(const session of this.sessions.values()) this.send(session.socket, _message)
    }

    async readVisitors()
    {
        try
        {
            const stored = await this.state.storage.get(VISITOR_KEY)
            return Array.isArray(stored) ? stored : []
        }
        catch(_error)
        {
            return []
        }
    }

    async writeVisitors(_visitors)
    {
        try
        {
            await this.state.storage.put(VISITOR_KEY, _visitors)
        }
        catch(_error)
        {
            // Storage may be unavailable; live presence still works.
        }
    }

    async addVisitor(_identity, _sessionId)
    {
        if(!_identity || typeof _identity !== 'object') return this.readVisitors()

        const id = String(_identity.id || _sessionId || '')
        if(!id) return this.readVisitors()

        const name = String(_identity.name || 'Guest').trim().slice(0, 24) || 'Guest'
        const color = /^#[0-9a-f]{6}$/i.test(_identity.color || '') ? _identity.color : '#00e5ff'
        const now = Date.now()
        const visitors = await this.readVisitors()

        const existing = visitors.find((_visitor) => _visitor.id === id)
        if(existing)
        {
            existing.name = name
            existing.color = color
            existing.role = 'visitor'
            existing.lastSeen = now
        }
        else
        {
            visitors.push({ id, name, color, role: 'visitor', firstSeen: now, lastSeen: now })
        }

        visitors.sort((_a, _b) => (_b.lastSeen || 0) - (_a.lastSeen || 0))
        const trimmed = visitors.slice(0, VISITOR_LIMIT)
        await this.writeVisitors(trimmed)
        return trimmed
    }

    async broadcastRoster()
    {
        const visitors = await this.readVisitors()
        const peers = []
        for(const [sessionId, session] of this.sessions)
        {
            peers.push({
                sessionId,
                identity: session.identity,
                role: session.role,
                status: session.status
            })
        }

        this.broadcast({
            type: 'roster',
            peers,
            ownerSessionId: this.ownerSessionId,
            ownerStatus: this.ownerStatus,
            ownerName: this.ownerIdentity && this.ownerIdentity.name ? this.ownerIdentity.name : '',
            visitors
        })
    }
}
