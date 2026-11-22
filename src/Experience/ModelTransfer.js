// Relays visitor GLB/GLTF submissions to the room owner in small WebSocket
// frames, and gives the owner a review prompt before the model is placed in the
// outdoor courtyard. Nothing is stored on the relay.

import Experience from './Experience.js'

const CHUNK_SIZE = 262144 // ~256 KB per frame, safely under CF's 1 MiB limit
const MAX_BYTES = 5 * 1024 * 1024

export default class ModelTransfer
{
    constructor(_studio)
    {
        this.experience = new Experience()
        this.studio = _studio
        this.presence = this.experience.presence
        this.incoming = null
        this.submitting = false

        this.setUI()
        if(this.presence)
        {
            this.unsubscribe = this.presence.onModel((_message) => this.handleMessage(_message))
            this.unsubscribeRole = this.presence.onChange(() => this.syncRole())
            this.syncRole()
        }
    }

    syncRole()
    {
        if(!this.presence || !this.presence.isConnectedToRelay()) return
        const role = this.presence.getSelf().role
        if(role === 'owner' || role === 'visitor')
            this.studio.setVisitorRole(role === 'visitor')
    }

    createId()
    {
        if(window.crypto && typeof window.crypto.randomUUID === 'function')
            return window.crypto.randomUUID()

        return `model-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    setUI()
    {
        this.root = document.querySelector('.model-review')
        if(!this.root) return

        this.meta = this.root.querySelector('.model-review-meta')
        this.progress = this.root.querySelector('.model-review-progress')
        this.acceptBtn = this.root.querySelector('.model-review-accept')
        this.declineBtn = this.root.querySelector('.model-review-decline')

        this.acceptBtn.addEventListener('click', () => this.accept())
        this.declineBtn.addEventListener('click', () => this.decline())
    }

    // Visitor side: send a file to the owner in chunks. Returns false when no
    // relay/owner is available so Studio can fall back to a local placement.
    async submit(_file)
    {
        if(!_file) return false
        if(this.submitting) return false

        const presence = this.experience.presence || this.presence
        if(!presence || !presence.isConnectedToRelay() || !presence.getOwnerSessionId()) return false

        if(_file.size > MAX_BYTES)
        {
            this.studio.setStatus('Model is too large (5 MB max).', 'error')
            return true
        }

        this.submitting = true
        this.studio.setStatus(`Uploading ${_file.name} to the owner…`)

        try
        {
            const base64 = await this.readBase64(_file)
            const id = this.createId()
            const total = Math.max(1, Math.ceil(base64.length / CHUNK_SIZE))

            if(!presence.sendToOwner('model-start', {
                id,
                name: _file.name,
                size: _file.size,
                total,
                uploader: presence.identity.name
            }))
            {
                throw new Error('owner unavailable')
            }

            for(let index = 0; index < total; index++)
            {
                const data = base64.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
                presence.sendToOwner('model-chunk', { id, index, data })
                this.studio.setStatus(`Uploading ${_file.name}… ${Math.round((index + 1) / total * 100)}%`)
            }

            presence.sendToOwner('model-end', { id })
            return true
        }
        catch(_error)
        {
            console.error('KD Space: model relay failed', _error)
            this.studio.setStatus('Could not reach the owner — model added locally.', 'error')
            return false
        }
        finally
        {
            this.submitting = false
        }
    }

    readBase64(_file)
    {
        return new Promise((_resolve, _reject) =>
        {
            const reader = new FileReader()
            reader.onload = () => _resolve(String(reader.result || '').split(',')[1] || '')
            reader.onerror = () => _reject(reader.error)
            reader.readAsDataURL(_file)
        })
    }

    // Owner side: receive chunks and manage the review prompt.
    handleMessage(_message)
    {
        const payload = _message.payload || {}
        const type = _message.type

        if(type === 'model-result')
        {
            if(payload.ok)
                this.studio.setStatus(`${payload.name || 'Model'} was added to the Outdoor Room.`, 'success')
            else
                this.studio.setStatus(`${payload.name || 'Model'} was declined by the owner.`, 'error')
            return
        }

        if(type === 'model-start')
        {
            if(this.incoming)
            {
                this.sendResult(payload.id, payload.from, false, 'owner busy')
                return
            }

            this.incoming = {
                id: payload.id,
                name: payload.name || 'model.glb',
                from: _message.from,
                uploader: payload.uploader || 'A visitor',
                size: payload.size || 0,
                total: payload.total || 0,
                chunks: new Map(),
                complete: false
            }

            this.showReview()
            this.updateReview()
            return
        }

        if(type === 'model-chunk' && this.incoming && payload.id === this.incoming.id)
        {
            this.incoming.chunks.set(payload.index, payload.data)
            this.updateReview()
            return
        }

        if(type === 'model-end' && this.incoming && payload.id === this.incoming.id)
        {
            this.incoming.complete = true
            this.updateReview()
        }
    }

    showReview()
    {
        if(!this.root) return
        this.root.classList.add('visible')
        this.acceptBtn.disabled = true
        this.declineBtn.disabled = false
    }

    hideReview()
    {
        if(!this.root) return
        this.root.classList.remove('visible')
        this.incoming = null
    }

    updateReview()
    {
        if(!this.incoming || !this.root) return

        const submitted = this.incoming.chunks.size
        const total = this.incoming.total || 0
        const received = [...this.incoming.chunks.values()].reduce((_sum, _chunk) => _sum + _chunk.length, 0)

        this.meta.innerHTML = `<strong>${this.escape(this.incoming.uploader)}</strong> sent<br>${this.escape(this.incoming.name)}<br>${(this.incoming.size / 1024 / 1024).toFixed(2)} MB`

        if(this.incoming.complete && submitted >= total)
        {
            this.progress.textContent = 'Ready to place in the Outdoor Room.'
            this.acceptBtn.disabled = false
        }
        else
        {
            this.progress.textContent = `Receiving… ${submitted}/${total || '?'} chunks · ${(received / 1024 / 1024).toFixed(2)} MB`
            this.acceptBtn.disabled = true
        }
    }

    escape(_value)
    {
        return String(_value).replace(/[&<>"']/g, (_char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[_char]))
    }

    assemble()
    {
        const incoming = this.incoming
        if(!incoming || !incoming.complete) return null

        const chunks = []
        for(let index = 0; index < incoming.total; index++)
        {
            const chunk = incoming.chunks.get(index)
            if(typeof chunk !== 'string') return null
            chunks.push(chunk)
        }

        const mime = /\.gltf$/i.test(incoming.name) ? 'model/gltf+json' : 'model/gltf-binary'
        return `data:${mime};base64,${chunks.join('')}`
    }

    accept()
    {
        const incoming = this.incoming
        if(!incoming) return

        const dataUrl = this.assemble()
        if(!dataUrl)
        {
            this.progress.textContent = 'The upload was incomplete. Ask the visitor to try again.'
            return
        }

        this.acceptBtn.disabled = true
        this.declineBtn.disabled = true
        this.progress.textContent = 'Opening model…'

        this.studio.gltfLoader.load(dataUrl, (gltf) =>
        {
            const model = gltf.scene
            this.studio.normalizeModel(model)
            const group = this.studio.wrapModel(model, {
                kind: 'upload',
                name: incoming.name,
                dataUrl
            })
            group.name = incoming.name
            this.studio.addUploadToOutdoor(group)

            this.sendResult(incoming.id, incoming.from, true, incoming.name)
            this.studio.setStatus(`${incoming.name} added to the Outdoor Room.`, 'success')
            if(this.experience.navigation) this.experience.navigation.focusArea('outdoor')
            this.hideReview()
        }, undefined, (_error) =>
        {
            console.error('KD Space: could not open submitted model', _error)
            this.progress.textContent = 'That file could not be opened. Ask for a valid GLB/GLTF.'
            this.acceptBtn.disabled = false
            this.declineBtn.disabled = false
        })
    }

    decline()
    {
        const incoming = this.incoming
        if(!incoming) return

        this.sendResult(incoming.id, incoming.from, false, incoming.name)
        this.studio.setStatus(`${incoming.name} declined.`, 'error')
        this.hideReview()
    }

    sendResult(_id, _to, _ok, _name)
    {
        const presence = this.experience.presence || this.presence
        if(presence && _to)
            presence.sendToSession(_to, 'model-result', { id: _id, ok: _ok, name: _name })
    }
}
