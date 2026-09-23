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

        this.active = false
        this.objects = []
        this.selectedIndex = -1

        this.gltfLoader = new GLTFLoader()

        this.setOrbitControls()
        this.setTransformControls()
        this.setEnvironment()
        this.setUI()
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
            model.scale.setScalar(0.01)
            model.position.set(0, 0, 0)
            this.addObject(model)
            URL.revokeObjectURL(url)
        }, undefined, (error) =>
        {
            console.error('Failed to load model:', error)
            URL.revokeObjectURL(url)
        })
        event.target.value = ''
    }

    addPrimitive(type)
    {
        let geometry
        switch(type)
        {
            case 'box': geometry = new THREE.BoxGeometry(1, 1, 1); break
            case 'sphere': geometry = new THREE.SphereGeometry(0.5, 32, 32); break
            case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break
            case 'plane': geometry = new THREE.PlaneGeometry(1, 1); break
        }
        const material = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.5, metalness: 0.5 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0.5, 0)
        this.addObject(mesh)
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