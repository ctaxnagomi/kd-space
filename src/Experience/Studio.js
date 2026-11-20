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

        this.gltfLoader = new GLTFLoader()

        this.setOrbitControls()
        this.setTransformControls()
        this.setEnvironment()
        this.setUI()

        // Restore a saved layout once all GLB resources are available.
        this.resources.on('end', () => this.restoreInitialLayout())
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
        this.statusEl = document.querySelector('.studio-status')

        this.saveBtn.addEventListener('click', () => this.saveLayout())
        this.loadBtn.addEventListener('click', () => this.loadLayout())
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

    saveLayout()
    {
        if(this.objects.length === 0)
        {
            this.setStatus('Nothing to save — add objects first.', 'error')
            return
        }

        const layout = {
            version: 1,
            objects: this.objects.map((_object) =>
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

        try
        {
            localStorage.setItem(this.storageKey, JSON.stringify(layout))
            this.setStatus(`Saved ${this.objects.length} object(s).`, 'success')
        }
        catch(_error)
        {
            console.error('KD Space: could not save layout', _error)
            this.setStatus('Save failed — browser storage may be full.', 'error')
        }
    }

    restoreInitialLayout()
    {
        if(this.hasRestoredInitialLayout) return
        this.hasRestoredInitialLayout = true

        // Never wipe objects the user may have already placed this session.
        if(this.objects.length > 0) return

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

    async loadLayout()
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

        let layout
        try
        {
            layout = JSON.parse(json)
        }
        catch(_error)
        {
            this.setStatus('Saved layout could not be read.', 'error')
            return
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