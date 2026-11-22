import * as THREE from 'three'

import Experience from './Experience.js'

const STATUS_COLORS = {
    online: '#4ade80',
    idle: '#fbbf24',
    offline: '#9ca3af'
}

export default class OwnerPlaque
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene

        this.label = ''
        this.lastKey = ''

        this.setCanvas()
        this.setModel()
        this.renderLabel('Room owner', 'offline')
    }

    setCanvas()
    {
        this.canvas = document.createElement('canvas')
        this.canvas.width = 1024
        this.canvas.height = 256
        this.context = this.canvas.getContext('2d')

        this.texture = new THREE.CanvasTexture(this.canvas)
        this.texture.encoding = THREE.sRGBEncoding
        this.texture.minFilter = THREE.LinearFilter
        this.texture.magFilter = THREE.LinearFilter
    }

    setModel()
    {
        this.model = {}
        this.model.group = new THREE.Group()
        this.model.group.name = 'Room Owner Status'
        this.model.group.position.set(1.62, 4.02, -5.0)

        const width = 1.55
        const height = 0.42
        const border = 0.03

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x151b24,
            roughness: 0.35,
            metalness: 0.35
        })
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, 0.05),
            frameMaterial
        )
        frame.name = 'Status Plaque Frame'
        frame.castShadow = true
        this.model.group.add(frame)

        const screenMaterial = new THREE.MeshBasicMaterial({ map: this.texture })
        this.model.screen = new THREE.Mesh(
            new THREE.PlaneGeometry(width - border * 2, height - border * 2),
            screenMaterial
        )
        this.model.screen.name = 'Status Plaque Display'
        this.model.screen.position.z = 0.027
        this.model.group.add(this.model.screen)

        // System objects stay out of Studio's stock catalog and saved layouts.
        this.model.group.userData.kdSystem = true
        this.scene.add(this.model.group)
    }

    renderLabel(_name, _status)
    {
        const context = this.context
        if(!context) return

        const status = STATUS_COLORS[_status] ? _status : 'offline'
        const color = STATUS_COLORS[status]
        const name = String(_name || 'Room owner').slice(0, 24)
        const text = `${name} is ${status}`

        context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        context.fillStyle = '#0d1420'
        context.fillRect(0, 0, this.canvas.width, this.canvas.height)

        context.strokeStyle = color
        context.lineWidth = 6
        context.strokeRect(6, 6, this.canvas.width - 12, this.canvas.height - 12)

        context.fillStyle = color
        context.beginPath()
        context.arc(78, this.canvas.height / 2, 26, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = '#f5f7fa'
        context.font = '600 58px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
        context.textBaseline = 'middle'
        context.fillText(text, 128, 112, this.canvas.width - 160)

        context.fillStyle = color
        context.font = '500 30px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
        context.fillText(
            status === 'online' ? 'In the room now' : status === 'idle' ? 'Away — still connected' : 'Not in the room',
            130,
            178,
            this.canvas.width - 160
        )

        this.texture.needsUpdate = true
    }

    update()
    {
        const presence = this.experience.presence
        const info = presence
            ? presence.getOwnerInfo()
            : { name: 'Room owner', status: 'offline' }

        const key = `${info.name}|${info.status}`
        if(key === this.lastKey) return
        this.lastKey = key
        this.renderLabel(info.name, info.status)
    }
}
