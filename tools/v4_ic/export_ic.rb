require 'json'
OUTP = './parts.jsonl'
m = Sketchup.active_model
f = File.open(OUTP, 'w')
def find(ents, name)
  ents.each { |e| next unless e.respond_to?(:definition); return e if e.name == name; r = find(e.definition.entities, name); return r if r }
  nil
end
def world_tr(m, target)
  # path transform: search from root
  rec = lambda do |ents, tr|
    ents.each do |e|
      next unless e.respond_to?(:definition)
      t = tr * e.transformation
      return t if e == target
      r = rec.call(e.definition.entities, t); return r if r
    end
    nil
  end
  rec.call(m.entities, Geom::Transformation.new)
end
def tris(ent, tr, mat, acc)
  return if ent.hidden? || (ent.layer && !ent.layer.visible?)
  if ent.is_a?(Sketchup::Face)
    mm = ent.material || ent.back_material || mat
    key = mm ? mm.name : '_default'
    mesh = ent.mesh(0)
    pts = (1..mesh.count_points).map { |i| mesh.point_at(i).transform(tr) }
    a = (acc[key] ||= [])
    mesh.polygons.each do |poly|
      poly.each { |i| p = pts[i.abs - 1]; a << p.x.to_m.round(3) << p.y.to_m.round(3) << p.z.to_m.round(3) }
    end
  elsif ent.respond_to?(:definition)
    t = tr * ent.transformation
    mm = ent.material || mat
    ent.definition.entities.each { |c| tris(c, t, mm, acc) }
  end
end
def emit(f, b, e, ent, tr, mat)
  acc = {}
  tris(ent, tr, mat, acc)
  n = acc.values.map(&:size).sum / 9
  bbx = ent.bounds
  f.puts({ b: b, e: e, n: n, tri: acc }.to_json) if n > 0
  n
end
total = 0
ub = find(m.entities, 'Buildings_User_Models'); ubt = world_tr(m, ub)
ub.definition.entities.each do |bi|
  next unless bi.respond_to?(:definition)
  t1 = ubt * bi.transformation
  inner = bi.definition.entities.select { |x| x.respond_to?(:definition) }
  if bi.name.start_with?('COURT') || inner.size != 1
    total += emit(f, bi.name, 'Court', bi, ubt, bi.material)
    next
  end
  g = inner[0]; t2 = t1 * g.transformation
  g.definition.entities.each do |part|
    if part.respond_to?(:definition)
      total += emit(f, bi.name, part.name, part, t2, part.material || g.material || bi.material)
    elsif part.is_a?(Sketchup::Face)
      total += emit(f, bi.name, 'Misc', part, t2, g.material)
    end
  end
end
mb = find(m.entities, 'Buildings_Massing_Conceptual_Kerala_Roofs'); mbt = world_tr(m, mb)
mb.definition.entities.each do |bi|
  next unless bi.respond_to?(:definition)
  t1 = mbt * bi.transformation
  bi.definition.entities.each { |part| next unless part.respond_to?(:definition); total += emit(f, bi.name, part.name, part, t1, part.material || bi.material) }
end
sl = find(m.entities, 'Site_Landscape_Regraded'); slt = world_tr(m, sl)
sl.definition.entities.each { |part| next unless part.respond_to?(:definition); total += emit(f, 'SITE', part.name, part, slt * part.transformation.inverse * part.transformation, part.material) }
%w[Compound_Wall_Laterite_1.5m Kulam_Water Parking_Bay_Lines].each do |nm|
  g = find(m.entities, nm); next unless g
  t = world_tr(m, g); total += emit(f, 'SITE', nm, g, t * g.transformation.inverse, g.material)
end
# trees: positions only
tr = find(m.entities, 'Trees_Landscape_Design'); trt = world_tr(m, tr)
trees = []
tr.definition.entities.each do |t|
  next unless t.respond_to?(:definition)
  b = t.bounds; tt = trt
  mn = b.min.transform(trt); mx = b.max.transform(trt)
  trees << [((mn.x + mx.x) / 2).to_m.round(2), ((mn.y + mx.y) / 2).to_m.round(2), mn.z.to_m.round(2), ([mx.x - mn.x, mx.y - mn.y].max / 2).to_m.round(2), (mx.z - mn.z).to_m.round(2), t.definition.name]
end
f.puts({ trees: trees }.to_json)
mats = {}
m.materials.each { |mm| c = mm.color; mats[mm.name] = [c.red, c.green, c.blue, mm.alpha.round(2), mm.display_name, mm.texture ? 1 : 0] }
f.puts({ mats: mats }.to_json)
f.close
File.write('./export_done.txt', total.to_s)
