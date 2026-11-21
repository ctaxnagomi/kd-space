import * as THREE from 'three'

import Experience from './Experience.js'

export default class WallPortrait
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        this.setModel()
    }

    setModel()
    {
        this.model = {}

        this.model.group = new THREE.Group()
        this.model.group.name = 'Wall Portrait'

        // Back wall behind the desk, facing into the room (+z).
        this.model.group.position.set(- 2.8, 3.4, - 5.13)

        const texture = this.resources.items.portraitTexture
        texture.encoding = THREE.sRGBEncoding

        // Source photo is 5219x3512 (~3:2). Same proportions as the Blender prop.
        const photoWidth = 1.0
        const photoHeight = photoWidth * 3512 / 5219
        const matBorder = 0.0625
        const frameBorder = 0.055
        const depth = 0.05
        const matWidth = photoWidth + matBorder * 2
        const matHeight = photoHeight + matBorder * 2
        const outerWidth = matWidth + frameBorder * 2
        const outerHeight = matHeight + frameBorder * 2

        const woodMaterial = new THREE.MeshStandardMaterial({
            color: 0x1c1008,
            roughness: 0.42,
            metalness: 0.05
        })
        const matMaterial = new THREE.MeshStandardMaterial({
            color: 0xe8e5d9,
            roughness: 0.92
        })
        const backingMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2118,
            roughness: 0.8
        })
        const photoMaterial = new THREE.MeshBasicMaterial({
            map: texture
        })

        const addBox = (_name, _width, _height, _depth, _x, _y, _z, _material) =>
        {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(_width, _height, _depth),
                _material
            )
            mesh.name = _name
            mesh.position.set(_x, _y, _z)
            mesh.castShadow = true
            mesh.receiveShadow = true
            this.model.group.add(mesh)
        }

        addBox('Portrait Backing', outerWidth, outerHeight, 0.008, 0, 0, - 0.014, backingMaterial)
        addBox('Portrait Mat', matWidth, matHeight, 0.006, 0, 0, 0.001, matMaterial)
        addBox('Frame Top', outerWidth, frameBorder, depth, 0, matHeight / 2 + frameBorder / 2, 0, woodMaterial)
        addBox('Frame Bottom', outerWidth, frameBorder, depth, 0, - matHeight / 2 - frameBorder / 2, 0, woodMaterial)
        addBox('Frame Left', frameBorder, matHeight, depth, - matWidth / 2 - frameBorder / 2, 0, 0, woodMaterial)
        addBox('Frame Right', frameBorder, matHeight, depth, matWidth / 2 + frameBorder / 2, 0, 0, woodMaterial)

        // PlaneGeometry faces +z by default, toward the room.
        this.model.photo = new THREE.Mesh(
            new THREE.PlaneGeometry(photoWidth, photoHeight),
            photoMaterial
        )
        this.model.photo.name = 'Portrait Photo'
        this.model.photo.position.z = 0.005
        this.model.group.add(this.model.photo)

        this.scene.add(this.model.group)
    }
}
