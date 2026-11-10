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
- **Palette**: the raster basemap is kept as a soft desaturated wash rather than
  a photograph, water is muted to slate, building massing is near-white card, and
  the two highway grades carry the coral accent so the main axis reads at a glance.
- **Vegetation**: `data/vegetation.geojson` scatters 6,086 canopies across the
  open land — derived by `tools/build_vegetation.py` as the negative space inside
  the boundary, clear of every building, road and watercourse. Drawn as
  billboarded sprites at low opacity, so they read as volume under pitch without
  competing with the road drawing. Toggleable from the feature bar.
- **Node sizes** ramp gently with zoom and clamp at both ends, so a junction is
  always a comfortable click target and never a boulder over a zoomed-out taluk.
- **Feature bar**: rivers, greenery, buildings and proposed roads collapse into a
  single pill rail across the top instead of a stack of boxes in the corner.
- **Left rail**: the chapter card folds, and junction and ward indexes sit below
  it as headings that stay collapsed until opened. Picking an entry flies the map
  to it and opens its detail panel.

Note for anyone editing the widths: `line-width` will not accept runtime `+`/`*`
next to a zoom `interpolate`, so all arithmetic is done in JS and the style only
ever sees a plain ramp over per-class constants.

## v3 — Macro → Micro Atlas

`v3/` is a self-contained rebuild, served at
<https://creez-studio.github.io/nedumangad-digital-atlas/v3/>. Study and drawing by
**Irfan, Haron and Advin**.

- **Blue-and-white axonometric language** with contrast accents and a legend on every
  chapter; custom cursor, cursor-reactive title, lens and section.
- **Macro (MapLibre)** — network, a redesigned historical evolution (the town grows out of
  a 3D forest, epoch by epoch), access, wards, topography with a section that follows the
  cursor, and an ecology chapter with a live ground-reading lens.
- **Micro (Three.js)** — the 372 × 759 m design stretch built from `road.dwg`: existing
  versus redesigned road with a sweep-in animation, measured cross-sections, frontage
  impact, heritage buildings, the new market proposal (exploded floors), terrain and a
  long section, plus detailed models of Koyikkal Palace, the KSRTC bus stand, the market
  and the court.

Libraries and fonts are vendored in `v3/vendor/`, so only the basemap tiles need a network.

```bash
python3 -m http.server 8000      # from the repo root
# open http://localhost:8000/v3/
```

Rebuilding the data (Python 3 with `shapely`, `scipy`, `numpy`):

```bash
python3 tools/build_v3_macro.py     # slims data/*.geojson into v3/data, DEM grid, statistics
python3 tools/build_v3_stretch.py   # tools/cad/road_flat.json -> v3/data/stretch.json
```

`tools/cad/road_flat.json` is `road.dwg` converted with LibreDWG (`dwg2dxf`) and flattened
per layer with `ezdxf`. The drawing is tied to the stretch boundary by a translation fitted
against the OSM centrelines (mean residual about 2.5 m).

Values tagged **verify** in the interface are drafted assumptions (existing road widths,
crossing and parking condition, heritage attributes, the court's position) to be replaced
with field-survey figures. Building heights and growth epochs are derived, and the landmark
models are interpretive massing rather than measured drawings.


### v3.1 — terrain, traffic and concept update

- **Hero**: title on one line; "Skip intro" on the first page and a Skip button (or Esc) during the locate and stretch-approach animations.
- **Design stretch on real ground**: `tools/build_v3_stretch.py` fits a thin-plate spline to the 2 m contours in `road.dwg` (4 m grid, true vertical scale). Roads, footpaths, buildings, trees, vehicles and landmarks are draped on it; the site reads as a cut terrain block. The OSM stream in the north-east corner is carved in and the roads bridge it with parapets.
- **Court**: CAD footprints 261 and 337 are modelled as the court complex (front range + main block).
- **Traffic**: vehicles follow lane lines derived from the carriageway polygons (keep-left), follow the vehicle ahead, stop at signals and give way at the roundabout. Signals, stop lines and zebra crossings at three junctions are an atlas proposal, not part of `road.dwg`.
- **Road joints**: existing lanes that meet the redesigned roads are kept and run into the new kerb line with dropped kerbs and give-way lines.
- **Skywalk ring**: conceptual elevated ring over Market junction with links into the frontages.
- **Macro**: watercourses are polygons whose width grows downstream; road widths are metric (SH 10 m, MDR 7.5 m, municipal 5.5 m, local 3.6 m) plus a legibility floor; every road–water crossing is a raised 3D deck; a key map (Kerala > district > taluk > municipality) with scale bar and north; a soft relief base under the town.
