"""
KD Space Blender asset pipeline.

Conventions
-----------
* 1 Blender unit = 1 Three.js world unit. Do not scale at export.
* Model Z-up. The glTF exporter converts to Y-up for Three.js automatically.
* Put the object origin at its contact point (base) on z = 0.
* Small desk props should be roughly 0.2 - 0.7 units tall.
* Name meshes KD_<Prop>_<Part>; these become node names in Three.js.
* Use kd_material() so PBR values and emission survive the GLB export.

Standalone usage
----------------
    blender --background --python kdspace_export.py -- --demo --out <path.glb>
    blender --background --python kdspace_export.py -- --export --out <path.glb>

Import as a module from a custom prop script
--------------------------------------------
    import kdspace_export as kd
    kd.clear_scene()
    ... build with kd.kd_material / kd.kd_beam / kd.kd_leaf ...
    kd.kd_export("C:/path/to/static/assets/myProp.glb")
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector


# ----------------------------------------------------------------------------
# Scene helpers
# ----------------------------------------------------------------------------

def clear_scene():
    """Remove every object from the current scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def kd_material(name, color, roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0):
    """Create a PBR material that exports cleanly to glTF.

    emission is an optional (r, g, b) tuple. Blender's emission strength is
    written as KHR_materials_emissive_strength, which Three.js reads.
    """
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    if material.node_tree is None:
        material.use_nodes = True

    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    return material


def kd_beam(name, start, end, radius, material, vertices=20):
    """Cylinder between two points, sized and oriented automatically."""
    a, b = Vector(start), Vector(end)
    direction = b - a

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=(a + b) / 2
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(material)
    return obj


def kd_joint(name, at, radius, material):
    """Low-poly sphere for pivots, elbows and connectors."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def kd_leaf(name, base, angle, length, width, tilt, material, segments=14, notches=False):
    """A tapered, slightly curved leaf plane rooted at `base`.

    angle is the fan direction in radians, tilt is the upward pitch in radians.
    Set notches=True for a monstera-like silhouette.
    """
    verts = []
    faces = []

    for j in range(segments + 1):
        t = j / segments
        center = Vector((0, t * length, 0.035 * math.sin(math.pi * t)))
        w = (math.sin(math.pi * t) ** 0.75) * width
        left_scale = 0.22 if (notches and j in (4, 8, 11)) else 1.0
        right_scale = 0.22 if (notches and j in (5, 9, 12)) else 1.0

        verts.append(center + Vector((-w * left_scale, 0, -0.012 * w * left_scale)))
        verts.append(center + Vector((w * right_scale, 0, -0.012 * w * right_scale)))

    for j in range(segments):
        a, b = 2 * j, 2 * j + 1
        c, d = 2 * j + 2, 2 * j + 3
        faces.append((a, c, d, b))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.location = base
    obj.rotation_euler = (tilt, 0, angle)
    return obj


# ----------------------------------------------------------------------------
# Export + validation
# ----------------------------------------------------------------------------

def kd_report(objects=None):
    """Print bounds of the objects about to be exported."""
    objects = list(objects) if objects else [o for o in bpy.context.scene.objects if o.type in {'MESH', 'CURVE'}]
    if not objects:
        print('KD: nothing to report')
        return

    min_corner = Vector((math.inf, math.inf, math.inf))
    max_corner = Vector((-math.inf, -math.inf, -math.inf))

    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                min_corner[axis] = min(min_corner[axis], world[axis])
                max_corner[axis] = max(max_corner[axis], world[axis])

    size = max_corner - min_corner
    print('KD report: %d object(s)' % len(objects))
    print('KD report: min %s' % (tuple(round(v, 3) for v in min_corner),))
    print('KD report: max %s' % (tuple(round(v, 3) for v in max_corner),))
    print('KD report: size %s' % (tuple(round(v, 3) for v in size),))

    if abs(min_corner.z) > 0.05:
        print('KD warning: base is not near z=0 (offset %0.3f)' % min_corner.z)
    if max(size) < 0.1 or max(size) > 2.0:
        print('KD warning: prop size %0.3f is outside the typical 0.1 - 2.0 range' % max(size))


def kd_export(filepath, objects=None):
    """Export selected objects (or all meshes) as a KD Space-ready GLB."""
    objects = list(objects) if objects else [o for o in bpy.context.scene.objects if o.type in {'MESH', 'CURVE'}]
    if not objects:
        raise RuntimeError('KD: no meshes to export')

    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    kd_report(objects)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    # Filter by the operator's available properties so this works across
    # Blender versions whose glTF exporter options have changed.
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    options = {
        'filepath': filepath,
        'export_format': 'GLB',
        'use_selection': True,
        'export_apply': True,
    }
    kwargs = {key: value for key, value in options.items() if key in props}
    bpy.ops.export_scene.gltf(**kwargs)

    print('KD exported: %s' % filepath)
    return filepath


# ----------------------------------------------------------------------------
# Demo prop
# ----------------------------------------------------------------------------

def build_demo():
    """Build a small succulent that exercises all the helpers."""
    clear_scene()

    pot = kd_material('KD_Demo_Pot', (0.38, 0.37, 0.34), roughness=0.85)
    soil = kd_material('KD_Demo_Soil', (0.16, 0.11, 0.08), roughness=1.0)
    leaf = kd_material('KD_Demo_Leaf', (0.18, 0.50, 0.24), roughness=0.55)
    accent = kd_material(
        'KD_Demo_Accent',
        (1.0, 0.93, 0.80),
        roughness=0.2,
        emission=(1.0, 0.86, 0.62),
        emission_strength=2.0
    )

    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.11, radius2=0.08, depth=0.18, location=(0, 0, 0.09))
    bpy.context.object.name = 'KD_Demo_Pot'
    bpy.context.object.data.materials.append(pot)

    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.10, depth=0.015, location=(0, 0, 0.175))
    bpy.context.object.name = 'KD_Demo_Soil'
    bpy.context.object.data.materials.append(soil)

    for i, angle in enumerate([0.2, 1.3, 2.4, 3.5, 4.6, 5.7]):
        base = (0.02 * math.cos(angle), 0.02 * math.sin(angle), 0.185)
        kd_leaf('KD_Demo_Leaf%02d' % i, base, angle + math.pi / 2, 0.22, 0.07, math.radians(45), leaf)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.018, location=(0, 0, 0.21))
    bpy.context.object.name = 'KD_Demo_Accent'
    bpy.context.object.data.materials.append(accent)


def main():
    parser = argparse.ArgumentParser(description='KD Space Blender asset pipeline')
    parser.add_argument('--demo', action='store_true', help='build and export the demo succulent')
    parser.add_argument('--export', action='store_true', help='export the current scene without modifying it')
    parser.add_argument('--out', required=True, help='output .glb path')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

    if args.demo:
        build_demo()
        kd_export(args.out)
    elif args.export:
        kd_export(args.out)
    else:
        parser.error('choose --demo or --export')


if __name__ == '__main__':
    main()
