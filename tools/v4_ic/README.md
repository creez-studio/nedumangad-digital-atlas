# v4 — Interpretation Centre export

1. Open the team model in SketchUp 2024, then run `export_ic.rb` from the Ruby Console (Extensions › Developer › Ruby Console: `load "/path/to/export_ic.rb"`). It writes `parts.jsonl` next to the script, one line per building element, plus tree positions and materials.
2. `python3 pack_ic.py <folder with parts.jsonl> v4/data v4/data/stretch.json` writes `v4/data/ic.json` and `v4/data/ic.bin`.

Placement: SketchUp x/y + (92.92, 81.77) = CAD frame, which was fitted on 29 existing footprints (residual 0.2 m). The model's own terrain is compressed relative to the survey DEM, so the design is seated with one vertical offset (atlas height = SketchUp z + c, where c is printed by the packer) and the DEM inside the compound wall is regraded to the design's ground levels.
