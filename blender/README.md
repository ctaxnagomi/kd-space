# KD Space Blender asset pipeline

`kdspace_export.py` produces GLB props that drop straight into KD Space. It
encodes the conventions used by `deskPlant.glb` and `deskLamp.glb` so future
assets are consistent instead of being one-off live-session scripts.

## Conventions

| Rule | Why |
|------|-----|
| 1 Blender unit = 1 Three.js unit | No scale conversion in app code |
| Model Z-up; export converts to Y-up | glTF handles the axis swap |
| Origin at the prop's contact point (`z = 0`) | Makes desk/floor placement predictable |
| Desk props ~0.2–0.7 units tall | Matches existing room scale |
| Mesh names `KD_<Prop>_<Part>` | Become readable node names in Three.js |
| Materials via `kd_material()` | Keeps PBR + emission intact in the GLB |

## Quick start

Build and export the bundled demo succulent:

```bash
blender --background --python kdspace_export.py -- --demo --out ../static/assets/myProp.glb
```

Export whatever is currently in an open Blender scene:

```bash
blender --background --python kdspace_export.py -- --export --out ../static/assets/myProp.glb
```

On Windows, use the full Blender path, for example:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" `
  --background --python kdspace_export.py -- `
  --demo --out "C:\path\to\kd-space\static\assets\myProp.glb"
```

The script prints a bounds report and warns when the base is not near `z = 0`
or the size looks unusual.

## Custom props

Import the module from your own Blender script:

```python
import kdspace_export as kd

kd.clear_scene()

metal = kd.kd_material('KD_Lamp_Metal', (0.28, 0.30, 0.33), roughness=0.3, metallic=0.8)
bulb = kd.kd_material(
    'KD_Lamp_Bulb', (1.0, 0.93, 0.8),
    emission=(1.0, 0.86, 0.62), emission_strength=2.5
)

kd.kd_beam('KD_Lamp_Arm', (0, 0, 0.05), (0.1, 0, 0.35), 0.012, metal)
kd.kd_joint('KD_Lamp_Elbow', (0.1, 0, 0.35), 0.02, metal)

kd.kd_export('C:/path/to/kd-space/static/assets/myProp.glb')
```

Available helpers: `clear_scene`, `kd_material`, `kd_beam`, `kd_joint`,
`kd_leaf`, `kd_report`, `kd_export`.

## After exporting

1. Register the file in `src/Experience/assets.js`.
2. For a fixed prop, add a small class like `DeskPlant.js` / `DeskLamp.js`
   and call it from `World.js`.
3. For a Studio Mode button, add a listener in `Studio.js` and set
   `object.userData.kdSource = { kind: '<prop>' }` so Save/Load can rebuild it.
4. Run `npm run build` and check the object in the browser.
