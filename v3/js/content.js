// Text, figures and sources for the atlas. Anything tagged V() is an assumption
// drafted for the team to confirm against the field survey.
export const V = (t = 'verify') => `<span class="vf" title="Drafted assumption — confirm against the field survey">${t}</span>`;

export const C = {
  paper: '#F3F6FC', ink: '#0A1F4D', ink2: '#33456F', blue: '#1D4ED8', blue2: '#5B8DEF', blue3: '#B9CEF6', blue4: '#E3EBFA',
  hot: '#F0522B', amber: '#F2A93B', green: '#1FA37A', rose: '#C2255C', water: '#2F7FD9',
};

export const CENTER = [77.0023, 8.6065];
export const TOWN = [77.0030, 8.6050];
export const STRETCH = { w: 77.001044, s: 8.602793, e: 77.004695, n: 8.609499, c: [77.00287, 8.60615] };

export const ROAD_CLASS = {
  sh:  { name: 'State highway', color: C.ink, w: 15 },
  mdr: { name: 'Major district / primary town road', color: C.blue, w: 10 },
  mun: { name: 'Municipal collector', color: C.blue2, w: 7 },
  loc: { name: 'Local & residential', color: '#9DB6EA', w: 4 },
  prop: { name: 'Proposed Outer Ring Road', color: C.hot, w: 14 },
};

export const ERA = [
  { c: '#0A1F4D', label: 'Palace & chantha nucleus' },
  { c: '#1D4ED8', label: 'Trade-era town' },
  { c: '#5B8DEF', label: 'Road-era growth' },
  { c: '#F2A93B', label: 'Taluk-town expansion' },
  { c: '#F0522B', label: 'Recent sprawl' },
];

export const PERIODS = [
  { years: 'Before 1600', title: 'Neduman Kaadu — the long forest', era: -1, roads: 'trail', forest: 1,
    note: 'One reading of the name is Neduman Kaadu, the “long forest”. Movement is by footpath and cart track along ridgelines and stream valleys between the Ghats foothills and the coastal plain; permanent settlement is thin.',
    change: 'No engineered roads — only trails threading the canopy.', cam: { center: [77.004, 8.609], zoom: 13.1, pitch: 62, bearing: -24 } },
  { years: '1677 – 1684', title: 'The Queen at Koyikkal', era: 0, roads: 'trail', forest: .82, img: 'assets/hist_palace.jpg',
    note: 'Umayamma Rani of Venad holds court at Koyikkal Palace, a two-storey Kerala-style house around a courtyard. Artisans, weavers and goldsmiths settle around it; the palace becomes the first fixed nucleus of the town.',
    change: 'A royal seat clears the first ground in the forest.', cam: { center: [77.0029, 8.6090], zoom: 15.6, pitch: 64, bearing: 28 } },
  { years: '1700s – 1800s', title: 'The hill trade', era: 1, roads: 'trail', forest: .66, flows: true, img: 'assets/hist_flows.jpg',
    note: 'Pepper, arecanut, ginger and honey come down from Vithura, Ponmudi and Palode and gather at the Nedumangad chantha before moving on to Thiruvananthapuram, with a second axis running across the Ghats toward Tenkasi.',
    change: 'Three trade axes converge on the market — the geometry the road network still follows.', cam: { center: [77.02, 8.625], zoom: 11.9, pitch: 48, bearing: -12 } },
  { years: 'Early 1900s', title: 'The chantha opens', era: 2, roads: 'trail', forest: .5, market: true, img: 'assets/hist_market.jpg',
    note: 'Social-reform struggles of the early twentieth century open the market and its approach roads to all communities. The chantha grows into the largest market in the district, pulling weekly footfall from every direction.',
    change: 'The market’s pull fixes where roads must lead — inward, from all sides.', cam: { center: [77.0026, 8.6034], zoom: 15.9, pitch: 60, bearing: -38 } },
  { years: '1900 – 1950', title: 'The road era', era: 2, roads: 'sh', forest: .42,
    note: 'Cart tracks are surveyed and metalled into the Thiruvananthapuram–Tenkasi road, the town’s first engineered spine. The earliest motor-bus services reach Nedumangad along it.',
    change: 'The first engineered highway is drawn — the spine everything else hangs from.', cam: { center: [77.003, 8.607], zoom: 13.4, pitch: 55, bearing: 18 } },
  { years: '1950 – 2000', title: 'Taluk headquarters', era: 3, roads: 'all', forest: .25,
    note: 'Nedumangad becomes a taluk headquarters; the panchayat of 1936 is raised to a municipality in 1978. The full hierarchy sets in: state highways, district roads, municipal roads and dense residential streets, with a bus stand at the core.',
    change: 'A complete road hierarchy fills in around the spine.', cam: { center: [77.003, 8.607], zoom: 13.0, pitch: 58, bearing: -30 } },
  { years: '2000 – 2026', title: 'Four-lane future', era: 4, roads: 'all', forest: 0, orr: true,
    note: 'Four-laning of the 11.3 km Vazhayila–Nedumangad corridor, growing hill-tourism traffic toward Ponmudi and commuter flow to the space campuses at Valiamala redraw the load on the network. Junctions, not just roads, become the pressure points — and the widening now reaches the town core.',
    change: 'Widening and new destinations shift the load onto the core — the reason this study zooms in.', cam: { center: [77.001, 8.606], zoom: 12.5, pitch: 60, bearing: 12 } },
];

export const DESTS = [
  { id: 'airport', cat: 'hub', name: 'Trivandrum Intl. Airport', km: 27.8, min: 38, c: [76.9201, 8.4821], about: 'Trivandrum International Airport (TRV), Chackai — the region’s only airport.' },
  { id: 'chalai', cat: 'market', name: 'Chalai Market', km: 18.3, min: 26, c: [76.9520, 8.4847], about: 'Chalai Bazaar — the largest traditional market in Thiruvananthapuram city.' },
  { id: 'palayam', cat: 'market', name: 'Palayam (Connemara) Market', km: 16.3, min: 23, c: [76.9510, 8.5030], about: 'Historic covered market beside the city centre and Secretariat.' },
  { id: 'panachamoodu', cat: 'market', name: 'Panachamoodu Public Market', km: 36.6, min: 34, c: [77.2030, 8.4720], about: 'Public market on the eastern approach.' },
  { id: 'neyyattinkara', cat: 'market', name: 'Neyyattinkara Fish Market', km: 30.6, min: 32, c: [77.0870, 8.4000], about: 'Major wholesale fish trade on the southern corridor.' },
  { id: 'padmanabha', cat: 'landmark', name: 'Sree Padmanabhaswamy Temple', km: 26.4, min: 31, c: [76.9440, 8.4830], about: 'East Fort — the city’s principal landmark and pilgrimage site.' },
  { id: 'iist', cat: 'landmark', name: 'IIST — Space University', km: 5.6, min: 7, c: [77.0340, 8.6260], img: 'assets/iist.jpg', about: 'Indian Institute of Space Science & Technology, Valiamala.' },
];
export const DEST_COLOR = { hub: C.ink, market: C.amber, landmark: C.blue };

export const CORRIDORS = [
  { id: 'corr_ponmudi', name: 'Vithura · Ponmudi', color: C.green, dir: 'East — hill corridor', via: 'Thiruvananthapuram → Town → Vithura → Ponmudi', serves: 'Town core · Karippur · Manoorkonam · Vithura' },
  { id: 'corr_thenkasi', name: 'Palode · Tenkasi', color: C.hot, dir: 'North-east — across the Ghats', via: 'Town → Kallampara → Anad → Palode → Tenkasi', serves: 'Town core · Netta · Kallampara · Pazhakutty · Anad' },
  { id: 'route_airport', name: 'City · Airport', color: C.blue, dir: 'South-west — the capital', via: 'Town → Karakulam → Peroorkada → City → Airport', serves: 'Town core · Karakulam · city corridor' },
];

export const TOURIST = [
  { key: 'koyikkal', name: 'Koyikkal Palace', c: [77.002896, 8.609251], img: 'assets/koyikkal.jpg', d: 'In town', note: '17th-century palace of Umayamma Rani — folklore & numismatics museums.' },
  { key: 'ponmudi', name: 'Ponmudi Hill Station', c: [77.11483, 8.76003], img: 'assets/ponmudi.jpg', d: '≈ 38 km NE', note: 'The “Golden Peak” hill resort at about 1,100 m.' },
  { key: 'meenmutty', name: 'Meenmutty Falls, Kallar', c: [77.14502, 8.71223], img: 'assets/meenmutty.jpg', d: '≈ 30 km NE', note: 'Waterfall trek from Kallar.' },
  { key: 'goldenvalley', name: 'Golden Valley, Vithura', c: [77.12607, 8.71920], img: 'assets/goldenvalley.jpg', d: '≈ 28 km NE', note: 'Forest station and river pools near Vithura.' },
  { key: 'mankayam', name: 'Mankayam Falls', c: [77.06320, 8.75561], img: 'assets/mankayam.jpg', d: '≈ 25 km N', note: 'Eco-tourism site in the Palode reserve.' },
  { key: 'vazhvanthol', name: 'Vazhvanthol Falls', c: [77.16352, 8.67460], img: 'assets/vazhvanthol.jpg', d: '≈ 15 km E', note: 'Seasonal falls in the Peppara buffer.' },
  { key: 'peppara', name: 'Peppara Dam & Sanctuary', c: [77.14997, 8.63357], img: 'assets/peppara.jpg', d: '≈ 22 km E', note: '75 km² wildlife sanctuary around the 1983 dam.' },
];

export const ECO = [
  { key: 'killi', kicker: 'River', title: 'Killiyar rises here', color: C.water, cam: { center: [77.0, 8.60], zoom: 12.6, pitch: 50, bearing: 20 },
    body: 'The Killi river begins at Theerthankara near Panavoor in Nedumangad taluk and runs about 22–24 km south, entering Thiruvananthapuram at Vazhayila and joining the Karamana at Pallathukadavu. It is the Karamana’s largest tributary — what the town sheds, the capital receives.',
    src: 'Wikipedia: Killi River · Karamana River' },
  { key: 'karamana', kicker: 'Catchment', title: 'Karamana headwaters', color: C.blue, cam: { center: [77.04, 8.62], zoom: 11.3, pitch: 40, bearing: -10 },
    body: 'East of the town the land climbs toward Agasthyarkoodam, source of the 66 km Karamana. Peppara Dam (1983) and Aruvikkara Dam (1930s) on this river store Thiruvananthapuram’s drinking water — the municipality sits directly on the capital’s water-supply slope.',
    src: 'Wikipedia: Karamana River' },
  { key: 'ghats', kicker: 'Biodiversity', title: 'Edge of the Agasthyamala reserve', color: C.green, cam: { center: [77.06, 8.65], zoom: 10.8, pitch: 45, bearing: 30 },
    body: 'Peppara Wildlife Sanctuary — 75 km², rising from 100 m to 1,717 m, about 2,500 mm of rain a year — begins roughly 30 km up the Ponmudi road. Its evergreen forest and myristica swamps hold 43 mammal, 233 bird, 46 reptile and 13 amphibian species inside the Agasthyamala Biosphere Reserve.',
    src: 'Wikipedia: Peppara Wildlife Sanctuary' },
  { key: 'land', kicker: 'Landform', title: 'A midland of ridges and valleys', color: C.amber, cam: { center: [77.003, 8.607], zoom: 12.4, pitch: 58, bearing: -20 },
    body: 'Inside the boundary the ground swings between 40 m valley floors and ridges above 200 m. Streams occupy almost every valley; settlement and roads keep to the slopes and ridgelines, leaving the low ground to paddy, coconut and water.',
    src: 'Computed from the 10 m / 20 m contour survey in this atlas' },
];

export const LANDMARKS = [
  { key: 'palace', name: 'Koyikkal Palace', kicker: 'Heritage · 17th century', color: C.rose,
    body: 'Built for Umayamma Rani of Venad (queen 1677–1684). A two-storey Kerala-style house planned around an open courtyard, with steep tiled roofs, timber-screened upper galleries and a laterite plinth. Maintained by the State Department of Archaeology; folklore and numismatics museums opened here in 1992.',
    facts: [['Form', 'Courtyard house (nalukettu type), two storeys'], ['Roof', 'Steep hipped tile roof with gables'], ['Use today', 'Folklore & numismatics museums'], ['In the stretch', 'North anchor, on the Koyikkal Kottaram – Kallingal road']],
    src: 'Wikipedia: Koyikkal Palace · Nedumangad. Model is an interpretive massing, not a measured drawing.' },
  { key: 'bus', name: 'KSRTC Bus Stand', kicker: 'Mobility · town core', color: C.blue,
    body: 'The Kerala State Road Transport Corporation stand sits mid-stretch, east of the spine. Every hill corridor and city service turns here, so the stand’s entry and exit decide how the junction behaves at peak hours. The redesign replaces the open junction beside it with a roundabout and marked crossings.',
    facts: [['Role', 'Interchange for Ponmudi, Palode–Tenkasi and city services'], ['Footprint', '≈ 1,820 m² shed in the survey base'], ['Redesign', 'Roundabout, four zebra crossings, bus bays'], ['In the stretch', 'Centre anchor']],
    src: 'OSM (bus_station) · road.dwg. Bays and buses are illustrative.' },
  { key: 'market', name: 'Market — new market proposal', kicker: 'Economy · the chantha', color: C.amber,
    body: 'Nedumangad Public Market is described as the largest in the district, with a wholesale market set up with EU assistance. A new market building was announced in September 2024: 71,000 sq ft on four floors over basement parking.',
    facts: [['Cost', '₹26.11 crore (Sept 2024); later reported as ₹29.33 crore'], ['Ground floor', '72 stalls — 48 fish, 24 meat'], ['First floor', '112 stalls — produce, grocery, pottery'], ['Second floor', 'Food court, 8 outlets, 120 seats'], ['Systems', '33 kW solar, biogas plant, rainwater storage, 4 lifts']],
    src: 'Manorama Online, 27 Sept 2024 and 10 Jan 2025 · Wikipedia: Nedumangad. Siting and massing here are indicative.' },
  { key: 'court', name: 'Nedumangad Court', kicker: 'Civic · institution', color: C.ink,
    body: 'The court complex sits on the knoll west of the bus-stand roundabout — the highest ground in the frame. The team identifies two footprints in the CAD base as the court: a long front range along Town Branch Road (building 261) and the main block behind it (building 337). Both are modelled here as a civic type: deep arcaded verandahs, tiled roofs, entrance portico.',
    facts: [['Role', 'Taluk-level judicial complex'], ['Footprints', 'Buildings 261 (≈ 1,090 m²) and 337 (≈ 2,020 m²) in the CAD base'], ['Setting', 'Hilltop — about 13 m above the roundabout'], ['Model', 'Interpretive massing; storeys and elevations ' + V('to verify')]],
    src: 'Position from the team. Massing is interpretive — replace with measured elevations or site photographs.' },
  { key: 'sky', name: 'Skywalk ring', kicker: 'Concept · proposal', color: C.hot,
    body: 'A conceptual elevated ring over Market junction. One level deck, about 6.4 m above the carriageway, lets people cross every arm of the junction without meeting traffic, and docks into the frontages on the market-road and SH 3 sides. Stair and lift cores stand on the footpath corners; columns land only on footpath, never in a lane.',
    facts: [['Form', 'Circular deck, 22 m radius, 3.6 m clear width'], ['Length', '≈ 138 m around'], ['Clearance', '≈ 6.4 m over the road — check against the IRC vertical-clearance rule ' + V()], ['Links', 'Short bridges into adjoining frontages + one toward the new market'], ['Status', 'Concept by the team — not in road.dwg']],
    src: 'Concept massing generated for this atlas. Structure, access and exact landings are to be designed.' },];

export const WHY = [
  { t: 'Every corridor crosses here', d: 'State Highway 3, the Town Branch Road, the Pulippara–Anad, Aruvikkara and Kallingal–Pazhakutty roads and Surya Road all meet inside one 760 m frame. Nine named roads in 28 hectares — the tightest knot in the municipal network.', k: 'roads' },
  { t: 'Three anchors on one walkable spine', d: 'Koyikkal Palace to the north, the KSRTC bus stand in the middle and the market to the south sit on a single street — about 660 m, an eight-minute walk — yet nothing today reads as one continuous public place.', k: 'anchors' },
  { t: 'Three times the town’s intensity', d: 'Buildings cover 20.8 % of the stretch against 6.8 % across the municipality. 398 footprints, the oldest fabric, the densest frontage — the place where a road decision touches the most people.', k: 'density' },
  { t: 'Change is already drawn', d: 'The four-lane widening reaches the core, and a new four-storey market is announced. Road geometry, heritage frontage and market life are all about to be renegotiated on the same ground — so this is where the study must become a design.', k: 'change' },
];

export const TEAM = ['Irfan', 'Haron', 'Advin'];

export const SOURCES = [
  'OpenStreetMap contributors — road network, junctions, bus stops, waterways',
  'Google Open Buildings — 29,307 footprints; heights and growth epochs are derived, not surveyed',
  'Ward boundaries — LSGD ward delimitation, 2024',
  'Contours — 10 m and 20 m contour survey; elevation grid interpolated from it',
  'road.dwg — the team’s redesigned road and stretch drawing (existing road from OSM centrelines)',
  'Wikipedia — Nedumangad, Koyikkal Palace, Killi River, Karamana River, Peppara Wildlife Sanctuary',
  'Manorama Online (27 Sept 2024, 10 Jan 2025) — new market project; Construction World (28 June 2023) — Vazhayila–Nedumangad road',
];
