import * as THREE from 'three'

import Experience from './Experience.js'
import { effectiveEmbedUrl } from './EmbedUtils.js'

export const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
export const DEFAULT_SITE_URL = 'https://example.com'

export function parseYouTube(_value)
{
    const raw = String(_value || '').trim()
    if(!raw) return null

    const match = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)
    const id = match ? match[1] : (raw.match(/^[\w-]{11}$/) ? raw : null)
    if(!id) return null

    const query = [
        'autoplay=1',
        'mute=1',
        'loop=1',
        `playlist=${id}`,
        'controls=0',
        'modestbranding=1',
        'rel=0',
        'playsinline=1',
        'enablejsapi=1'
    ].join('&')

    return {
        id,
        watch: `https://www.youtube.com/watch?v=${id}`,
        embed: `https://www.youtube.com/embed/${id}?${query}`
    }
}

function solveHomography(_destination)
{
    // Map the unit square (0,0) (1,0) (1,1) (0,1) onto four screen pixels.
    const source = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const matrix = []
    const values = []

    for(let i = 0; i < 4; i++)
    {
        const u = source[i][0]
        const v = source[i][1]
        const x = _destination[i][0]
        const y = _destination[i][1]

        matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x])
        values.push(x)
        matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y])
        values.push(y)
    }

    // Gaussian elimination with partial pivoting.
    for(let column = 0; column < 8; column++)
    {
        let pivot = column
        for(let row = column + 1; row < 8; row++)
        {
            if(Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row
        }

        if(Math.abs(matrix[pivot][column]) < 1e-10) return null
        if(pivot !== column)
        {
            ;[matrix[pivot], matrix[column]] = [matrix[column], matrix[pivot]]
            ;[values[pivot], values[column]] = [values[column], values[pivot]]
        }

        const divisor = matrix[column][column]
        for(let j = column; j < 8; j++) matrix[column][j] /= divisor
        values[column] /= divisor

        for(let row = 0; row < 8; row++)
        {
            if(row === column) continue
            const factor = matrix[row][column]
            if(Math.abs(factor) < 1e-12) continue
            for(let j = column; j < 8; j++) matrix[row][j] -= factor * matrix[column][j]
            values[row] -= factor * values[column]
        }
    }

    return values
}

export default class Screen
{
    constructor(_mesh, _sourcePath, _settings = {})
    {
        this.experience = new Experience()
        this.resources = this.experience.resources
        this.debug = this.experience.debug
        this.scene = this.experience.scene
        this.world = this.experience.world
        this.sizes = this.experience.sizes
        this.camera = this.experience.camera

        this.mesh = _mesh
        this.sourcePath = _sourcePath
        this.settings = {
            mode: _settings.mode || 'video',
            youtubeUrl: _settings.youtubeUrl || DEFAULT_YOUTUBE_URL,
            siteUrl: _settings.siteUrl || DEFAULT_SITE_URL
        }

        this.setModel()
        this.setOverlay()
        this.applyMode()
    }

    setModel()
    {
        this.model = {}

        // Element
        this.model.element = document.createElement('video')
        this.model.element.muted = true
        this.model.element.loop = true
        this.model.element.controls = true
        this.model.element.playsInline = true
        this.model.element.autoplay = true
        this.model.element.src = this.sourcePath
        this.model.element.play()

        // Texture
        this.model.texture = new THREE.VideoTexture(this.model.element)
        this.model.texture.encoding = THREE.sRGBEncoding

        // Material
        this.model.material = new THREE.MeshBasicMaterial({
            map: this.model.texture
        })
        this.baseColor = this.model.material.color.clone()

        // Mesh
        this.model.mesh = this.mesh
        this.model.mesh.material = this.model.material
        this.scene.add(this.model.mesh)
    }

    setOverlay()
    {
        const geometry = this.mesh.geometry
        const positions = geometry.attributes.position
        const uvs = geometry.attributes.uv
        this.corners = []

        for(const uv of [[0, 1], [1, 1], [1, 0], [0, 0]])
        {
            let bestIndex = 0
            let bestDistance = Infinity
            for(let i = 0; i < uvs.count; i++)
            {
                const distance = Math.abs(uvs.getX(i) - uv[0]) + Math.abs(uvs.getY(i) - uv[1])
                if(distance < bestDistance)
                {
                    bestDistance = distance
                    bestIndex = i
                }
            }

            this.corners.push(new THREE.Vector3(
                positions.getX(bestIndex),
                positions.getY(bestIndex),
                positions.getZ(bestIndex)
            ))
        }

        this.overlay = { element: document.createElement('div'), iframe: document.createElement('iframe') }
        this.overlay.element.className = 'screen-overlay'
        this.overlay.iframe.setAttribute('title', 'KD Space screen')
        this.overlay.iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture')
        this.overlay.iframe.setAttribute('referrerpolicy', 'no-referrer')
        this.overlay.iframe.src = 'about:blank'
        this.overlay.element.appendChild(this.overlay.iframe)
        document.body.appendChild(this.overlay.element)

        this.overlay.width = 960
        this.overlay.height = 540
        this.overlay.element.style.width = `${this.overlay.width}px`
        this.overlay.element.style.height = `${this.overlay.height}px`

        // Screen-space controls live outside the transformed overlay so they
        // stay a usable size and can receive pointer events.
        this.controls = document.createElement('div')
        this.controls.className = 'screen-controls'
        this.playBtn = document.createElement('button')
        this.playBtn.className = 'screen-control'
        this.playBtn.textContent = '❚❚'
        this.playBtn.title = 'Pause'
        this.muteBtn = document.createElement('button')
        this.muteBtn.className = 'screen-control'
        this.muteBtn.textContent = '🔊'
        this.muteBtn.title = 'Unmute'
        this.playBtn.addEventListener('click', (_event) =>
        {
            _event.stopPropagation()
            this.togglePlay()
        })
        this.muteBtn.addEventListener('click', (_event) =>
        {
            _event.stopPropagation()
            this.toggleMute()
        })
        this.controls.append(this.playBtn, this.muteBtn)
        document.body.appendChild(this.controls)

        this.isPlaying = true
        this.isMuted = true

        this.cameraInstance = this.camera.instance
        this.projected = this.corners.map(() => new THREE.Vector3())
    }

    sendYoutubeCommand(_function)
    {
        try
        {
            this.overlay.iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: _function, args: '' }),
                'https://www.youtube.com'
            )
        }
        catch(_error)
        {
            // The iframe may not be ready yet; the next click will work.
        }
    }

    togglePlay()
    {
        this.isPlaying = !this.isPlaying
        this.sendYoutubeCommand(this.isPlaying ? 'playVideo' : 'pauseVideo')
        this.playBtn.textContent = this.isPlaying ? '❚❚' : '▶'
        this.playBtn.title = this.isPlaying ? 'Pause' : 'Play'
    }

    toggleMute()
    {
        this.isMuted = !this.isMuted
        this.sendYoutubeCommand(this.isMuted ? 'mute' : 'unMute')
        this.muteBtn.textContent = this.isMuted ? '🔊' : '🔇'
        this.muteBtn.title = this.isMuted ? 'Unmute' : 'Mute'
    }

    getEmbedUrl()
    {
        if(this.settings.mode === 'youtube')
        {
            const youtube = parseYouTube(this.settings.youtubeUrl)
            return youtube ? youtube.embed : null
        }
        if(this.settings.mode === 'site') return this.settings.siteUrl
        return null
    }

    applyMode()
    {
        const embed = this.settings.mode === 'site'
            ? effectiveEmbedUrl(this.getEmbedUrl())
            : this.getEmbedUrl()

        if(embed && this.overlay.iframe.src !== embed) this.overlay.iframe.src = embed
        if(!embed) this.overlay.iframe.src = 'about:blank'

        this.overlay.element.style.display = embed ? 'block' : 'none'
        this.controls.style.display = this.settings.mode === 'youtube' ? 'flex' : 'none'

        if(this.settings.mode === 'youtube')
        {
            // A fresh iframe restarts autoplay muted, so reset our button state.
            this.isPlaying = true
            this.isMuted = true
            this.playBtn.textContent = '❚❚'
            this.playBtn.title = 'Pause'
            this.muteBtn.textContent = '🔊'
            this.muteBtn.title = 'Unmute'
        }

        if(this.settings.mode === 'off')
        {
            this.model.element.pause()
            this.model.material.map = null
            this.model.material.color.set(0x000000)
        }
        else
        {
            if(this.model.element.paused) this.model.element.play().catch(() => {})
            this.model.material.map = this.model.texture
            this.model.material.color.copy(this.baseColor)
        }

        this.model.material.needsUpdate = true
    }

    setSetting(_key, _value)
    {
        if(!( _key in this.settings)) return
        this.settings[_key] = _value
        this.applyMode()
    }

    getSettings()
    {
        return { ...this.settings }
    }

    getPanelTarget()
    {
        if(this.settings.mode === 'youtube')
        {
            const youtube = parseYouTube(this.settings.youtubeUrl)
            return youtube
                ? { url: youtube.watch, embedUrl: youtube.embed, label: 'YouTube' }
                : null
        }

        if(this.settings.mode === 'site')
        {
            return { url: this.settings.siteUrl, embedUrl: this.settings.siteUrl, label: 'Live site' }
        }

        return null
    }

    openPanel()
    {
        const target = this.getPanelTarget()
        if(!target || !this.experience.mediaPanel) return false
        this.experience.mediaPanel.open(target)
        return true
    }

    update()
    {
        if(this.settings.mode !== 'youtube' && this.settings.mode !== 'site') return

        this.mesh.updateWorldMatrix(true, false)
        this.cameraInstance.updateMatrixWorld()

        const width = this.sizes.width
        const height = this.sizes.height
        let visible = true

        for(let i = 0; i < this.corners.length; i++)
        {
            this.projected[i].copy(this.corners[i])
                .applyMatrix4(this.mesh.matrixWorld)
                .project(this.cameraInstance)

            if(this.projected[i].z < -1 || this.projected[i].z > 1) visible = false
        }

        if(!visible)
        {
            this.overlay.element.style.visibility = 'hidden'
            this.controls.style.visibility = 'hidden'
            return
        }

        const destination = this.projected.map((_point) => [
            (_point.x * 0.5 + 0.5) * width,
            (-_point.y * 0.5 + 0.5) * height
        ])

        // Position the fixed-size controls at the bottom edge of the screen.
        if(this.settings.mode === 'youtube')
        {
            const x = (destination[2][0] + destination[3][0]) / 2
            const y = (destination[2][1] + destination[3][1]) / 2
            this.controls.style.left = `${x}px`
            this.controls.style.top = `${y - 20}px`
            this.controls.style.visibility = 'visible'
        }

        const h = solveHomography(destination)
        if(!h) return

        const w = this.overlay.width
        const hgt = this.overlay.height
        const transform = [
            h[0] / w, h[3] / w, 0, h[6] / w,
            h[1] / hgt, h[4] / hgt, 0, h[7] / hgt,
            0, 0, 1, 0,
            h[2], h[5], 0, 1
        ]

        this.overlay.element.style.visibility = 'visible'
        this.overlay.element.style.transform = `matrix3d(${transform.map((_value) => _value.toFixed(6)).join(',')})`
    }
}
