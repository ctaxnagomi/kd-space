// One Durable Object instance per KD Space room.

const OWNER_STATUSES = ['online', 'idle', 'offline']

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

    handleSocket(_socket)
    {
        let sessionId = null

        _socket.addEventListener('message', (_event) =>
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

                if(!this.ownerSessionId && (claimsOwner || !this.ownerIdentity))
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
                this.broadcastRoster()
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

        _socket.addEventListener('close', () =>
        {
            if(!sessionId) return
            this.sessions.delete(sessionId)

            if(sessionId === this.ownerSessionId)
            {
                this.ownerStatus = 'offline'
                this.broadcast({
                    type: 'status',
                    status: 'offline',
                    name: this.ownerIdentity && this.ownerIdentity.name ? this.ownerIdentity.name : ''
                })
            }

            this.broadcastRoster()
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

    broadcastRoster()
    {
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
            ownerName: this.ownerIdentity && this.ownerIdentity.name ? this.ownerIdentity.name : ''
        })
    }
}
