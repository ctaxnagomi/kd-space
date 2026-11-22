import Experience from './Experience.js'

export default class ScreenCapture
{
    constructor()
    {
        this.experience = new Experience()
        this.mediaPanel = this.experience.mediaPanel

        this.active = false
        this.screen = null
        this.stream = null
        this.video = null
        this.surface = null
    }

    async start(_screen)
    {
        if(this.active) return false
        if(!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return false
        if(!this.mediaPanel || !this.mediaPanel.element.classList.contains('visible')) return false

        try
        {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            })
        }
        catch(_error)
        {
            // The visitor dismissed the browser's share picker.
            return false
        }

        const track = this.stream.getVideoTracks()[0]
        if(!track)
        {
            this.stop()
            return false
        }

        const settings = typeof track.getSettings === 'function' ? track.getSettings() : {}
        this.surface = settings.displaySurface || 'browser'

        this.video = document.createElement('video')
        this.video.srcObject = this.stream
        this.video.muted = true
        this.video.playsInline = true
        this.video.autoplay = true
        this.video.play().catch(() => {})

        this.screen = _screen
        this.active = true
        this.screen.setProjection(true)
        if(this.mediaPanel) this.mediaPanel.setProjecting(true)

        track.addEventListener('ended', () => this.stop())
        return true
    }

    stop()
    {
        if(!this.active && !this.stream) return

        if(this.screen) this.screen.setProjection(false)
        if(this.stream)
        {
            for(const track of this.stream.getTracks()) track.stop()
            this.stream = null
        }
        if(this.video)
        {
            this.video.srcObject = null
            this.video = null
        }
        if(this.mediaPanel) this.mediaPanel.setProjecting(false)

        this.screen = null
        this.active = false
        this.surface = null
    }

    render()
    {
        if(!this.active || !this.video || !this.screen) return
        if(this.video.readyState < 2 || !this.video.videoWidth) return

        const canvas = this.screen.getProjectionCanvas()
        if(!canvas) return
        const context = canvas.getContext('2d')
        if(!context) return

        // A window or whole-screen capture has no panel rectangle to crop to.
        if(this.surface !== 'browser')
        {
            context.drawImage(this.video, 0, 0, canvas.width, canvas.height)
            return
        }

        const rect = this.mediaPanel.frameEl.getBoundingClientRect()
        if(rect.width < 1 || rect.height < 1) return

        const scaleX = this.video.videoWidth / window.innerWidth
        const scaleY = this.video.videoHeight / window.innerHeight
        const sourceX = Math.max(0, rect.left * scaleX)
        const sourceY = Math.max(0, rect.top * scaleY)
        const sourceWidth = Math.min(this.video.videoWidth - sourceX, rect.width * scaleX)
        const sourceHeight = Math.min(this.video.videoHeight - sourceY, rect.height * scaleY)
        if(sourceWidth < 1 || sourceHeight < 1) return

        context.drawImage(
            this.video,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvas.width, canvas.height
        )
    }
}
