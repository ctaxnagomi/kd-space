// Phase 4: peer-to-peer messaging over a WebRTC data channel.
// Signalling (offers, answers, ICE candidates) rides on the presence channel,
// so it stays local-first too. Swap `presence.onSignal`/`publish` for a hosted
// signalling transport later without changing this class or the chat UI.

const SIGNAL_TYPES = ['rtc-offer', 'rtc-answer', 'rtc-ice']

export default class Messaging
{
    constructor(_presence)
    {
        this.presence = _presence
        this.identity = _presence.identity
        this.connections = new Map()
        this.messageListeners = new Set()
        this.statusListeners = new Set()

        if(!window.RTCPeerConnection)
        {
            this.supported = false
            return
        }

        this.supported = true
        this.unsubscribeSignal = this.presence.onSignal((_message) => this.receiveSignal(_message))
        this.unsubscribePeers = this.presence.onChange(() => this.syncPeers())
        this.syncPeers()
    }

    isInitiator(_sessionId)
    {
        // Both sides agree on who offers, which avoids simultaneous-offer glare.
        return this.presence.sessionId < _sessionId
    }

    syncPeers()
    {
        const ids = new Set(this.presence.getPeers().map((_peer) => _peer.sessionId))

        for(const sessionId of [...this.connections.keys()])
            if(!ids.has(sessionId)) this.closePeer(sessionId)

        for(const sessionId of ids)
            if(!this.connections.has(sessionId) && this.isInitiator(sessionId))
                this.createOffer(sessionId)
    }

    ensurePeer(_sessionId)
    {
        const existing = this.connections.get(_sessionId)
        if(existing) return existing

        // STUN lets real devices discover each other; TURN would be needed for
        // the most restrictive symmetric-NAT networks.
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        })
        const connection = { pc, channel: null, ready: false }
        this.connections.set(_sessionId, connection)

        pc.onicecandidate = (_event) =>
        {
            if(!_event.candidate) return
            const candidate = _event.candidate.toJSON ? _event.candidate.toJSON() : _event.candidate
            this.presence.publish('rtc-ice', { to: _sessionId, candidate })
        }

        pc.onconnectionstatechange = () =>
        {
            if(['failed', 'closed', 'disconnected'].includes(pc.connectionState))
                this.closePeer(_sessionId)
        }

        pc.ondatachannel = (_event) => this.attachChannel(_sessionId, _event.channel)

        return connection
    }

    attachChannel(_sessionId, _channel)
    {
        const connection = this.connections.get(_sessionId)
        if(!connection) return

        connection.channel = _channel
        _channel.onopen = () =>
        {
            connection.ready = true
            this.emitStatus()
        }
        _channel.onclose = () =>
        {
            connection.ready = false
            this.emitStatus()
        }
        _channel.onmessage = (_event) =>
        {
            try
            {
                const data = JSON.parse(_event.data)
                if(data && typeof data.text === 'string') this.emitMessage(data)
            }
            catch(_error)
            {
                console.warn('KD Space: ignored malformed chat message', _error)
            }
        }
    }

    async createOffer(_sessionId)
    {
        try
        {
            const connection = this.ensurePeer(_sessionId)
            this.attachChannel(_sessionId, connection.pc.createDataChannel('kd-chat'))

            const offer = await connection.pc.createOffer()
            await connection.pc.setLocalDescription(offer)
            const description = connection.pc.localDescription.toJSON
                ? connection.pc.localDescription.toJSON()
                : connection.pc.localDescription
            this.presence.publish('rtc-offer', { to: _sessionId, description })
        }
        catch(_error)
        {
            console.warn('KD Space: could not create chat offer', _error)
            this.closePeer(_sessionId)
        }
    }

    async receiveSignal(_message)
    {
        if(!SIGNAL_TYPES.includes(_message.type)) return

        const payload = _message.payload
        if(!payload || payload.to !== this.presence.sessionId) return

        const from = _message.sessionId

        try
        {
            if(_message.type === 'rtc-offer')
            {
                const connection = this.ensurePeer(from)
                await connection.pc.setRemoteDescription(payload.description)

                const answer = await connection.pc.createAnswer()
                await connection.pc.setLocalDescription(answer)
                const description = connection.pc.localDescription.toJSON
                    ? connection.pc.localDescription.toJSON()
                    : connection.pc.localDescription
                this.presence.publish('rtc-answer', { to: from, description })
            }
            else if(_message.type === 'rtc-answer')
            {
                const connection = this.connections.get(from)
                if(connection) await connection.pc.setRemoteDescription(payload.description)
            }
            else if(_message.type === 'rtc-ice')
            {
                const connection = this.connections.get(from)
                if(connection) await connection.pc.addIceCandidate(payload.candidate)
            }
        }
        catch(_error)
        {
            console.warn('KD Space: chat signalling failed', _error)
        }
    }

    closePeer(_sessionId)
    {
        const connection = this.connections.get(_sessionId)
        if(!connection) return

        try
        {
            if(connection.channel) connection.channel.close()
            connection.pc.close()
        }
        catch(_error)
        {
            // Already closing — nothing to do.
        }

        this.connections.delete(_sessionId)
        this.emitStatus()
    }

    getConnectedCount()
    {
        let count = 0
        for(const connection of this.connections.values())
            if(connection.ready) count++
        return count
    }

    send(_text)
    {
        const text = String(_text || '').trim().slice(0, 500)
        if(!text) return { sent: 0, message: null }

        const message = {
            sessionId: this.presence.sessionId,
            from: this.identity.name,
            color: this.identity.color,
            text,
            sentAt: Date.now()
        }

        let sent = 0
        for(const connection of this.connections.values())
        {
            if(!connection.ready || !connection.channel || connection.channel.readyState !== 'open') continue
            try
            {
                connection.channel.send(JSON.stringify(message))
                sent++
            }
            catch(_error)
            {
                // A peer may have closed between the status check and the send.
            }
        }

        this.emitMessage(message)
        return { sent, message }
    }

    onMessage(_callback)
    {
        this.messageListeners.add(_callback)
        return () => this.messageListeners.delete(_callback)
    }

    onStatus(_callback)
    {
        this.statusListeners.add(_callback)
        return () => this.statusListeners.delete(_callback)
    }

    emitMessage(_message)
    {
        for(const callback of this.messageListeners) callback(_message)
    }

    emitStatus()
    {
        const count = this.getConnectedCount()
        for(const callback of this.statusListeners) callback(count)
    }

    destroy()
    {
        if(!this.supported) return
        this.unsubscribeSignal()
        this.unsubscribePeers()
        for(const sessionId of [...this.connections.keys()]) this.closePeer(sessionId)
        this.supported = false
    }
}
