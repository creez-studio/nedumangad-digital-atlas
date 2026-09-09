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
| `v2/` | Competition-board style test — same data, redrawn cartography |

External runtime dependencies (React, MapLibre GL, Babel standalone) load from
public CDNs; map tiles come from OpenStreetMap and OpenFreeMap.

`.nojekyll` is present so GitHub Pages serves the `_ds/` directory verbatim.

## v2 — competition-board style test

`v2/index.html` is a styling experiment served at
<https://creez-studio.github.io/nedumangad-digital-atlas/v2/>. It shares every
asset with the main build through a `<base href="../">` tag, so only the drawing
changes — there is no duplicated data.

What differs from the main atlas:

- **Road widths** are a zoom ramp over real carriageway metres per hierarchy
  level (NH 15 m → local 4 m) with a pixel floor, instead of one fixed pixel
  width that reads fat when zoomed out and hair-thin when zoomed in.
- **Casing plus fill** as two whole layers rather than a single stroke, so all
  casings paint before any fill and shared junctions merge cleanly instead of
  stacking seams.
- **`line-sort-key` by hierarchy**, so a lane can never paint across a highway —
  the main cause of the clipped-looking junctions.
- **Paper palette**: the raster basemap is washed almost to white, water is
  desaturated to slate, building massing is near-white card, and the two highway
  grades carry the coral accent so the main axis reads at a glance.

Note for anyone editing the widths: `line-width` will not accept runtime `+`/`*`
next to a zoom `interpolate`, so all arithmetic is done in JS and the style only
ever sees a plain ramp over per-class constants.
