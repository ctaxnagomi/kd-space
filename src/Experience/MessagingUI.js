// Phase 4 UI: a slide-in chat panel using the WebRTC data channel from Messaging.

import Experience from './Experience.js'

export default class MessagingUI
{
    constructor()
    {
        this.experience = new Experience()
        this.messaging = this.experience.messaging

        this.toggle = document.querySelector('.chat-toggle')
        this.panel = document.querySelector('.chat-panel')
        this.closeBtn = document.querySelector('.chat-close')
        this.statusEl = document.querySelector('.chat-status')
        this.log = document.querySelector('.chat-log')
        this.input = document.querySelector('.chat-input')
        this.sendBtn = document.querySelector('.chat-send')

        if(!this.toggle) return

        this.toggle.addEventListener('click', () => this.open())
        this.closeBtn.addEventListener('click', () => this.close())
        this.sendBtn.addEventListener('click', () => this.submit())
        this.input.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'Enter')
            {
                _event.preventDefault()
                this.submit()
            }
            if(_event.key === 'Escape') this.close()
        })

        this.messaging.onMessage((_message) => this.append(_message))
        this.messaging.onStatus((_count) => this.renderStatus(_count))
        this.renderStatus(this.messaging.getConnectedCount())

        if(!this.messaging.supported)
        {
            this.statusEl.textContent = 'unavailable'
            this.input.disabled = true
            this.sendBtn.disabled = true
        }
    }

    submit()
    {
        const { sent, message } = this.messaging.send(this.input.value)
        if(!message) return

        this.input.value = ''
        if(!sent) this.setHint('Nobody connected yet')
        this.input.focus()
    }

    setHint(_text)
    {
        this.statusEl.textContent = _text
    }

    renderStatus(_count)
    {
        this.statusEl.textContent = `${_count} connected`
    }

    append(_message)
    {
        const isSelf = _message.sessionId === this.messaging.presence.sessionId

        const row = document.createElement('div')
        row.className = `chat-message${isSelf ? ' self' : ''}`

        const meta = document.createElement('div')
        meta.className = 'chat-message-meta'
        const dot = document.createElement('span')
        dot.className = 'chat-message-dot'
        dot.style.background = _message.color
        dot.style.boxShadow = `0 0 6px ${_message.color}`
        const name = document.createElement('span')
        name.textContent = isSelf ? `${_message.from} (you)` : _message.from
        meta.appendChild(dot)
        meta.appendChild(name)

        const text = document.createElement('div')
        text.className = 'chat-message-text'
        text.textContent = _message.text

        row.appendChild(meta)
        row.appendChild(text)
        this.log.appendChild(row)
        this.log.scrollTop = this.log.scrollHeight
    }

    open()
    {
        this.panel.classList.add('visible')
        this.toggle.classList.add('active')
        this.input.focus()
    }

    close()
    {
        this.panel.classList.remove('visible')
        this.toggle.classList.remove('active')
    }
}
