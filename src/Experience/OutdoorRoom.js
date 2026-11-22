import * as THREE from 'three'

import Experience from './Experience.js'

// A second area in the same world. The turf, grass and mailbox are modelled in
// Blender and loaded as one GLB; visitor submissions are placed in `modelsGroup`
// so uploaded models can only ever appear out here, never inside the room.
export default class OutdoorRoom
{
    constructor()
    {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        this.center = new THREE.Vector3(14, 0, 0)
        this.spawnIndex = 0

        this.setModel()
        this.setLights()
    }

    setModel()
    {
        this.model = {}
        this.model.group = new THREE.Group()
        this.model.group.name = 'Outdoor Room'
        this.model.group.position.copy(this.center)

        if(this.resources.items.outdoorRoomModel)
        {
            const scenery = this.resources.items.outdoorRoomModel.scene
            scenery.name = 'Outdoor Scenery'
            scenery.traverse((_child) =>
            {
                if(_child.isMesh)
                {
                    _child.castShadow = true
                    _child.receiveShadow = true
                    if(_child.material)
                    {
                        const materials = Array.isArray(_child.material) ? _child.material : [_child.material]
                        for(const material of materials) material.side = THREE.DoubleSide
                    }
                }
            })
            this.model.group.add(scenery)
        }

        this.modelsGroup = new THREE.Group()
        this.modelsGroup.name = 'Outdoor Uploads'
        this.model.group.add(this.modelsGroup)

        // Scenery is not a Studio catalog item and is not part of a saved layout.
        this.model.group.userData.kdSystem = true
        this.scene.add(this.model.group)
    }

    setLights()
    {
        // The baked interior uses its own shader, so daylight here does not
        // change the room. It only makes the courtyard readable.
        this.sun = new THREE.DirectionalLight(0xffffff, 0.85)
        this.sun.position.set(14, 12, 6)
        this.sun.userData.kdSystem = true
        this.scene.add(this.sun)

        this.sky = new THREE.HemisphereLight(0x9fd6ff, 0x245d2a, 0.35)
        this.sky.userData.kdSystem = true
        this.scene.add(this.sky)
    }

    getSpawnPosition()
    {
        const slot = this.spawnIndex++
        const ring = Math.floor(slot / 6)
        const angle = (slot % 6) / 6 * Math.PI * 2
        const radius = 1.6 + ring * 1.1

        return new THREE.Vector3(
            this.center.x + Math.cos(angle) * radius,
            0.55,
            this.center.z + Math.sin(angle) * radius + 1.6
        )
    }

    addModel(_object, _position = null)
    {
        if(!_object) return null

        const position = _position || this.getSpawnPosition()
        if(Array.isArray(position)) _object.position.fromArray(position)
        else _object.position.copy(position)

        this.modelsGroup.add(_object)
        return _object
    }

    contains(_object)
    {
        let parent = _object
        while(parent)
        {
            if(parent === this.modelsGroup) return true
            parent = parent.parent
        }
        return false
    }
}
