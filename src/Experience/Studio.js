import * as THREE from 'three'
import Experience from './Experience.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default class Studio
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.renderer = this.experience.renderer
        this.time = this.experience.time
        this.sizes = this.experience.sizes
        this.navigation = this.experience.navigation
        this.resources = this.experience.resources

        this.active = false
        this.objects = []
        this.selectedIndex = -1

        // Layout persistence (browser-side; no backend required)
        this.storageKey = 'kd-space-studio-layout-v1'
        this.hasRestoredInitialLayout = false

        // Default catalog: the objects already in the scene at startup.
        this.stockCatalog = new Map()
        this.stockDefaults = new Map()
        this.hasCollectedStock = false

        this.gltfLoader = new GLTFLoader()

        this.setOrbitControls()
        this.setTransformControls()
        this.setEnvironment()
        this.setUI()

        // Populate the catalog and restore a saved layout once all GLBs are ready.
        this.resources.on('end', () =>
        {
            this.collectStockObjects()
            this.restoreInitialLayout()
        })
    }

    setOrbitControls()
    {
        this.orbitControls = new OrbitControls(this.camera.modes.default.instance, this.renderer.instance.domElement)
        this.orbitControls.enabled = false
        this.orbitControls.enableDamping = true
        this.orbitControls.dampingFactor = 0.05
        this.orbitControls.minDistance = 0.5
        this.orbitControls.maxDistance = 20
    }

    setTransformControls()
    {
        this.transformControls = new TransformControls(this.camera.modes.default.instance, this.renderer.instance.domElement)
        this.transformControls.setSize(0.8)
        this.transformControls.addEventListener('dragging-changed', (event) =>
        {
            this.orbitControls.enabled = !event.value
        })
    }

    setEnvironment()
    {
        this.gridHelper = new THREE.GridHelper(10, 20, 0x888888, 0x444444)
        this.gridHelper.visible = false
        this.scene.add(this.gridHelper)

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        this.ambientLight.visible = false
        this.scene.add(this.ambientLight)

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        this.directionalLight.position.set(5, 10, 5)
        this.directionalLight.visible = false
        this.scene.add(this.directionalLight)

        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.4)
        this.hemisphereLight.visible = false
        this.scene.add(this.hemisphereLight)
    }

    setUI()
    {
        this.panel = document.querySelector('.studio-panel')
        this.uploadBtn = document.querySelector('.studio-upload-btn')
        this.fileInput = document.querySelector('.studio-file-input')
        this.objectList = document.querySelector('.studio-object-list')
        this.removeBtn = document.querySelector('.studio-remove-btn')
        this.transformBtns = document.querySelectorAll('.studio-transform-btn')
        this.modeBtn = document.querySelector('.studio-mode-btn')
        this.closeBtn = document.querySelector('.studio-panel-close')
        this.saveBtn = document.querySelector('.studio-save-btn')
        this.loadBtn = document.querySelector('.studio-load-btn')
        this.shareBtn = document.querySelector('.studio-share-btn')
        this.resetBtn = document.querySelector('.studio-reset-btn')
        this.statusEl = document.querySelector('.studio-status')

        this.saveBtn.addEventListener('click', () => this.saveLayout())
        this.loadBtn.addEventListener('click', () => this.loadLayout())
        this.shareBtn.addEventListener('click', () => this.copyShareLink())
        this.resetBtn.addEventListener('click', () => this.resetLayout())
        this.modeBtn.addEventListener('click', () => this.toggle())
        this.closeBtn.addEventListener('click', () => this.toggle())
        this.uploadBtn.addEventListener('click', () => this.fileInput.click())
        this.fileInput.addEventListener('change', (event) => this.handleUpload(event))
        this.removeBtn.addEventListener('click', () => this.removeSelected())

        this.transformBtns.forEach(btn =>
        {
            btn.addEventListener('click', () =>
            {
                const mode = btn.dataset.mode
                this.transformControls.setMode(mode)
                this.transformBtns.forEach(b => b.classList.remove('active'))
                btn.classList.add('active')
            })
        })

        document.querySelector('.studio-add-cube').addEventListener('click', () => this.addPrimitive('box'))
        document.querySelector('.studio-add-sphere').addEventListener('click', () => this.addPrimitive('sphere'))
        document.querySelector('.studio-add-cylinder').addEventListener('click', () => this.addPrimitive('cylinder'))
        document.querySelector('.studio-add-plane').addEventListener('click', () => this.addPrimitive('plane'))
        document.querySelector('.studio-add-plant').addEventListener('click', () => this.addPlant())
        document.querySelector('.studio-add-lamp').addEventListener('click', () => this.addLamp())

        this.setScreenUI()
    }

    setScreenUI()
    {
        this.screenConfigs = document.querySelectorAll('.studio-screen-config')

        this.screenConfigs.forEach((config) =>
        {
            const key = config.dataset.screen
            const mode = config.querySelector('.studio-screen-mode')
            const youtube = config.querySelector('.studio-screen-youtube')
            const site = config.querySelector('.studio-screen-site')

            mode.addEventListener('change', () =>
            {
                this.experience.world.updateScreenSetting(key, 'mode', mode.value)
                this.syncScreenFields()
            })
            youtube.addEventListener('change', () =>
                this.experience.world.updateScreenSetting(key, 'youtubeUrl', youtube.value))
            site.addEventListener('change', () =>
                this.experience.world.updateScreenSetting(key, 'siteUrl', site.value))
        })

        document.querySelector('.studio-kracked-link').addEventListener('click', () =>
        {
            window.open('https://krackeddevs.com', '_blank', 'noopener,noreferrer')
        })

        this.syncScreenFields()
    }

    syncScreenFields()
    {
        const world = this.experience.world
        if(!world || !world.getScreenSettings) return
        const settings = world.getScreenSettings()
        if(!settings) return

        this.screenConfigs.forEach((config) =>
        {
            const values = settings[config.dataset.screen]
            if(!values) return
            config.querySelector('.studio-screen-mode').value = values.mode
            config.querySelector('.studio-screen-youtube').value = values.youtubeUrl
            config.querySelector('.studio-screen-site').value = values.siteUrl
        })
    }

    collectStockObjects()
    {
        if(this.hasCollectedStock) return
        this.hasCollectedStock = true

        // Everything World adds is a catalog item; Studio's own helpers are not.
        const studioHelpers = new Set([
            this.camera.instance,
            this.gridHelper,
            this.ambientLight,
            this.directionalLight,
            this.hemisphereLight,
            this.transformControls
        ])

        let index = 0
        for(const object of [ ...this.scene.children ])
        {
            if(studioHelpers.has(object) || object.isLight || object.isCamera || object.userData.kdSystem) continue

            index++
            const id = `stock-${index}`
            object.userData.kdSource = { kind: 'stock', id }
            if(!object.name) object.name = `Scene Object ${index}`

            this.stockCatalog.set(id, object)
            this.stockDefaults.set(id, {
                position: object.position.toArray(),
                rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
                scale: object.scale.toArray()
            })
            this.objects.push(object)
        }

        this.updateObjectList()
    }

    toggle()
    {
        this.active = !this.active
        this.panel.classList.toggle('visible', this.active)
        this.modeBtn.classList.toggle('active', this.active)
        this.modeBtn.textContent = this.active ? 'Exit Studio' : 'Studio'

        this.gridHelper.visible = this.active
        this.ambientLight.visible = this.active
        this.directionalLight.visible = this.active
        this.hemisphereLight.visible = this.active

        if(this.active)
        {
            this.syncScreenFields()

            this.orbitControls.target.copy(this.navigation.view.target.smoothed)
            this.orbitControls.update()

            if(this.objects.length > 0 && this.selectedIndex < 0)
                this.selectObject(0)
        }
        else
        {
            this.transformControls.detach()
            this.scene.remove(this.transformControls)
        }
    }

    handleUpload(event)
    {
        const file = event.target.files[0]
        if(!file) return

        const url = URL.createObjectURL(file)
        this.gltfLoader.load(url, (gltf) =>
        {
            const model = gltf.scene
            this.normalizeModel(model)

            // Keep the raw file so uploaded models survive a Save/Load cycle.
            const reader = new FileReader()
            reader.onload = () =>
            {
                const group = this.wrapModel(model, {
                    kind: 'upload',
                    name: file.name,
                    dataUrl: reader.result
                })
                group.name = file.name
                this.addObject(group)
            }
            reader.onerror = () =>
            {
                const group = this.wrapModel(model, { kind: 'upload', name: file.name })
                group.name = file.name
                this.addObject(group)
            }
            reader.readAsDataURL(file)

            URL.revokeObjectURL(url)
        }, undefined, (error) =>
        {
            console.error('Failed to load model:', error)
            URL.revokeObjectURL(url)
            this.setStatus('Could not read that model file.', 'error')
        })
        event.target.value = ''
    }

    normalizeModel(_model)
    {
        const box = new THREE.Box3().setFromObject(_model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        if(maxDim > 0)
            _model.scale.setScalar(2 / maxDim)

        const center = box.getCenter(new THREE.Vector3())
        _model.position.set(
            -center.x * _model.scale.x,
            -center.y * _model.scale.y,
            -center.z * _model.scale.z
        )
    }

    wrapModel(_model, _source)
    {
        // The wrapper owns the user-facing transform; the inner model keeps
        // its auto-scale / auto-center offset so Save/Load doesn't double it.
        const group = new THREE.Group()
        group.add(_model)
        group.userData.kdSource = _source
        return group
    }

    createPrimitiveGeometry(_type)
    {
        switch(_type)
        {
            case 'box': return new THREE.BoxGeometry(1, 1, 1)
            case 'sphere': return new THREE.SphereGeometry(0.5, 32, 32)
            case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
            case 'plane': return new THREE.PlaneGeometry(1, 1)
            default: return null
        }
    }

    addPrimitive(type)
    {
        const geometry = this.createPrimitiveGeometry(type)
        if(!geometry) return

        const material = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.5, metalness: 0.5 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0.5, 0)
        mesh.userData.kdSource = { kind: 'primitive', shape: type }
        this.addObject(mesh)
    }

    addPlant()
    {
        if(!this.resources.items.deskPlantModel) return

        // Clone the loaded GLB so every placed plant is an independent object.
        const model = this.resources.items.deskPlantModel.scene.clone(true)
        model.name = 'Desk Plant'
        model.userData.kdSource = { kind: 'plant' }
        this.prepareModelMaterials(model)

        this.addObject(model)
    }

    addLamp()
    {
        if(!this.resources.items.deskLampModel) return

        const model = this.resources.items.deskLampModel.scene.clone(true)
        model.name = 'Desk Lamp'
        model.userData.kdSource = { kind: 'lamp' }
        this.prepareModelMaterials(model)

        this.addObject(model)
    }

    prepareModelMaterials(_object)
    {
        _object.traverse((_child) =>
        {
            if(!_child.isMesh) return
            const materials = Array.isArray(_child.material) ? _child.material : [_child.material]
            for(const _material of materials)
            {
                if(_material)
                    _material.side = THREE.DoubleSide
            }
        })
    }

    addObject(object)
    {
        object.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.material = child.material || new THREE.MeshStandardMaterial()
            }
        })
        this.scene.add(object)
        this.objects.push(object)
        this.selectedIndex = this.objects.length - 1
        this.selectObject(this.selectedIndex)
        this.updateObjectList()
    }

    selectObject(index)
    {
        if(this.selectedIndex >= 0 && this.objects[this.selectedIndex])
        {
            this.scene.remove(this.transformControls)
        }

        this.selectedIndex = index

        if(index >= 0 && this.objects[index])
        {
            this.transformControls.attach(this.objects[index])
            this.scene.add(this.transformControls)
            this.updateObjectList()
        }
    }

    removeSelected()
    {
        if(this.selectedIndex < 0 || !this.objects[this.selectedIndex]) return

        const obj = this.objects[this.selectedIndex]
        this.scene.remove(obj)
        this.transformControls.detach()
        this.objects.splice(this.selectedIndex, 1)
        this.selectedIndex = -1
        this.updateObjectList()
    }

    updateObjectList()
    {
        this.objectList.innerHTML = ''
        this.objects.forEach((obj, index) =>
        {
            const item = document.createElement('div')
            item.className = 'studio-object-item'
            if(index === this.selectedIndex) item.classList.add('selected')
            item.textContent = obj.name || `Object ${index + 1}`
            item.addEventListener('click', () => this.selectObject(index))
            this.objectList.appendChild(item)
        })
    }

    setStatus(_message, _type = '')
    {
        if(!this.statusEl) return
        this.statusEl.textContent = _message
        this.statusEl.className = 'studio-status' + (_type ? ' ' + _type : '')
    }

    serializeObjects(_objects)
    {
        return _objects.map((_object) =>
        {
            const source = _object.userData.kdSource || { kind: 'unknown' }
            return {
                name: _object.name,
                source: source,
                position: _object.position.toArray(),
                rotation: [_object.rotation.x, _object.rotation.y, _object.rotation.z],
                scale: _object.scale.toArray()
            }
        })
    }

    saveLayout()
    {
        if(this.objects.length === 0)
        {
            this.setStatus('Nothing to save — add objects first.', 'error')
            return
        }

        const layout = {
            version: 1,
            objects: this.serializeObjects(this.objects)
        }

        try
        {
            localStorage.setItem(this.storageKey, JSON.stringify(layout))

            // A previously copied share link would otherwise override this save.
            if(window.location.hash)
                window.history.replaceState(null, '', window.location.pathname + window.location.search)

            this.setStatus(`Saved ${this.objects.length} object(s).`, 'success')
        }
        catch(_error)
        {
            console.error('KD Space: could not save layout', _error)
            this.setStatus('Save failed — browser storage may be full.', 'error')
        }
    }

    encodeShareLayout()
    {
        // Only encode what differs from the default scene: removed stock ids,
        // changed stock transforms, and added objects. The receiver rebuilds
        // the full catalog, so links stay short even with 27 scene objects.
        const removed = []
        const modified = []
        const added = []

        for(const [id] of this.stockDefaults)
        {
            const object = this.objects.find((_object) => _object.userData.kdSource?.id === id)
            if(!object)
            {
                removed.push(id)
                continue
            }

            const current = {
                position: object.position.toArray(),
                rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
                scale: object.scale.toArray()
            }

            if(!this.transformsMatch(current, this.stockDefaults.get(id)))
            {
                modified.push({
                    i: id,
                    p: current.position,
                    r: current.rotation,
                    c: current.scale
                })
            }
        }

        for(const object of this.objects)
        {
            const source = object.userData.kdSource || {}
            if(source.kind === 'stock' || source.kind === 'upload') continue

            added.push({
                n: object.name || '',
                t: source.kind,
                s: source.shape || '',
                p: object.position.toArray(),
                r: [object.rotation.x, object.rotation.y, object.rotation.z],
                c: object.scale.toArray()
            })
        }

        const json = JSON.stringify({ v: 2, r: removed, m: modified, u: added })
        return btoa(unescape(encodeURIComponent(json)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
    }

    transformsMatch(_a, _b)
    {
        if(!_a || !_b) return false

        return [['position', 'position'], ['rotation', 'rotation'], ['scale', 'scale']]
            .every(([keyA, keyB]) =>
            {
                const a = _a[keyA]
                const b = _b[keyB]
                return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
                    a.every((_value, _index) => Math.abs(_value - b[_index]) < 1e-6)
            })
    }

    decodeLayout(_value)
    {
        try
        {
            const padded = _value.replace(/-/g, '+').replace(/_/g, '/')
            const json = decodeURIComponent(escape(atob(padded)))
            const compact = JSON.parse(json)
            if(!compact) return null

            if(compact.v === 2)
            {
                const removed = Array.isArray(compact.r) ? compact.r : []
                const modified = new Map(
                    (Array.isArray(compact.m) ? compact.m : []).map((_entry) => [_entry.i, _entry])
                )
                const objects = []

                for(const [id, defaults] of this.stockDefaults)
                {
                    if(removed.includes(id)) continue

                    const stock = this.stockCatalog.get(id)
                    const change = modified.get(id)
                    objects.push({
                        name: stock ? stock.name : `Scene Object ${id}`,
                        source: { kind: 'stock', id },
                        position: change && Array.isArray(change.p) ? change.p : defaults.position,
                        rotation: change && Array.isArray(change.r) ? change.r : defaults.rotation,
                        scale: change && Array.isArray(change.c) ? change.c : defaults.scale
                    })
                }

                for(const entry of (Array.isArray(compact.u) ? compact.u : []))
                {
                    objects.push({
                        name: entry.n,
                        source: entry.t === 'primitive'
                            ? { kind: 'primitive', shape: entry.s }
                            : { kind: entry.t },
                        position: entry.p,
                        rotation: entry.r,
                        scale: entry.c
                    })
                }

                return { version: 2, objects }
            }

            // Legacy links from before the compact format.
            if(!Array.isArray(compact.o)) return null

            return {
                version: 1,
                objects: compact.o.map((_object) => ({
                    name: _object.n,
                    source: _object.t === 'primitive'
                        ? { kind: 'primitive', shape: _object.s }
                        : _object.t === 'stock'
                            ? { kind: 'stock', id: _object.i }
                            : { kind: _object.t },
                    position: _object.p,
                    rotation: _object.r,
                    scale: _object.c
                }))
            }
        }
        catch(_error)
        {
            return null
        }
    }

    readSharedLayout()
    {
        const match = window.location.hash.match(/space=([^&]+)/)
        if(!match) return null
        return this.decodeLayout(decodeURIComponent(match[1]))
    }

    async copyShareLink()
    {
        if(this.objects.length === 0)
        {
            this.setStatus('Nothing to share — add objects first.', 'error')
            return
        }

        const shareable = this.objects.filter((_object) =>
            _object.userData.kdSource?.kind !== 'upload'
        )
        const excluded = this.objects.length - shareable.length

        if(shareable.length === 0)
        {
            this.setStatus('Uploaded models cannot be shared by link.', 'error')
            return
        }

        const encoded = this.encodeShareLayout()
        const url = `${window.location.origin}${window.location.pathname}#space=${encoded}`
        window.history.replaceState(null, '', url)

        let copied = false
        try
        {
            await navigator.clipboard.writeText(url)
            copied = true
        }
        catch(_error)
        {
            // The hash is still set, so the URL bar is a usable fallback.
        }

        const note = excluded > 0 ? ` (${excluded} uploaded model(s) excluded)` : ''
        this.setStatus(
            copied ? `Share link copied${note}.` : `Link is in the address bar${note}.`,
            'success'
        )
    }

    resetLayout()
    {
        if(!this.hasCollectedStock)
        {
            this.setStatus('Default catalog is not ready yet.', 'error')
            return
        }

        if(!window.confirm('Reset the space to the default scene? Your saved layout and share link will be removed.'))
            return

        try
        {
            localStorage.removeItem(this.storageKey)
        }
        catch(_error)
        {
            console.error('KD Space: could not clear saved layout', _error)
        }

        // A share hash would otherwise restore the old layout on the next reload.
        if(window.location.hash)
            window.history.replaceState(null, '', window.location.pathname + window.location.search)

        this.clearObjects()

        for(const [id, defaults] of this.stockDefaults)
        {
            const object = this.stockCatalog.get(id)
            if(!object) continue

            if(Array.isArray(defaults.position)) object.position.fromArray(defaults.position)
            if(Array.isArray(defaults.rotation)) object.rotation.set(...defaults.rotation)
            if(Array.isArray(defaults.scale)) object.scale.fromArray(defaults.scale)

            object.userData.kdSource = { kind: 'stock', id }
            this.scene.add(object)
            this.objects.push(object)
        }

        if(this.active && this.objects.length > 0)
            this.selectObject(0)
        else
            this.updateObjectList()

        this.setStatus(`Restored ${this.objects.length} default object(s).`, 'success')
    }

    restoreInitialLayout()
    {
        if(this.hasRestoredInitialLayout) return
        this.hasRestoredInitialLayout = true

        // Never wipe objects the user may have already placed this session.
        // Stock catalog items don't count — they are recreated every load.
        const hasUserObjects = this.objects.some((_object) =>
            _object.userData.kdSource?.kind !== 'stock'
        )
        if(hasUserObjects) return

        // A shared link takes priority over the browser's saved layout.
        const shared = this.readSharedLayout()
        if(shared)
        {
            this.loadLayout(shared)
            return
        }

        try
        {
            if(localStorage.getItem(this.storageKey))
                this.loadLayout()
        }
        catch(_error)
        {
            console.error('KD Space: could not read saved layout', _error)
        }
    }

    async loadLayout(_layout = null)
    {
        let layout = _layout

        if(!layout)
        {
            let json = null
            try
            {
                json = localStorage.getItem(this.storageKey)
            }
            catch(_error)
            {
                this.setStatus('Browser storage is unavailable.', 'error')
                return
            }

            if(!json)
            {
                this.setStatus('No saved layout found.', 'error')
                return
            }

            try
            {
                layout = JSON.parse(json)
            }
            catch(_error)
            {
                this.setStatus('Saved layout could not be read.', 'error')
                return
            }
        }

        if(!layout || !Array.isArray(layout.objects))
        {
            this.setStatus('Saved layout is invalid.', 'error')
            return
        }

        this.clearObjects()

        let restored = 0
        for(const entry of layout.objects)
        {
            const object = await this.restoreObject(entry)
            if(!object) continue

            this.scene.add(object)
            this.objects.push(object)

            if(Array.isArray(entry.position)) object.position.fromArray(entry.position)
            if(Array.isArray(entry.rotation)) object.rotation.set(entry.rotation[0], entry.rotation[1], entry.rotation[2])
            if(Array.isArray(entry.scale)) object.scale.fromArray(entry.scale)

            restored++
        }

        if(this.active && this.objects.length > 0)
            this.selectObject(0)
        else
            this.updateObjectList()

        this.setStatus(`Loaded ${restored} object(s).`, 'success')
    }

    clearObjects()
    {
        this.transformControls.detach()
        this.scene.remove(this.transformControls)

        for(const object of this.objects)
            this.scene.remove(object)

        this.objects = []
        this.selectedIndex = -1
    }

    async restoreObject(_entry)
    {
        if(!_entry || !_entry.source) return null

        const source = _entry.source

        if(source.kind === 'stock')
        {
            // Original scene objects are cached before any are removed.
            const stock = this.stockCatalog.get(source.id)
            if(!stock) return null

            // Reset to the startup transform before the saved transform is applied.
            const defaults = this.stockDefaults.get(source.id)
            if(defaults)
            {
                if(Array.isArray(defaults.position)) stock.position.fromArray(defaults.position)
                if(Array.isArray(defaults.rotation)) stock.rotation.set(...defaults.rotation)
                if(Array.isArray(defaults.scale)) stock.scale.fromArray(defaults.scale)
            }

            return stock
        }

        if(source.kind === 'primitive')
        {
            const geometry = this.createPrimitiveGeometry(source.shape)
            if(!geometry) return null

            const material = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.5, metalness: 0.5 })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.userData.kdSource = { kind: 'primitive', shape: source.shape }
            if(_entry.name) mesh.name = _entry.name
            return mesh
        }

        if(source.kind === 'plant')
        {
            if(!this.resources.items.deskPlantModel) return null

            const model = this.resources.items.deskPlantModel.scene.clone(true)
            model.userData.kdSource = { kind: 'plant' }
            this.prepareModelMaterials(model)
            if(_entry.name) model.name = _entry.name
            return model
        }

        if(source.kind === 'lamp')
        {
            if(!this.resources.items.deskLampModel) return null

            const model = this.resources.items.deskLampModel.scene.clone(true)
            model.userData.kdSource = { kind: 'lamp' }
            this.prepareModelMaterials(model)
            if(_entry.name) model.name = _entry.name
            return model
        }

        if(source.kind === 'upload' && source.dataUrl)
        {
            return new Promise((_resolve) =>
            {
                this.gltfLoader.load(source.dataUrl, (gltf) =>
                {
                    const model = gltf.scene
                    this.normalizeModel(model)

                    const group = this.wrapModel(model, source)
                    group.name = _entry.name || source.name || 'Model'
                    this.prepareModelMaterials(group)
                    _resolve(group)
                }, undefined, () => _resolve(null))
            })
        }

        return null
    }

    update()
    {
        if(!this.active) return

        this.orbitControls.update()
    }

    destroy()
    {
        this.objects.forEach(obj => this.scene.remove(obj))
        this.scene.remove(this.gridHelper)
        this.scene.remove(this.ambientLight)
        this.scene.remove(this.directionalLight)
        this.scene.remove(this.hemisphereLight)
        this.transformControls.dispose()
        this.orbitControls.dispose()
    }
}