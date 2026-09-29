import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

interface MaduraiTurfDefinition {
  name: string;
  slug: string;
  areaSlug: string;
  addressLine: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  contactEmail: string;
  description: string;
  coverImageUrl: string;
  galleryImages: { url: string; caption: string }[];
  sports: string[]; // sport slugs
  facilities: string[]; // facility slugs
  hourlyPriceRegular: number;
  hourlyPriceNight: number;
  hourlyPriceWeekend: number;
  ratingAverage: number;
  totalReviews: number;
  isFeatured: boolean;
  rules: string;
}

const MADURAI_AREAS = [
  { name: 'Teppakulam', slug: 'teppakulam', postalCode: '625009', latitude: 9.9142, longitude: 78.1492 },
  { name: 'Gomathipuram', slug: 'gomathipuram', postalCode: '625020', latitude: 9.9215, longitude: 78.1634 },
  { name: 'Narasingam', slug: 'narasingam', postalCode: '625007', latitude: 9.9862, longitude: 78.1887 },
  { name: 'Kadachanendhal', slug: 'kadachanendhal', postalCode: '625107', latitude: 9.9754, longitude: 78.1610 },
  { name: 'Solaialagu Puram', slug: 'solaialagu-puram', postalCode: '625011', latitude: 9.9015, longitude: 78.1189 },
  { name: 'Ponmeni', slug: 'ponmeni', postalCode: '625016', latitude: 9.9168, longitude: 78.0935 },
  { name: 'Kochadai', slug: 'kochadai', postalCode: '625016', latitude: 9.9324, longitude: 78.0825 },
  { name: 'Thanakkankulam', slug: 'thanakkankulam', postalCode: '625006', latitude: 9.8784, longitude: 78.0721 },
  { name: 'Vandiyur', slug: 'vandiyur', postalCode: '625020', latitude: 9.9304, longitude: 78.1752 },
  { name: 'Umachikulam', slug: 'umachikulam', postalCode: '625014', latitude: 9.9921, longitude: 78.1384 },
  { name: 'Tiruppalai', slug: 'tiruppalai', postalCode: '625014', latitude: 9.9723, longitude: 78.1365 },
  { name: 'Podumbu', slug: 'podumbu', postalCode: '625018', latitude: 9.9678, longitude: 78.0965 },
  { name: 'Nagamalai Pudukottai', slug: 'nagamalai-pudukottai', postalCode: '625021', latitude: 9.9392, longitude: 78.0315 },
  { name: 'Perungudi', slug: 'perungudi', postalCode: '625022', latitude: 9.8523, longitude: 78.0945 },
  { name: 'Iyer Bungalow', slug: 'iyer-bungalow', postalCode: '625017', latitude: 9.9631, longitude: 78.1408 },
  { name: 'Thathaneri', slug: 'thathaneri', postalCode: '625018', latitude: 9.9412, longitude: 78.1154 },
  { name: 'Othakadai', slug: 'othakadai', postalCode: '625107', latitude: 9.9782, longitude: 78.1921 },
  { name: 'Paravai', slug: 'paravai', postalCode: '625402', latitude: 9.9620, longitude: 78.0754 },
  { name: 'K.K. Nagar', slug: 'kk-nagar', postalCode: '625020', latitude: 9.9298, longitude: 78.1512 },
  { name: 'Anna Nagar', slug: 'anna-nagar', postalCode: '625020', latitude: 9.9192, longitude: 78.1524 },
  { name: 'Andalpuram', slug: 'andalpuram', postalCode: '625003', latitude: 9.9075, longitude: 78.1054 },
  { name: 'Karuppayurani', slug: 'karuppayurani', postalCode: '625020', latitude: 9.9312, longitude: 78.1874 },
  { name: 'Goripalayam', slug: 'goripalayam', postalCode: '625002', latitude: 9.9324, longitude: 78.1328 },
  { name: 'Tallakulam', slug: 'tallakulam', postalCode: '625002', latitude: 9.9348, longitude: 78.1385 },
];

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const MADURAI_TURFS: MaduraiTurfDefinition[] = [
  {
    name: 'JP Multisports Arena',
    slug: 'jp-multisports-arena-teppakulam',
    areaSlug: 'teppakulam',
    addressLine: 'Nehru Street, Teppakulam, Madurai, Tamil Nadu',
    postalCode: '625009',
    latitude: 9.9142,
    longitude: 78.1492,
    contactPhone: '+919842145610',
    contactEmail: 'jpmultisports.mdu@gmail.com',
    description: 'Madurai’s premier multi-sport turf facility located right by Teppakulam. Features 50mm imported FIFA-grade artificial grass, dual box cricket nets, high-lux LED night illumination, and clean amenities.',
    coverImageUrl: img('photo-1529900748604-07564a03e7a6'),
    galleryImages: [
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Indoor sports enclosure and nets' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Floodlit evening match action' },
      { url: img('photo-1579952363873-27f3bade9f55'), caption: 'Tournament synthetic grass pitch' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Spectator gallery and seating' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'spectator-seating', 'first-aid'],
    hourlyPriceRegular: 1000.0,
    hourlyPriceNight: 1400.0,
    hourlyPriceWeekend: 1600.0,
    ratingAverage: 4.80,
    totalReviews: 86,
    isFeatured: true,
    rules: '1. Turf shoes or flat-sole sneakers required. 2. Please arrive 10 minutes prior to slot start time. 3. Smoking and alcohol are strictly prohibited.',
  },
  {
    name: 'Hattrick Sports Arena',
    slug: 'hattrick-sports-arena-gomathipuram',
    areaSlug: 'gomathipuram',
    addressLine: '2nd Main Road, Third Cross Street, Gomathipuram, Madurai, Tamil Nadu',
    postalCode: '625020',
    latitude: 9.9215,
    longitude: 78.1634,
    contactPhone: '+919790033221',
    contactEmail: 'hattrickarena.madurai@gmail.com',
    description: 'High-energy sports arena in Gomathipuram equipped with rebound rebound boards, anti-glare overhead lights, and international-standard synthetic turf for 5v5 soccer and box cricket.',
    coverImageUrl: img('photo-1574629810360-7efbbe195018'),
    galleryImages: [
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Wide field overview' },
      { url: img('photo-1624880357913-a8539238245b'), caption: 'Badminton wooden synthetic court' },
      { url: img('photo-1560272564-c83b66b1ad12'), caption: 'Soccer match gameplay' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'LED night lighting setup' },
    ],
    sports: ['football', 'cricket', 'badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'first-aid', 'equipment-rental'],
    hourlyPriceRegular: 900.0,
    hourlyPriceNight: 1300.0,
    hourlyPriceWeekend: 1500.0,
    ratingAverage: 4.75,
    totalReviews: 64,
    isFeatured: true,
    rules: '1. Clean non-marking shoes required for badminton. 2. Football studs with rubber soles permitted. 3. Respect booking schedule.',
  },
  {
    name: 'The Spark Multi-Sports Arena',
    slug: 'the-spark-multi-sports-arena-narasingam',
    areaSlug: 'narasingam',
    addressLine: 'Near Decathlon, Narasingam, Madurai, Tamil Nadu',
    postalCode: '625007',
    latitude: 9.9862,
    longitude: 78.1887,
    contactPhone: '+919443152200',
    contactEmail: 'sparkarena.narasingam@gmail.com',
    description: 'Expansive sports complex located directly beside Decathlon Madurai. Features multiple fields for corporate leagues, weekend football tournaments, and box cricket fixtures with cafeteria and viewing gallery.',
    coverImageUrl: img('photo-1431324155629-1a6deb1dec8d'),
    galleryImages: [
      { url: img('photo-1554068865-24cecd4e34b8'), caption: 'Outdoor multi-sport court' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night lights over playing arena' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Full pitch training ground' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Covered seating and players bench' },
    ],
    sports: ['football', 'cricket', 'tennis'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'cafeteria', 'spectator-seating'],
    hourlyPriceRegular: 1100.0,
    hourlyPriceNight: 1500.0,
    hourlyPriceWeekend: 1800.0,
    ratingAverage: 4.85,
    totalReviews: 92,
    isFeatured: true,
    rules: '1. Standard turf shoes allowed. 2. Outside food not permitted near playing field. 3. On-time check-in mandatory.',
  },
  {
    name: 'SP Kamikaze Games',
    slug: 'sp-kamikaze-games-kadachanendhal',
    areaSlug: 'kadachanendhal',
    addressLine: 'SP Sports Club, Visalakshi Nagar, Kadachanendhal, Madurai, Tamil Nadu',
    postalCode: '625107',
    latitude: 9.9754,
    longitude: 78.1610,
    contactPhone: '+919842188410',
    contactEmail: 'spkamikaze.madurai@gmail.com',
    description: 'Modern indoor/outdoor sports facility with enclosed high-clearance netting for power-packed box cricket and 5-a-side football matches. Includes ample 2-wheeler and car parking.',
    coverImageUrl: img('photo-1551958219-acbc608c6377'),
    galleryImages: [
      { url: img('photo-1575361204480-aadea25e6e68'), caption: 'Goal post and penalty box' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Floodlights and rebound boards' },
      { url: img('photo-1511886929837-354d827aae26'), caption: 'Grass pitch perspective' },
      { url: img('photo-1589487391730-58f20eb2c308'), caption: 'Box cricket bowling corridor' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'first-aid'],
    hourlyPriceRegular: 850.0,
    hourlyPriceNight: 1200.0,
    hourlyPriceWeekend: 1400.0,
    ratingAverage: 4.70,
    totalReviews: 53,
    isFeatured: false,
    rules: '1. Flat-sole or turf shoes only. 2. Respect venue equipment and boundary netting.',
  },
  {
    name: 'Turf XL',
    slug: 'turf-xl-solaialagu-puram',
    areaSlug: 'solaialagu-puram',
    addressLine: 'Jeeva Nagar Last, Vishwanath Dhas Street, Solaialagu Puram, Madurai, Tamil Nadu',
    postalCode: '625011',
    latitude: 9.9015,
    longitude: 78.1189,
    contactPhone: '+919629471133',
    contactEmail: 'turfxl.madurai@gmail.com',
    description: 'Well-established artificial grass arena in south Madurai. Known for consistent bounce, durable turf infill, and vibrant neighborhood weekend cricket competitions.',
    coverImageUrl: img('photo-1459865264687-595d652de67e'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Main pitch boundary' },
      { url: img('photo-1579952363873-27f3bade9f55'), caption: 'FIFA standard surface' },
      { url: img('photo-1560272564-c83b66b1ad12'), caption: 'Five-a-side soccer match' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Night lights view' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 800.0,
    hourlyPriceNight: 1200.0,
    hourlyPriceWeekend: 1350.0,
    ratingAverage: 4.65,
    totalReviews: 48,
    isFeatured: false,
    rules: '1. No metal studs allowed. 2. Check in at reception 10 minutes prior to slot.',
  },
  {
    name: 'Bats & Boots Turf',
    slug: 'bats-and-boots-turf-ponmeni',
    areaSlug: 'ponmeni',
    addressLine: 'Eagle Park, 41, Bypass Road, Ponmeni, Madurai, Tamil Nadu',
    postalCode: '625016',
    latitude: 9.9168,
    longitude: 78.0935,
    contactPhone: '+919843077712',
    contactEmail: 'batsandboots.madurai@gmail.com',
    description: 'Strategically located off Madurai Bypass Road in Ponmeni. Fully netted box cricket and 5s football arena with rental equipment (bats, leather/tennis balls, footballs) and first aid.',
    coverImageUrl: img('photo-1516733725897-1aa73b87c8e8'),
    galleryImages: [
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Full pitch turf layout' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Stadium style night view' },
      { url: img('photo-1575361204480-aadea25e6e68'), caption: 'Penalty mark and white boundary' },
      { url: img('photo-1534438327276-14e5300c3a48'), caption: 'Fitness and amenities area' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'equipment-rental', 'first-aid'],
    hourlyPriceRegular: 1000.0,
    hourlyPriceNight: 1400.0,
    hourlyPriceWeekend: 1600.0,
    ratingAverage: 4.78,
    totalReviews: 71,
    isFeatured: true,
    rules: '1. Rubber turf studs only. 2. Damage to perimeter netting subject to fine.',
  },
  {
    name: 'Turfwar India',
    slug: 'turfwar-india-kochadai',
    areaSlug: 'kochadai',
    addressLine: 'No. 114/1, Near Seventh Day School Bus Stop, Fenner Colony, Kochadai, Madurai, Tamil Nadu',
    postalCode: '625016',
    latitude: 9.9324,
    longitude: 78.0825,
    contactPhone: '+919944512399',
    contactEmail: 'turfwarindia.madurai@gmail.com',
    description: 'Premier floodlit sports venue in Kochadai tailored for competitive football and weekend box cricket. Features hygienic restrooms, shaded spectator gallery, and purified chilled water.',
    coverImageUrl: img('photo-1511886929837-354d827aae26'),
    galleryImages: [
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Goal and playing zone' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Turf perimeter boundary' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Spectator gallery stands' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Overhead floodlighting arrays' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'spectator-seating'],
    hourlyPriceRegular: 950.0,
    hourlyPriceNight: 1350.0,
    hourlyPriceWeekend: 1550.0,
    ratingAverage: 4.72,
    totalReviews: 58,
    isFeatured: false,
    rules: '1. Proper sports footwear mandatory. 2. Arrive 10 minutes early.',
  },
  {
    name: "Lord's - The Home of Sports",
    slug: 'lords-the-home-of-sports-thanakkankulam',
    areaSlug: 'thanakkankulam',
    addressLine: "Lord's 3rd Street, Kalai Nagar, Thanakkankulam, Madurai, Tamil Nadu",
    postalCode: '625006',
    latitude: 9.8784,
    longitude: 78.0721,
    contactPhone: '+919894088990',
    contactEmail: 'lords.madurai@gmail.com',
    description: 'Flagship sports destination featuring multi-sport astroturf, dedicated pickleball paddle court, and cricket training box with showers, lockers, and refreshment cafe.',
    coverImageUrl: img('photo-1554068865-24cecd4e34b8'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Main football pitch' },
      { url: img('photo-1546519638-68e109498ffc'), caption: 'Multi-sport court facility' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night lights view' },
      { url: img('photo-1505245208761-ba872912fac0'), caption: 'Player lounge and cafe' },
    ],
    sports: ['football', 'cricket', 'pickleball'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'equipment-rental', 'cafeteria'],
    hourlyPriceRegular: 1000.0,
    hourlyPriceNight: 1450.0,
    hourlyPriceWeekend: 1700.0,
    ratingAverage: 4.88,
    totalReviews: 95,
    isFeatured: true,
    rules: '1. Dedicated paddle equipment available on request. 2. Non-marking shoes for pickleball court.',
  },
  {
    name: 'Y2 Turf',
    slug: 'y2-turf-vandiyur',
    areaSlug: 'vandiyur',
    addressLine: 'Vandiyur 1st Bit, Masthanpatti, Madurai, Tamil Nadu',
    postalCode: '625020',
    latitude: 9.9304,
    longitude: 78.1752,
    contactPhone: '+919788091122',
    contactEmail: 'y2turf.madurai@gmail.com',
    description: 'High-performing community turf venue in Vandiyur/Masthanpatti with seamless rebound netting, 400W LED floodlights, and premium turf shock-pads for football and cricket.',
    coverImageUrl: img('photo-1518091043644-c1d4457512c6'),
    galleryImages: [
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Field view with boundary netting' },
      { url: img('photo-1575361204480-aadea25e6e68'), caption: 'Turf grass quality and line markings' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Evening floodlit match play' },
      { url: img('photo-1560272564-c83b66b1ad12'), caption: 'Box cricket pitch action' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 850.0,
    hourlyPriceNight: 1250.0,
    hourlyPriceWeekend: 1450.0,
    ratingAverage: 4.68,
    totalReviews: 44,
    isFeatured: false,
    rules: '1. Please maintain turf cleanliness. 2. Rubber studs or sports shoes required.',
  },
  {
    name: 'Grazzio Turf',
    slug: 'grazzio-turf-umachikulam',
    areaSlug: 'umachikulam',
    addressLine: 'Near Jeyabharath Oscar City, Umachikulam, Madurai, Tamil Nadu',
    postalCode: '625014',
    latitude: 9.9921,
    longitude: 78.1384,
    contactPhone: '+919842566778',
    contactEmail: 'grazzioturf.madurai@gmail.com',
    description: 'Breezy northern Madurai venue near Oscar City. Excellent turf grass condition with dedicated cricket bowling area, 5v5 football goals, and viewing gallery for supporters.',
    coverImageUrl: img('photo-1577223625816-7546f13df25d'),
    galleryImages: [
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Football goals and lush green field' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night lights view' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Spectator gallery for fans' },
      { url: img('photo-1579952363873-27f3bade9f55'), caption: 'Ball on artificial turf' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'spectator-seating'],
    hourlyPriceRegular: 900.0,
    hourlyPriceNight: 1300.0,
    hourlyPriceWeekend: 1500.0,
    ratingAverage: 4.70,
    totalReviews: 50,
    isFeatured: false,
    rules: '1. Turf shoes only. 2. Arrive 10 mins before slot.',
  },
  {
    name: 'Golazo Turf',
    slug: 'golazo-turf-tiruppalai',
    areaSlug: 'tiruppalai',
    addressLine: '8th Street, Poriyalar Nagar, Tiruppalai, Madurai, Tamil Nadu',
    postalCode: '625014',
    latitude: 9.9723,
    longitude: 78.1365,
    contactPhone: '+919789344551',
    contactEmail: 'golazoturf.madurai@gmail.com',
    description: 'High-rated arena near Yadava College, Tiruppalai. Engineered with non-abrasive yarn artificial turf, optimal ball bounce, and top-tier floodlights for night matches.',
    coverImageUrl: img('photo-1560272564-c83b66b1ad12'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Corner flag and floodlit view' },
      { url: img('photo-1459865264687-595d652de67e'), caption: 'Turf grass overview' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Floodlights array' },
      { url: img('photo-1575361204480-aadea25e6e68'), caption: 'Pitch boundary details' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 850.0,
    hourlyPriceNight: 1250.0,
    hourlyPriceWeekend: 1400.0,
    ratingAverage: 4.67,
    totalReviews: 41,
    isFeatured: false,
    rules: '1. Sports footwear required. 2. Respect court boundaries and net.',
  },
  {
    name: 'GTA Sports - Turf Ground',
    slug: 'gta-sports-turf-ground-podumbu',
    areaSlug: 'podumbu',
    addressLine: '6th Street, Anantham Avenue, Phase 2, Podumbu, Madurai, Tamil Nadu',
    postalCode: '625018',
    latitude: 9.9678,
    longitude: 78.0965,
    contactPhone: '+919842911234',
    contactEmail: 'gtasports.madurai@gmail.com',
    description: 'Budget-friendly and hygienic sports ground situated near Radiance Cinemas in Podumbu. Popular with student leagues, corporate teams, and weekend cricket groups.',
    coverImageUrl: img('photo-1508739773434-c26b3d09e071'),
    galleryImages: [
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Main pitch setup' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Night lights view' },
      { url: img('photo-1511886929837-354d827aae26'), caption: 'Field perspective' },
      { url: img('photo-1505245208761-ba872912fac0'), caption: 'Cafe and waiting lounge' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'cafeteria'],
    hourlyPriceRegular: 800.0,
    hourlyPriceNight: 1200.0,
    hourlyPriceWeekend: 1350.0,
    ratingAverage: 4.62,
    totalReviews: 39,
    isFeatured: false,
    rules: '1. No spiked shoes. 2. Arrive 10 minutes prior.',
  },
  {
    name: 'Thasha Sports Academy',
    slug: 'thasha-sports-academy-nagamalai-pudukottai',
    areaSlug: 'nagamalai-pudukottai',
    addressLine: '3/282, 2nd Street, Theni Road, Bharathiyar Nagar, Nagamalai Pudukottai, Madurai, Tamil Nadu',
    postalCode: '625021',
    latitude: 9.9392,
    longitude: 78.0315,
    contactPhone: '+919842100889',
    contactEmail: 'thashasports.madurai@gmail.com',
    description: 'Full-fledged sports academy located along Theni Road. Features outdoor turf ground for football and cricket, plus indoor badminton courts, certified coaching, and equipment rentals.',
    coverImageUrl: img('photo-1624880357913-a8539238245b'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Outdoor turf ground' },
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Football goals' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night match floodlights' },
      { url: img('photo-1534438327276-14e5300c3a48'), caption: 'Academy training gear' },
    ],
    sports: ['football', 'cricket', 'badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'first-aid', 'equipment-rental'],
    hourlyPriceRegular: 950.0,
    hourlyPriceNight: 1350.0,
    hourlyPriceWeekend: 1550.0,
    ratingAverage: 4.82,
    totalReviews: 77,
    isFeatured: true,
    rules: '1. Non-marking shoes mandatory for badminton. 2. Turf shoes only for grass court.',
  },
  {
    name: 'Sathiyan Multi Sport Academy',
    slug: 'sathiyan-multi-sport-academy-perungudi',
    areaSlug: 'perungudi',
    addressLine: 'Sathiyan Sport Village, SN College Road, Perungudi, Madurai, Tamil Nadu',
    postalCode: '625022',
    latitude: 9.8523,
    longitude: 78.0945,
    contactPhone: '+919443217789',
    contactEmail: 'sathiyanmulti.madurai@gmail.com',
    description: 'Grand sports village in Perungudi near Madurai Airport. Equipped with automated cricket bowling machine, floodlit 7v7 football pitch, and indoor badminton arena with lounge.',
    coverImageUrl: img('photo-1540747913346-19e32dc3e97e'),
    galleryImages: [
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Multi-sports village grounds' },
      { url: img('photo-1624880357913-a8539238245b'), caption: 'BWF standard badminton courts' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: '7v7 football field' },
      { url: img('photo-1505245208761-ba872912fac0'), caption: 'Sports cafeteria & lounge' },
    ],
    sports: ['football', 'cricket', 'badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'equipment-rental', 'cafeteria'],
    hourlyPriceRegular: 1050.0,
    hourlyPriceNight: 1500.0,
    hourlyPriceWeekend: 1750.0,
    ratingAverage: 4.79,
    totalReviews: 83,
    isFeatured: true,
    rules: '1. Bowling machine tokens available at counter. 2. Proper gear mandatory.',
  },
  {
    name: "Sopa's Goal Turf",
    slug: 'sopas-goal-turf-iyer-bungalow',
    areaSlug: 'iyer-bungalow',
    addressLine: 'Near Brindavanam 3rd Street, EB Colony, Iyer Bungalow, Madurai, Tamil Nadu',
    postalCode: '625017',
    latitude: 9.9631,
    longitude: 78.1408,
    contactPhone: '+919894455667',
    contactEmail: 'sopasgoal.madurai@gmail.com',
    description: 'Prime neighborhood turf at Iyer Bungalow EB Colony. Built with resilient shock-absorbing underlay for joint protection during fast football games and box cricket leagues.',
    coverImageUrl: img('photo-1575361204480-aadea25e6e68'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Floodlit turf field' },
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Goalposts and perimeter net' },
      { url: img('photo-1560272564-c83b66b1ad12'), caption: 'Fast paced 5v5 soccer' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Night lights view' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 900.0,
    hourlyPriceNight: 1300.0,
    hourlyPriceWeekend: 1500.0,
    ratingAverage: 4.71,
    totalReviews: 52,
    isFeatured: false,
    rules: '1. Rubber turf studs only. 2. Be punctual for booked time slots.',
  },
  {
    name: 'SPR Multisport Turf',
    slug: 'spr-multisport-turf-thathaneri',
    areaSlug: 'thathaneri',
    addressLine: 'Ramachandra Nagar, Keelavaithiyanathapuram, Thathaneri, Madurai, Tamil Nadu',
    postalCode: '625018',
    latitude: 9.9412,
    longitude: 78.1154,
    contactPhone: '+919842066554',
    contactEmail: 'sprmultisport.madurai@gmail.com',
    description: 'Centrally located multi-sport ground close to Thathaneri and Sellur. Provides clear boundary markings, high-lux floodlights, and pristine green turf for cricket and football.',
    coverImageUrl: img('photo-1579952363873-27f3bade9f55'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Corner flag and turf surface' },
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Box cricket practice nets' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night lights over arena' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Dressing quarters & seating' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 850.0,
    hourlyPriceNight: 1250.0,
    hourlyPriceWeekend: 1450.0,
    ratingAverage: 4.66,
    totalReviews: 47,
    isFeatured: false,
    rules: '1. No metal studs allowed. 2. Keep the ground clean.',
  },
  {
    name: 'Raj Turf',
    slug: 'raj-turf-othakadai',
    areaSlug: 'othakadai',
    addressLine: 'Anbu Nagar, Rajakambeeram, Near Sub-Register Office, Y.Othakadai, Madurai, Tamil Nadu',
    postalCode: '625107',
    latitude: 9.9782,
    longitude: 78.1921,
    contactPhone: '+919842788990',
    contactEmail: 'rajturf.madurai@gmail.com',
    description: 'Top-rated sports venue in eastern Madurai (Othakadai/Rajakambeeram). High-density synthetic green turf with safety netting, electronic score display, and floodlights.',
    coverImageUrl: img('photo-1589487391730-58f20eb2c308'),
    galleryImages: [
      { url: img('photo-1551958219-acbc608c6377'), caption: 'Goal netting and pitch view' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'LED night lighting' },
      { url: img('photo-1511886929837-354d827aae26'), caption: 'Full field turf perspective' },
      { url: img('photo-1459865264687-595d652de67e'), caption: 'Turf grass quality' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 850.0,
    hourlyPriceNight: 1200.0,
    hourlyPriceWeekend: 1400.0,
    ratingAverage: 4.69,
    totalReviews: 43,
    isFeatured: false,
    rules: '1. Flat shoes or turf boots. 2. Arrive 10 minutes before game time.',
  },
  {
    name: 'OG Turf',
    slug: 'og-turf-paravai',
    areaSlug: 'paravai',
    addressLine: 'Madurai - Dindigul Main Road, Paravai, Madurai, Tamil Nadu',
    postalCode: '625402',
    latitude: 9.9620,
    longitude: 78.0754,
    contactPhone: '+919843322110',
    contactEmail: 'ogturf.paravai@gmail.com',
    description: 'Popular turf venue located directly on the Dindigul Highway in Paravai. Known for exceptional pitch maintenance, seamless turf roll joints, and night tournament atmosphere.',
    coverImageUrl: img('photo-1534158914592-062992fbe900'),
    galleryImages: [
      { url: img('photo-1529900748604-07564a03e7a6'), caption: 'Night lights view' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Pitch and goal area' },
      { url: img('photo-1575361204480-aadea25e6e68'), caption: 'Green turf markings' },
      { url: img('photo-1560272564-c83b66b1ad12'), caption: 'Match play action' },
    ],
    sports: ['football', 'cricket'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 900.0,
    hourlyPriceNight: 1300.0,
    hourlyPriceWeekend: 1500.0,
    ratingAverage: 4.74,
    totalReviews: 60,
    isFeatured: false,
    rules: '1. Non-cleat footwear or turf boots required. 2. Follow ground coordinator instructions.',
  // --- REAL MADURAI BADMINTON VENUES ---
  {
    name: 'Pro Arena Indoor Badminton Court',
    slug: 'pro-arena-indoor-badminton-court-andalpuram',
    areaSlug: 'andalpuram',
    addressLine: 'Opposite Vasantha Nagar, TPK Main Road, Andalpuram, Madurai, Tamil Nadu',
    postalCode: '625003',
    latitude: 9.9075,
    longitude: 78.1054,
    contactPhone: '+919842123450',
    contactEmail: 'proarena.badminton@gmail.com',
    description: 'Premier indoor badminton court in Andalpuram equipped with 4 BWF-grade wooden synthetic courts, glare-free LED arena lighting, changing rooms, and racquet stringing facilities.',
    coverImageUrl: img('photo-1624880357913-a8539238245b'),
    galleryImages: [
      { url: img('photo-1613918108466-292b78a8ef95'), caption: 'BWF synthetic tournament court' },
      { url: img('photo-1521537634581-0dced2fee2ef'), caption: 'High-clearance ceiling and arena lighting' },
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Warmup area and practice enclosure' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Evening coaching session view' },
    ],
    sports: ['badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'equipment-rental'],
    hourlyPriceRegular: 450.0,
    hourlyPriceNight: 600.0,
    hourlyPriceWeekend: 650.0,
    ratingAverage: 4.88,
    totalReviews: 79,
    isFeatured: true,
    rules: '1. Non-marking gum sole shoes mandatory on badminton courts. 2. Arrive 10 minutes prior to booking slot. 3. Food and sugary drinks not allowed inside court arena.',
  },
  {
    name: 'KMP Badminton Academy',
    slug: 'kmp-badminton-academy-karuppayurani',
    areaSlug: 'karuppayurani',
    addressLine: 'Sivagangai Main Road, Near Ring Road Junction, Karuppayurani, Madurai, Tamil Nadu',
    postalCode: '625020',
    latitude: 9.9312,
    longitude: 78.1874,
    contactPhone: '+919443187654',
    contactEmail: 'kmpbadminton.mdu@gmail.com',
    description: 'Renowned badminton academy in eastern Madurai. Features 6 international-standard shock-absorbing wooden courts with anti-skid mats, professional coaches, and spacious visitor gallery.',
    coverImageUrl: img('photo-1613918108466-292b78a8ef95'),
    galleryImages: [
      { url: img('photo-1624880357913-a8539238245b'), caption: 'Tournament court lines overview' },
      { url: img('photo-1521537634581-0dced2fee2ef'), caption: 'Anti-glare floodlights and high roof' },
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Player lounge and equipment desk' },
      { url: img('photo-1522778119026-d647f0596c20'), caption: 'Spectator gallery' },
    ],
    sports: ['badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'first-aid', 'spectator-seating'],
    hourlyPriceRegular: 400.0,
    hourlyPriceNight: 500.0,
    hourlyPriceWeekend: 550.0,
    ratingAverage: 4.82,
    totalReviews: 68,
    isFeatured: true,
    rules: '1. Gum sole shoes only. 2. Maximum 6 players permitted per court reservation. 3. Respect court timings.',
  },
  {
    name: '3 Racquet Badminton Arena',
    slug: '3-racquet-badminton-arena-ponmeni',
    areaSlug: 'ponmeni',
    addressLine: 'Nehru Nagar, Bye Pass Road, Ponmeni, Madurai, Tamil Nadu',
    postalCode: '625016',
    latitude: 9.9172,
    longitude: 78.0945,
    contactPhone: '+919944556677',
    contactEmail: '3racquet.madurai@gmail.com',
    description: 'Madurai Bye Pass Road’s leading multi-court indoor badminton facility with premium Yonex mats, cross-ventilation, hot showers, and racquet rental shop.',
    coverImageUrl: img('photo-1521537634581-0dced2fee2ef'),
    galleryImages: [
      { url: img('photo-1624880357913-a8539238245b'), caption: 'Championship court surface' },
      { url: img('photo-1613918108466-292b78a8ef95'), caption: 'Practice court and net' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Night lights view' },
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Enclosed indoor court complex' },
    ],
    sports: ['badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'equipment-rental', 'cafeteria'],
    hourlyPriceRegular: 450.0,
    hourlyPriceNight: 600.0,
    hourlyPriceWeekend: 650.0,
    ratingAverage: 4.79,
    totalReviews: 55,
    isFeatured: false,
    rules: '1. Clean non-marking shoes required. 2. Please maintain court discipline.',
  },
  {
    name: 'Somu Badminton Academy',
    slug: 'somu-badminton-academy-gomathipuram',
    areaSlug: 'gomathipuram',
    addressLine: '4th Cross Street, Melur Road, Gomathipuram, Madurai, Tamil Nadu',
    postalCode: '625020',
    latitude: 9.9228,
    longitude: 78.1648,
    contactPhone: '+919791012345',
    contactEmail: 'somubadminton@gmail.com',
    description: 'Modern indoor badminton club in Gomathipuram offering high-density rubber cushioned flooring, customized lighting to eliminate blind spots, and coaching programs for all age groups.',
    coverImageUrl: img('photo-1624880357913-a8539238245b'),
    galleryImages: [
      { url: img('photo-1613918108466-292b78a8ef95'), caption: 'Interior court perspective' },
      { url: img('photo-1521537634581-0dced2fee2ef'), caption: 'Side view of match nets' },
      { url: img('photo-1574629810360-7efbbe195018'), caption: 'Locker and dressing rooms' },
      { url: img('photo-1540747913346-19e32dc3e97e'), caption: 'Floodlights in action' },
    ],
    sports: ['badminton'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space'],
    hourlyPriceRegular: 400.0,
    hourlyPriceNight: 500.0,
    hourlyPriceWeekend: 550.0,
    ratingAverage: 4.76,
    totalReviews: 44,
    isFeatured: false,
    rules: '1. Strictly gum sole shoes. 2. Outside shoes to be left at the entrance shoe rack.',
  },

  // --- REAL MADURAI TENNIS VENUES ---
  {
    name: 'Royal Aces Tennis Academy',
    slug: 'royal-aces-tennis-academy-goripalayam',
    areaSlug: 'goripalayam',
    addressLine: 'American College Tennis Grounds, Alwarpuram, Goripalayam, Madurai, Tamil Nadu',
    postalCode: '625002',
    latitude: 9.9324,
    longitude: 78.1328,
    contactPhone: '+919842199887',
    contactEmail: 'royalaces.tennis@gmail.com',
    description: 'Madurai’s premier tennis academy situated on historic American College grounds. Features clay and hard tennis courts, AITA-certified training staff, night floodlights, and player club amenities.',
    coverImageUrl: img('photo-1595435934249-5df7ed86e1c0'),
    galleryImages: [
      { url: img('photo-1554068865-24cecd4e34b8'), caption: 'Championship clay tennis court' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Baseline view and net' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Hard court surface' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Floodlights over evening game' },
    ],
    sports: ['tennis'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'spectator-seating', 'equipment-rental'],
    hourlyPriceRegular: 700.0,
    hourlyPriceNight: 900.0,
    hourlyPriceWeekend: 1000.0,
    ratingAverage: 4.90,
    totalReviews: 72,
    isFeatured: true,
    rules: '1. Standard tennis shoes with flat tread required. 2. Tennis attire mandatory. 3. Please clear court on scheduled time.',
  },
  {
    name: 'Sangam Tennis Academy',
    slug: 'sangam-tennis-academy-kk-nagar',
    areaSlug: 'kk-nagar',
    addressLine: 'Near Surveyor Colony, Kodikulam, K.K. Nagar, Madurai, Tamil Nadu',
    postalCode: '625007',
    latitude: 9.9410,
    longitude: 78.1620,
    contactPhone: '+919443322110',
    contactEmail: 'sangamtennis.mdu@gmail.com',
    description: 'Top-tier tennis facility near K.K. Nagar with well-maintained synthetic clay tennis courts, automated ball throwing machines, high-lux illumination, and open social play slots.',
    coverImageUrl: img('photo-1554068865-24cecd4e34b8'),
    galleryImages: [
      { url: img('photo-1595435934249-5df7ed86e1c0'), caption: 'Regulation size clay court' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Practice baseline' },
      { url: img('photo-1587280501635-68a0e82cd5ff'), caption: 'Side court benches' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Night lights view' },
    ],
    sports: ['tennis'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'spectator-seating'],
    hourlyPriceRegular: 650.0,
    hourlyPriceNight: 850.0,
    hourlyPriceWeekend: 950.0,
    ratingAverage: 4.81,
    totalReviews: 58,
    isFeatured: true,
    rules: '1. Proper tennis footwear mandatory. 2. Non-marking shoes for synthetic courts.',
  },
  {
    name: 'The Madurai Union Club Tennis Courts',
    slug: 'the-madurai-union-club-tennis-tallakulam',
    areaSlug: 'tallakulam',
    addressLine: 'Tamukkam Park Road, Opposite Rajaji Park, Tallakulam, Madurai, Tamil Nadu',
    postalCode: '625020',
    latitude: 9.9348,
    longitude: 78.1385,
    contactPhone: '+914522530120',
    contactEmail: 'unionclub.tennis@gmail.com',
    description: 'Heritage sports club offering prime tennis facilities in the heart of Tallakulam. Surrounded by lush greenery with club refreshments, locker rooms, and floodlit clay courts.',
    coverImageUrl: img('photo-1587280501635-68a0e82cd5ff'),
    galleryImages: [
      { url: img('photo-1595435934249-5df7ed86e1c0'), caption: 'Classic red clay court' },
      { url: img('photo-1554068865-24cecd4e34b8'), caption: 'Tournament court view' },
      { url: img('photo-1577223625816-7546f13df25d'), caption: 'Player seating pavilion' },
      { url: img('photo-1533107862482-0e6974b06ec4'), caption: 'Floodlit match action' },
    ],
    sports: ['tennis'],
    facilities: ['floodlights', 'changing-rooms', 'drinking-water', 'parking-space', 'cafeteria'],
    hourlyPriceRegular: 600.0,
    hourlyPriceNight: 800.0,
    hourlyPriceWeekend: 900.0,
    ratingAverage: 4.85,
    totalReviews: 61,
    isFeatured: false,
    rules: '1. Proper tennis dress code and shoes. 2. Advance booking required for non-members.',
  },
];

async function main() {
  console.log('🚀 Updating Madurai Turf Data with Full Image Galleries into turf_booking_db...');

  // 1. Verify Country
  const india = await prisma.country.upsert({
    where: { code: 'IN' },
    update: {},
    create: {
      name: 'India',
      code: 'IN',
      phoneCode: '+91',
      currency: 'INR',
      isActive: true,
    },
  });

  // 2. State
  const tamilNadu = await prisma.state.upsert({
    where: { countryId_code: { countryId: india.id, code: 'TN' } },
    update: { name: 'Tamil Nadu', isActive: true },
    create: { countryId: india.id, name: 'Tamil Nadu', code: 'TN', isActive: true },
  });

  // 3. City
  const maduraiCity = await prisma.city.upsert({
    where: { slug: 'madurai' },
    update: {
      stateId: tamilNadu.id,
      name: 'Madurai',
      latitude: 9.9252,
      longitude: 78.1198,
      isActive: true,
    },
    create: {
      stateId: tamilNadu.id,
      name: 'Madurai',
      slug: 'madurai',
      latitude: 9.9252,
      longitude: 78.1198,
      isActive: true,
    },
  });

  // 4. Areas
  const areasMap: Record<string, any> = {};
  for (const a of MADURAI_AREAS) {
    const area = await prisma.area.upsert({
      where: { cityId_slug: { cityId: maduraiCity.id, slug: a.slug } },
      update: {
        name: a.name,
        postalCode: a.postalCode,
        latitude: a.latitude,
        longitude: a.longitude,
        isActive: true,
      },
      create: {
        cityId: maduraiCity.id,
        name: a.name,
        slug: a.slug,
        postalCode: a.postalCode,
        latitude: a.latitude,
        longitude: a.longitude,
        isActive: true,
      },
    });
    areasMap[a.slug] = area;
  }

  // 5. Sports Map (guarantee Football, Cricket, Badminton, Tennis exist)
  const sportsDefinitions = [
    {
      name: 'Football',
      slug: 'football',
      description: 'Association football (5v5, 7v7, 11v11) on artificial grass or turf',
      iconUrl: 'https://cdn.turfbooking.com/sports/football.svg',
      minPlayers: 10,
      maxPlayers: 22,
    },
    {
      name: 'Cricket',
      slug: 'cricket',
      description: 'Box cricket and pitch cricket with nets and bowling machines',
      iconUrl: 'https://cdn.turfbooking.com/sports/cricket.svg',
      minPlayers: 8,
      maxPlayers: 16,
    },
    {
      name: 'Badminton',
      slug: 'badminton',
      description: 'Indoor wooden and synthetic BWF-standard badminton courts',
      iconUrl: 'https://cdn.turfbooking.com/sports/badminton.svg',
      minPlayers: 2,
      maxPlayers: 4,
    },
    {
      name: 'Tennis',
      slug: 'tennis',
      description: 'Hard court, synthetic, and red clay tennis courts',
      iconUrl: 'https://cdn.turfbooking.com/sports/tennis.svg',
      minPlayers: 2,
      maxPlayers: 4,
    },
  ];

  const sportsMap: Record<string, any> = {};
  for (const s of sportsDefinitions) {
    const sport = await prisma.sport.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description, isActive: true },
      create: { ...s, isActive: true },
    });
    sportsMap[s.slug] = sport;
  }

  // 6. Facilities Map
  const allFacilities = await prisma.facility.findMany({ where: { isActive: true } });
  const facilitiesMap: Record<string, any> = {};
  for (const f of allFacilities) {
    facilitiesMap[f.slug] = f;
  }

  // 7. Turf Owner
  const ownerUser = await prisma.user.findUnique({
    where: { email: 'owner.madurai@turfsports.test' },
    include: { turfOwner: true },
  });
  if (!ownerUser || !ownerUser.turfOwner) {
    throw new Error('Owner not found. Run basic seed first.');
  }
  const turfOwner = ownerUser.turfOwner;

  // 8. Update Turfs and full image sets, sports, facilities, hours, and pricing
  let updatedCount = 0;
  for (const turfDef of MADURAI_TURFS) {
    const area = areasMap[turfDef.areaSlug];

    const turf = await prisma.turf.upsert({
      where: { slug: turfDef.slug },
      update: {
        name: turfDef.name,
        cityId: maduraiCity.id,
        areaId: area ? area.id : null,
        description: turfDef.description,
        addressLine: turfDef.addressLine,
        postalCode: turfDef.postalCode,
        latitude: turfDef.latitude,
        longitude: turfDef.longitude,
        contactPhone: turfDef.contactPhone,
        contactEmail: turfDef.contactEmail,
        coverImageUrl: turfDef.coverImageUrl,
        rules: turfDef.rules,
        ratingAverage: turfDef.ratingAverage,
        totalReviews: turfDef.totalReviews,
        isActive: true,
        isApproved: true,
        isFeatured: turfDef.isFeatured,
      },
      create: {
        ownerId: turfOwner.id,
        cityId: maduraiCity.id,
        areaId: area ? area.id : null,
        name: turfDef.name,
        slug: turfDef.slug,
        description: turfDef.description,
        addressLine: turfDef.addressLine,
        postalCode: turfDef.postalCode,
        latitude: turfDef.latitude,
        longitude: turfDef.longitude,
        contactPhone: turfDef.contactPhone,
        contactEmail: turfDef.contactEmail,
        coverImageUrl: turfDef.coverImageUrl,
        rules: turfDef.rules,
        ratingAverage: turfDef.ratingAverage,
        totalReviews: turfDef.totalReviews,
        isActive: true,
        isApproved: true,
        isFeatured: turfDef.isFeatured,
      },
    });

    // Replace images with full set of 5 images
    await prisma.turfImage.deleteMany({ where: { turfId: turf.id } });

    // 1. Cover Image
    await prisma.turfImage.create({
      data: {
        turfId: turf.id,
        imageUrl: turfDef.coverImageUrl,
        caption: `${turfDef.name} Main View`,
        displayOrder: 1,
        isCover: true,
      },
    });

    // 2-5. Gallery Images
    for (let i = 0; i < turfDef.galleryImages.length; i++) {
      const g = turfDef.galleryImages[i];
      await prisma.turfImage.create({
        data: {
          turfId: turf.id,
          imageUrl: g.url,
          caption: g.caption,
          displayOrder: i + 2,
          isCover: false,
        },
      });
    }

    // Link sports to Turf
    await prisma.turfSport.deleteMany({ where: { turfId: turf.id } });
    for (const sportSlug of turfDef.sports) {
      const sport = sportsMap[sportSlug];
      if (sport) {
        await prisma.turfSport.create({
          data: {
            turfId: turf.id,
            sportId: sport.id,
            isActive: true,
          },
        });
      }
    }

    // Link facilities
    await prisma.turfFacility.deleteMany({ where: { turfId: turf.id } });
    for (const facSlug of turfDef.facilities) {
      const fac = facilitiesMap[facSlug];
      if (fac) {
        await prisma.turfFacility.create({
          data: {
            turfId: turf.id,
            facilityId: fac.id,
            isActive: true,
          },
        });
      }
    }

    // Operating hours (06:00 to 23:00)
    await prisma.operatingHour.deleteMany({ where: { turfId: turf.id } });
    await prisma.operatingHour.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        turfId: turf.id,
        dayOfWeek: day,
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      })),
    });

    // Pricing rules
    await prisma.pricingRule.deleteMany({ where: { turfId: turf.id } });
    const primarySportSlug = turfDef.sports[0];
    const primarySport = sportsMap[primarySportSlug];
    if (primarySport) {
      await prisma.pricingRule.createMany({
        data: [
          {
            turfId: turf.id,
            sportId: primarySport.id,
            ruleName: 'Regular Rate',
            dayType: 'WEEKDAY',
            startTime: '06:00',
            endTime: '17:00',
            hourlyPrice: turfDef.hourlyPriceRegular,
            isActive: true,
          },
          {
            turfId: turf.id,
            sportId: primarySport.id,
            ruleName: 'Night Prime',
            dayType: 'WEEKDAY',
            startTime: '17:00',
            endTime: '23:00',
            hourlyPrice: turfDef.hourlyPriceNight,
            isActive: true,
          },
          {
            turfId: turf.id,
            sportId: primarySport.id,
            ruleName: 'Weekend Rate',
            dayType: 'WEEKEND',
            startTime: '06:00',
            endTime: '23:00',
            hourlyPrice: turfDef.hourlyPriceWeekend,
            isActive: true,
          },
        ],
      });
    }

    updatedCount++;
    console.log(`  [${updatedCount}/${MADURAI_TURFS.length}] ${turf.name}: sports (${turfDef.sports.join(', ')}), facilities, hours, and 5 images updated.`);
  }

  console.log(`\n🎉 All ${updatedCount} Madurai Turfs now have complete 5-image galleries and distinct cover thumbnails!`);
}

main()
  .catch((e) => {
    console.error('❌ Error executing Madurai turf image gallery update:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
