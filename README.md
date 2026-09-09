# Nedumangad Interactive Digital Atlas

An interactive digital atlas of Nedumangad (Thiruvananthapuram district, Kerala),
built as a Claude Design canvas. It renders a MapLibre GL map with layered GeoJSON
data — administrative boundaries, wards, roads, transport routes, water bodies,
contours and junction notes — plus a set of printed atlas plates.

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

External runtime dependencies (React, MapLibre GL, Babel standalone) load from
public CDNs; map tiles come from OpenStreetMap and OpenFreeMap.

`.nojekyll` is present so GitHub Pages serves the `_ds/` directory verbatim.
