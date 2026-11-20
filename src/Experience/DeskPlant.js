import * as THREE from 'three'

import Experience from './Experience.js'

export default class DeskPlant
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

        // Clone so Studio Mode can create independent copies from the same resource.
        this.model.group = this.resources.items.deskPlantModel.scene.clone(true)
        this.model.group.name = 'Desk Plant'

        // Fixed position on the desk, beside the monitors.
        // Blender Z-up (x, y, z) maps to Three.js Y-up (x, z, -y).
        this.model.group.position.set(2.75, 1.97, -4.25)

        this.model.group.traverse((_child) =>
        {
            if(!_child.isMesh) return

            _child.castShadow = true
            _child.receiveShadow = true

            // The exported leaves are single-sided planes in Blender.
            const materials = Array.isArray(_child.material) ? _child.material : [_child.material]
            for(const _material of materials)
            {
                if(_material)
                    _material.side = THREE.DoubleSide
            }
        })

        this.scene.add(this.model.group)
    }
}
