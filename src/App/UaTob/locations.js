export const LOCATIONS = {
  "Downtown Plaza":   { x: 50, y: 50 }, "Airport Terminal": { x: 12, y: 18 },
  "Central Park":     { x: 30, y: 30 }, "Union Square":     { x: 60, y: 38 },
  "West Village":     { x: 22, y: 62 }, "Brooklyn Bridge":  { x: 75, y: 72 },
  "Grand Central":    { x: 55, y: 45 }, "Times Square":     { x: 48, y: 35 },
  "JFK Airport":      { x: 88, y: 82 }, "Columbia Univ.":   { x: 35, y: 20 },
  "SoHo":             { x: 45, y: 65 }, "Upper East Side":  { x: 68, y: 22 },
};

export const LOCATION_NAMES = Object.keys(LOCATIONS);

// Car dots are positioned to spell "UaTob" across the map
export const DRIVERS = [
  // ── U (x: 2–18) ──
  { id:1,  name:'Sarah M.',  x:3,  y:22, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'ABC 1234' },
  { id:2,  name:'Jake T.',   x:3,  y:34, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'ABC 1235' },
  { id:3,  name:'Mia C.',    x:3,  y:46, type:'economy',  rating:4.7, vehicle:'Honda Civic',      plate:'ABC 1236' },
  { id:4,  name:'Leo B.',    x:6,  y:56, type:'economy',  rating:4.8, vehicle:'Honda Civic',      plate:'ABC 1237' },
  { id:5,  name:'Nina F.',   x:10, y:60, type:'economy',  rating:4.9, vehicle:'Nissan Altima',    plate:'ABC 1238' },
  { id:6,  name:'Omar R.',   x:14, y:56, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'ABC 1239' },
  { id:7,  name:'Priya K.',  x:17, y:46, type:'standard', rating:5.0, vehicle:'Toyota Camry',     plate:'ABC 1240' },
  { id:8,  name:'Ravi M.',   x:17, y:34, type:'premium',  rating:5.0, vehicle:'Mercedes S-Class', plate:'ABC 1241' },
  { id:9,  name:'Sara J.',   x:17, y:22, type:'premium',  rating:4.9, vehicle:'BMW 7 Series',     plate:'ABC 1242' },
  // ── a (x: 22–34) ──
  { id:10, name:'Tom H.',    x:24, y:36, type:'economy',  rating:4.6, vehicle:'Nissan Altima',    plate:'DEF 0001' },
  { id:11, name:'Uma P.',    x:28, y:32, type:'economy',  rating:4.7, vehicle:'Nissan Altima',    plate:'DEF 0002' },
  { id:12, name:'Vic S.',    x:32, y:36, type:'economy',  rating:4.8, vehicle:'Honda Civic',      plate:'DEF 0003' },
  { id:13, name:'Wes A.',    x:33, y:44, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'DEF 0004' },
  { id:14, name:'Xia L.',    x:32, y:52, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'DEF 0005' },
  { id:15, name:'Yara N.',   x:28, y:56, type:'economy',  rating:4.7, vehicle:'Honda Civic',      plate:'DEF 0006' },
  { id:16, name:'Zoe M.',    x:24, y:52, type:'economy',  rating:4.8, vehicle:'Nissan Altima',    plate:'DEF 0007' },
  { id:17, name:'Adam B.',   x:33, y:58, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'DEF 0008' },
  // ── T (x: 38–56) ──
  { id:18, name:'Bella C.',  x:38, y:22, type:'xl',       rating:4.7, vehicle:'Chevy Suburban',   plate:'GHI 0001' },
  { id:19, name:'Carl D.',   x:42, y:22, type:'xl',       rating:4.8, vehicle:'Ford Explorer',    plate:'GHI 0002' },
  { id:20, name:'Dana E.',   x:47, y:22, type:'premium',  rating:5.0, vehicle:'BMW 7 Series',     plate:'GHI 0003' },
  { id:21, name:'Eli F.',    x:52, y:22, type:'xl',       rating:4.7, vehicle:'Chevy Suburban',   plate:'GHI 0004' },
  { id:22, name:'Fay G.',    x:56, y:22, type:'xl',       rating:4.8, vehicle:'Ford Explorer',    plate:'GHI 0005' },
  { id:23, name:'Gil H.',    x:47, y:33, type:'premium',  rating:5.0, vehicle:'Mercedes S-Class', plate:'GHI 0006' },
  { id:24, name:'Hana I.',   x:47, y:44, type:'premium',  rating:4.9, vehicle:'BMW 7 Series',     plate:'GHI 0007' },
  { id:25, name:'Ivan J.',   x:47, y:55, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'GHI 0008' },
  // ── o (x: 61–74) ──
  { id:26, name:'Jana K.',   x:65, y:30, type:'economy',  rating:4.7, vehicle:'Honda Civic',      plate:'JKL 0001' },
  { id:27, name:'Kyle L.',   x:70, y:27, type:'economy',  rating:4.8, vehicle:'Nissan Altima',    plate:'JKL 0002' },
  { id:28, name:'Lena M.',   x:74, y:33, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'JKL 0003' },
  { id:29, name:'Marc N.',   x:75, y:41, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'JKL 0004' },
  { id:30, name:'Nora O.',   x:73, y:50, type:'economy',  rating:4.7, vehicle:'Honda Civic',      plate:'JKL 0005' },
  { id:31, name:'Otto P.',   x:68, y:55, type:'economy',  rating:4.8, vehicle:'Nissan Altima',    plate:'JKL 0006' },
  { id:32, name:'Pia Q.',    x:62, y:50, type:'standard', rating:4.9, vehicle:'Toyota Camry',     plate:'JKL 0007' },
  { id:33, name:'Quinn R.',  x:61, y:41, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'JKL 0008' },
  // ── b (x: 80–93) ──
  { id:34, name:'Rosa S.',   x:81, y:15, type:'premium',  rating:5.0, vehicle:'Mercedes S-Class', plate:'MNO 0001' },
  { id:35, name:'Sam T.',    x:81, y:25, type:'premium',  rating:4.9, vehicle:'BMW 7 Series',     plate:'MNO 0002' },
  { id:36, name:'Tara U.',   x:81, y:35, type:'premium',  rating:5.0, vehicle:'Mercedes S-Class', plate:'MNO 0003' },
  { id:37, name:'Uri V.',    x:86, y:30, type:'xl',       rating:4.7, vehicle:'Chevy Suburban',   plate:'MNO 0004' },
  { id:38, name:'Vera W.',   x:90, y:38, type:'xl',       rating:4.8, vehicle:'Ford Explorer',    plate:'MNO 0005' },
  { id:39, name:'Will X.',   x:86, y:47, type:'xl',       rating:4.7, vehicle:'Chevy Suburban',   plate:'MNO 0006' },
  { id:40, name:'Xena Y.',   x:81, y:51, type:'premium',  rating:4.9, vehicle:'BMW 7 Series',     plate:'MNO 0007' },
  { id:41, name:'Yogi Z.',   x:81, y:62, type:'standard', rating:4.8, vehicle:'Toyota Camry',     plate:'MNO 0008' },
];
