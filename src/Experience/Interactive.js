import * as THREE from 'three'

import Experience from './Experience.js'

export default class Interactive
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.studio = this.experience.studio
        this.world = this.experience.world
        this.domElement = this.experience.renderer.instance.domElement

        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2()
        this.pointerActive = false
        this.clientX = 0
        this.clientY = 0
        this.down = null
        this.hovered = null
        this.targets = []

        this.tooltip = document.querySelector('.interactive-tooltip')
        if(!this.tooltip)
        {
            this.tooltip = document.createElement('div')
            this.tooltip.className = 'interactive-tooltip'
            document.body.appendChild(this.tooltip)
        }

        window.addEventListener('pointermove', (_event) => this.onPointerMove(_event))
        this.domElement.addEventListener('pointerdown', (_event) =>
        {
            this.down = { x: _event.clientX, y: _event.clientY }
        })
        this.domElement.addEventListener('pointerup', (_event) =>
        {
            if(!this.down) return
            const travelled = Math.hypot(_event.clientX - this.down.x, _event.clientY - this.down.y)
            this.down = null
            if(travelled < 6) this.onClick()
        })
    }

    onPointerMove(_event)
    {
        this.clientX = _event.clientX
        this.clientY = _event.clientY
        this.pointerActive = true

        const bounds = this.domElement.getBoundingClientRect()
        this.pointer.x = ((_event.clientX - bounds.left) / bounds.width) * 2 - 1
        this.pointer.y = -((_event.clientY - bounds.top) / bounds.height) * 2 + 1
    }

    refreshTargets()
    {
        const screens = []
        if(this.world && this.world.pcScreen) screens.push(this.world.pcScreen.mesh)
        if(this.world && this.world.macScreen) screens.push(this.world.macScreen.mesh)

        const objects = this.studio ? this.studio.objects : []
        this.targets = [...new Set([...screens, ...objects])]
    }

    getScreenFor(_object)
    {
        if(this.world && this.world.pcScreen && _object === this.world.pcScreen.mesh) return this.world.pcScreen
        if(this.world && this.world.macScreen && _object === this.world.macScreen.mesh) return this.world.macScreen
        return null
    }

    resolveRoot(_object)
    {
        let current = _object
        while(current)
        {
            if(this.targets.includes(current)) return current
            current = current.parent
        }
        return null
    }

    setGlow(_object, _active)
    {
        if(!_object) return

        _object.traverse((_child) =>
        {
            if(!_child.isMesh || !_child.material) return
            const materials = Array.isArray(_child.material) ? _child.material : [_child.material]

            for(const material of materials)
            {
                if(material.emissive)
                {
                    if(_active && !material.userData.kdGlow)
                    {
                        material.userData.kdGlow = {
                            color: material.emissive.getHex(),
                            intensity: material.emissiveIntensity
                        }
                        material.emissive.set(0x00e5ff)
                        material.emissiveIntensity = 0.35
                    }
                    else if(!_active && material.userData.kdGlow)
                    {
                        material.emissive.setHex(material.userData.kdGlow.color)
                        material.emissiveIntensity = material.userData.kdGlow.intensity
                        delete material.userData.kdGlow
                    }
                }
                else if(material.color)
                {
                    if(_active && !material.userData.kdGlow)
                    {
                        material.userData.kdGlow = { color: material.color.getHex() }
                        material.color.offsetHSL(0, 0, 0.12)
                    }
                    else if(!_active && material.userData.kdGlow)
                    {
                        material.color.setHex(material.userData.kdGlow.color)
                        delete material.userData.kdGlow
                    }
                }
            }
        })
    }

    updateTooltip()
    {
        if(!this.hovered)
        {
            this.tooltip.classList.remove('visible')
            document.body.style.cursor = ''
            return
        }

        const screen = this.getScreenFor(this.hovered)
        const name = this.hovered.name || 'Object'
        this.tooltip.textContent = screen ? `${name} · Click to open` : name

        const x = Math.min(this.clientX + 14, window.innerWidth - this.tooltip.offsetWidth - 12)
        const y = Math.min(this.clientY + 14, window.innerHeight - this.tooltip.offsetHeight - 12)
        this.tooltip.style.left = `${Math.max(12, x)}px`
        this.tooltip.style.top = `${Math.max(12, y)}px`
        this.tooltip.classList.add('visible')
        document.body.style.cursor = 'pointer'
    }

    onClick()
    {
        if(!this.hovered) return

        const screen = this.getScreenFor(this.hovered)
        if(screen)
        {
            screen.openPanel()
            return
        }

        if(this.studio && this.studio.active)
        {
            const index = this.studio.objects.indexOf(this.hovered)
            if(index >= 0) this.studio.selectObject(index)
        }
    }

    update()
    {
        if(!this.pointerActive) return
        if(this.studio && this.studio.transformControls && this.studio.transformControls.dragging) return

        this.refreshTargets()
        this.raycaster.setFromCamera(this.pointer, this.camera.instance)
        const intersections = this.raycaster.intersectObjects(this.targets, true)
        const root = intersections.length > 0 ? this.resolveRoot(intersections[0].object) : null

        if(root !== this.hovered)
        {
            this.setGlow(this.hovered, false)
            this.hovered = root
            this.setGlow(this.hovered, true)
            this.updateTooltip()
        }
        else
        {
            this.updateTooltip()
        }
    }
}
