# Nedumangad Interactive Digital Atlas

An interactive digital atlas of Nedumangad (Thiruvananthapuram district, Kerala),
built as a Claude Design canvas. It renders a MapLibre GL map with layered GeoJSON
data — administrative boundaries, wards, roads, transport routes, water bodies,
contours, junction notes and a 3D building layer — plus a set of printed atlas plates.

## The built environment

`data/buildings.geojson` holds 29,307 footprints derived from the Google Open
Buildings export in `uploads/`. The source carries no height, so two properties
are derived at build time by `tools/build_buildings.py`:

- **`h`** — height in metres, inferred from footprint area on a Kerala small-town
  storey profile (median ≈ 5.3 m, roughly 1–2 storeys), running taller toward the
  commercial core, with deterministic jitter so the massing does not read as slabs.
- **`era`** — a growth epoch 0–4, banded by distance from the Koyikkal Palace and
  chantha nucleus. Chapter 02 steps the timeline through these, so the town's
  built fabric grows outward from the palace and the market.

Rendered as a `fill-extrusion` layer, toggleable from the Chapter 01 layer panel.

## Viewing

Open <https://creez-studio.github.io/nedumangad-digital-atlas/> — or serve the
folder locally over HTTP (the page fetches `data/*.geojson` at runtime, so
`file://` will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Layout

| Path | Contents |
| --- | --- |
| `index.html` / `Atlas.dc.html` | Main interactive atlas |
| `Atlas Sheets.dc.html` | Static atlas plates |
| `data/` | GeoJSON layers loaded by the atlas at runtime |
| `assets/` | Plate images and photos referenced by the pages |
| `_ds/` | Design-system bundle (styles + runtime) |
| `support.js`, `doc-page.js`, `image-slot.js` | Claude Design canvas runtime |
| `uploads/` | Raw source material (unprocessed GeoJSON, video, imagery) |
| `tools/` | Build script that derives the 3D building layer from the raw export |

External runtime dependencies (React, MapLibre GL, Babel standalone) load from
public CDNs; map tiles come from OpenStreetMap and OpenFreeMap.

`.nojekyll` is present so GitHub Pages serves the `_ds/` directory verbatim.
