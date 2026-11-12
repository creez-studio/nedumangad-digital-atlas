# Pack the SketchUp export (parts.jsonl) into v4/data/ic.json + ic.bin for the atlas.
import json, sys, math, struct, statistics, collections
SU, OUT, STRETCH = sys.argv[1], sys.argv[2], sys.argv[3]
OX, OY = 92.92, 81.77                     # SketchUp frame -> CAD frame (fitted on 29 matching footprints)
S = json.load(open(STRETCH)); D = S['dem']
def samp(A, x, y):
    fx=(x-D['x0'])/D['dx']; fy=(y-D['y0'])/D['dx']; i=max(0,min(D['nx']-2,int(fx))); j=max(0,min(D['ny']-2,int(fy)))
    u=max(0,min(1,fx-i)); v=max(0,min(1,fy-j)); k=j*D['nx']+i
    return A[k]*(1-u)*(1-v)+A[k+1]*u*(1-v)+A[k+D['nx']]*(1-u)*v+A[k+D['nx']+1]*u*v
parts=[]; trees=[]; mats={}
for l in open(SU+'/parts.jsonl'):
    o=json.loads(l)
    if 'trees' in o: trees=o['trees']
    elif 'mats' in o: mats=o['mats']
    else: parts.append(o)

THEME = {'wall':0xF4F7FD,'roof':0xD9745C,'glass':0x8FB4F2,'timber':0xF6E2B8,'metal':0x33456F,'stone':0xE9EEF8,'pave':0xDDE6F6,
         'lawn':0xBFE3D2,'plant':0x86D3AC,'water':0x6FB1F2,'asphalt':0x93A1BC,'seat':0xF7B9A6,'space':0xDDE6F6,'skirt':0xDCE6F8,'mark':0xFFFFFF}
def cat(mname, part, b):
    n=mname.lower(); p=part.lower(); m=mats.get(mname)
    if b=='SITE':
        for k,c in [('kulam_water','water'),('lawn','lawn'),('planting','plant'),('parking_asphalt','asphalt'),('parking_bay','mark'),('building_pads','stone'),
                    ('retaining_skirt','skirt'),('compound_wall','wall'),('kulam_bed','stone')]:
            if k in p: return c
        return 'pave'
    if (m and m[3] < .9) or 'glass' in n: return 'glass'
    if any(k in n for k in ['court_tile','floor','court_green']): return 'lawn' if 'green' in n else 'pave'
    if any(k in n for k in ['roof','tile']): return 'roof'
    if any(k in n for k in ['lawn','color f07']): return 'lawn'
    if any(k in n for k in ['plant','sorbus','leaf','foliage']) and 'bark' not in n: return 'plant'
    if 'water' in n or 'pool' in n: return 'water'
    if 'asphalt' in n: return 'asphalt'
    if any(k in n for k in ['fabric','chair','seat ','[color a04]1','color b06','hologram']) or n=='seat': return 'seat'
    if any(k in n for k in ['steel','alu','black','charcoal','formica','metal','umber','hoop','iron','rail']): return 'metal'
    if any(k in n for k in ['timber','teak','slat','soffit','jaali','wood','door','deck','bark','soil']): return 'timber'
    if any(k in n for k in ['kota','granite','stone','pebble','paving','plaza','court']): return 'pave'
    if 'space_' in n: return 'space'
    if '_default' == n and 'roof' in p: return 'roof'
    return 'wall'

# --- vertical seat: one constant puts the design's ground on the atlas terrain
gpts=[]
for p in parts:
    if p['b']=='SITE' and p['e'] in ('Lawn','Plazas_Kota_Stone','Pathways_Laterite','Building_Pads','Planting_Beds'):
        for a in p['tri'].values(): gpts += [(a[i]+OX,a[i+1]+OY,a[i+2]) for i in range(0,len(a),9*4,3)] if False else [(a[i]+OX,a[i+1]+OY,a[i+2]) for i in range(0,len(a),3)]
c = statistics.median(samp(D['z'],x,y)-z for x,y,z in gpts[::7])
print('vertical offset c =', round(c,2), 'm  (atlas h = skp z + c)')

# --- site hull (compound wall) in CAD coords
wall=[(a[i]+OX,a[i+1]+OY) for p in parts if p['e'].startswith('Compound_Wall') for a in p['tri'].values() for i in range(0,len(a),3)]
def hull(P):
    P=sorted(set((round(x,2),round(y,2)) for x,y in P))
    def cr(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[];up=[]
    for p in P:
        while len(lo)>=2 and cr(lo[-2],lo[-1],p)<=0: lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up)>=2 and cr(up[-2],up[-1],p)<=0: up.pop()
        up.append(p)
    return lo[:-1]+up[:-1]
H=hull(wall)
def inside(x,y,poly=H):
    r=False; n=len(poly)
    for i in range(n):
        a=poly[i]; b=poly[(i+1)%n]
        if (a[1]>y)!=(b[1]>y) and x < a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]): r=not r
    return r

# --- ground grid: DEM cells inside the site take the design's own levels (top surface), just below it
best={}
for x,y,z in gpts:
    i=round((x-D['x0'])/D['dx']); j=round((y-D['y0'])/D['dx'])
    if 0<=i<D['nx'] and 0<=j<D['ny']: best[(i,j)]=max(best.get((i,j),-1e9), z+c)
cells=[]
for j in range(D['ny']):
    for i in range(D['nx']):
        x=D['x0']+i*D['dx']; y=D['y0']+j*D['dx']
        if not inside(x,y): continue
        if (i,j) in best: h=best[(i,j)]
        else:
            nb=[best[k] for k in [(i+a,j+b) for a in (-2,-1,0,1,2) for b in (-2,-1,0,1,2)] if k in best]
            if not nb: continue
            h=sum(nb)/len(nb)
        cells.append([j*D['nx']+i, round(h-.25,2)])
print('ground cells regraded', len(cells))

# --- buildings & parts
NAMES={'AMPHITHEATRE (user model)':'Amphitheatre','EXHIBITION HALL - Nadumuttam (user model)':'Exhibition Hall · Nadumuttam','COMMUNITY CENTRE (user model)':'Community Centre',
 'BADMINTON INDOOR (user model)':'Badminton Hall','COURT - Basketball/Volleyball (user model) 5':'Basketball / Volleyball Court 1','COURT - Basketball/Volleyball (user model) 6':'Basketball / Volleyball Court 2',
 'Roofed_Courts_Steel_Shell':'Roofed Courts','Kathakali_Centre_Koothambalam':'Kathakali Centre · Koothambalam','Puppet_Theatre_Tholpavakoothu':'Puppet Theatre · Tholpavakoothu',
 'Neyth_Weaving_Workshop':'Neyth Weaving Workshop','Waiting_Info_Pavilion':'Waiting & Info Pavilion','Food_Plaza_Dining_Pavilion':'Food Plaza · Dining','Food_Plaza_Kitchen':'Food Plaza · Kitchen',
 'Childrens_Activity_Pavilion':"Children's Pavilion",'Washroom_W1':'Washroom W1','Washroom_W2':'Washroom W2','Washroom_W3':'Washroom W3','Security_Kiosk':'Security Kiosk',
 'Plant_Electrical_DG':'Plant · Electrical / DG','Pump_Room':'Pump Room','STP_Deck':'STP Deck','SITE':'Site'}
DETAIL={'Amphitheatre','Exhibition Hall · Nadumuttam','Community Centre','Badminton Hall'}
def level(e):
    p=e.lower()
    rules=[(['roof_covering','roofs','canopy','roof_clay','roof_slab','roof_tile','roof_petal'],6),(['roof_structure','hall_roof','truss','roof'],5),
           (['foyer_upper','curtain','gable'],4),(['ff_'],3),(['doors_windows','window','jaali','envelope'],3),
           (['gf_','walls','wall','structure','column','stairs','porch','entrance','support','backstage','stage','wc','misc'],2),
           (['floor','slab','interior','seating','exhibit','hall_'],1),(['plinth','substructure','site','approach','arena'],0)]
    for ks,l in rules:
        if any(k in p for k in ks): return l
    return 2
def pretty(e):
    e=e.replace('GF_','Ground floor ').replace('FF_','First floor ').replace('_',' ').strip()
    return e[:1].upper()+e[1:]
blds=collections.OrderedDict(); pos=[]; chunks_total=0
for p in parts:
    b=NAMES.get(p['b'],p['b']); court=p['e']=='Court'
    tri=p['tri']
    if court: tri={k:v for k,v in tri.items() if not (k.startswith('_Bball') or k=='<Black>' or 'Rope' in k)}
    ch=[]
    for mname,a in tri.items():
        if not a: continue
        k=cat(mname,p['e'],p['b']); m=mats.get(mname); orig=(m[0]<<16|m[1]<<8|m[2]) if m else 0xEEEEEE
        n=len(a)//9; start=len(pos)//9
        for i in range(0,len(a),3): pos += [a[i]+OX, a[i+1]+OY, a[i+2]+c]
        ch.append([k, orig, start, n])
    if not ch: continue
    zs=pos[ch[0][2]*9+2::3][:1]
    B=blds.setdefault(b,{'name':b,'detail':b in DETAIL,'parts':[]})
    B['parts'].append({'e':pretty(p['e']) if not court else 'Court','lv':0 if (b=='Site' or court) else level(p['e']),'ch':ch})
# label anchors + bounds
for B in blds.values():
    xs=[];ys=[];zz=[]
    for pt in B['parts']:
        for k,o,s,n in pt['ch']:
            seg=pos[s*9:(s+n)*9]; xs+=seg[0::3]; ys+=seg[1::3]; zz+=seg[2::3]
    B['bb']=[round(min(xs),1),round(min(ys),1),round(min(zz),1),round(max(xs),1),round(max(ys),1),round(max(zz),1)]
    lvls=sorted(set(pt['lv'] for pt in B['parts'])); 
    for pt in B['parts']: pt['k']=lvls.index(pt['lv'])
    B['nk']=len(lvls)
# quantise to cm around origin
O=[round((min(pos[0::3])+max(pos[0::3]))/2,1), round((min(pos[1::3])+max(pos[1::3]))/2,1), 0]
q=[int(round((v-O[i%3])*100)) for i,v in enumerate(pos)]
assert max(abs(v) for v in q) < 32767, max(abs(v) for v in q)
open(OUT+'/ic.bin','wb').write(struct.pack('<%dh'%len(q),*q))
tr=[[round(t[0]+OX,2),round(t[1]+OY,2),round(t[2]+c,2),t[3],t[4],t[5].replace('Tree_','')] for t in trees]
meta={'O':O,'c':round(c,3),'shift':[OX,OY],'hull':[[round(x,2),round(y,2)] for x,y in H],'theme':THEME,'ground':cells,'trees':tr,'blds':list(blds.values()),
      'ntri':len(pos)//9,'src':'Interpretation final copy with label.skp (SketchUp 2024), exported per element'}
json.dump(meta,open(OUT+'/ic.json','w'),separators=(',',':'))
print('triangles',len(pos)//9,'bin MB',round(len(q)*2/1e6,2),'buildings',len(blds))
for B in blds.values(): print(' ',B['name'],'parts',len(B['parts']),'levels',B['nk'],'tris',sum(n for pt in B['parts'] for _,_,_,n in pt['ch']))
