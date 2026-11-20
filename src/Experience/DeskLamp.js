import * as THREE from 'three'

import Experience from './Experience.js'

export default class DeskLamp
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

        // Clone so Studio Mode can spawn independent copies from one resource.
        this.model.group = this.resources.items.deskLampModel.scene.clone(true)
        this.model.group.name = 'Desk Lamp'

        // Fixed spot on the desk, beside the plant. Arm points back over the desk.
        // Blender Z-up (x, y, z) maps to Three.js Y-up (x, z, -y).
        this.model.group.position.set(3.3, 1.97, -3.95)
        this.model.group.rotation.y = Math.PI

        this.model.group.traverse((_child) =>
        {
            if(!_child.isMesh) return

            _child.castShadow = true
            _child.receiveShadow = true

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
