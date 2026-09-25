import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Phase 2 database seeding for turf_booking_db...');

  // ---------------------------------------------------------------------------
  // 1. Roles
  // ---------------------------------------------------------------------------
  const roleNames = [
    { name: 'SUPER_ADMIN', description: 'Platform super administrator with global system access' },
    { name: 'ADMIN', description: 'Operations administrator for platform moderation and oversight' },
    { name: 'TURF_OWNER', description: 'Business owner managing multi-sport turf facilities' },
    { name: 'MANAGER', description: 'Venue manager assigned by turf owner' },
    { name: 'STAFF', description: 'On-site staff handling check-ins and grounds' },
    { name: 'CUSTOMER', description: 'End-user booking sport turfs and events' },
  ];

  const rolesMap: Record<string, any> = {};
  for (const r of roleNames) {
    rolesMap[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
  }
  console.log(`✅ Seeded ${Object.keys(rolesMap).length} standard RBAC roles.`);

  // ---------------------------------------------------------------------------
  // 2. Location Hierarchy (Country -> State -> City -> Area)
  // ---------------------------------------------------------------------------
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

  // States
  const karnataka = await prisma.state.upsert({
    where: { countryId_code: { countryId: india.id, code: 'KA' } },
    update: {},
    create: {
      countryId: india.id,
      name: 'Karnataka',
      code: 'KA',
      isActive: true,
    },
  });

  const maharashtra = await prisma.state.upsert({
    where: { countryId_code: { countryId: india.id, code: 'MH' } },
    update: {},
    create: {
      countryId: india.id,
      name: 'Maharashtra',
      code: 'MH',
      isActive: true,
    },
  });

  const telangana = await prisma.state.upsert({
    where: { countryId_code: { countryId: india.id, code: 'TG' } },
    update: {},
    create: {
      countryId: india.id,
      name: 'Telangana',
      code: 'TG',
      isActive: true,
    },
  });

  // Cities
  const bengaluru = await prisma.city.upsert({
    where: { slug: 'bengaluru' },
    update: {},
    create: {
      stateId: karnataka.id,
      name: 'Bengaluru',
      slug: 'bengaluru',
      latitude: 12.9716,
      longitude: 77.5946,
      isActive: true,
    },
  });

  const mumbai = await prisma.city.upsert({
    where: { slug: 'mumbai' },
    update: {},
    create: {
      stateId: maharashtra.id,
      name: 'Mumbai',
      slug: 'mumbai',
      latitude: 19.0760,
      longitude: 72.8777,
      isActive: true,
    },
  });

  const hyderabad = await prisma.city.upsert({
    where: { slug: 'hyderabad' },
    update: {},
    create: {
      stateId: telangana.id,
      name: 'Hyderabad',
      slug: 'hyderabad',
      latitude: 17.3850,
      longitude: 78.4867,
      isActive: true,
    },
  });

  // Areas
  const koramangala = await prisma.area.upsert({
    where: { cityId_slug: { cityId: bengaluru.id, slug: 'koramangala' } },
    update: {},
    create: {
      cityId: bengaluru.id,
      name: 'Koramangala',
      slug: 'koramangala',
      postalCode: '560034',
      latitude: 12.9352,
      longitude: 77.6245,
      isActive: true,
    },
  });

  const indiranagar = await prisma.area.upsert({
    where: { cityId_slug: { cityId: bengaluru.id, slug: 'indiranagar' } },
    update: {},
    create: {
      cityId: bengaluru.id,
      name: 'Indiranagar',
      slug: 'indiranagar',
      postalCode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      isActive: true,
    },
  });

  const bandraWest = await prisma.area.upsert({
    where: { cityId_slug: { cityId: mumbai.id, slug: 'bandra-west' } },
    update: {},
    create: {
      cityId: mumbai.id,
      name: 'Bandra West',
      slug: 'bandra-west',
      postalCode: '400050',
      latitude: 19.0596,
      longitude: 72.8295,
      isActive: true,
    },
  });

  const madhapur = await prisma.area.upsert({
    where: { cityId_slug: { cityId: hyderabad.id, slug: 'madhapur' } },
    update: {},
    create: {
      cityId: hyderabad.id,
      name: 'Madhapur',
      slug: 'madhapur',
      postalCode: '500081',
      latitude: 17.4483,
      longitude: 78.3915,
      isActive: true,
    },
  });

  console.log(`✅ Seeded Location Hierarchy: ${india.name} -> 3 States -> 3 Cities -> 4 Areas.`);

  // ---------------------------------------------------------------------------
  // 3. Basic Sports
  // ---------------------------------------------------------------------------
  const sportsList = [
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
      description: 'Hard court and synthetic clay outdoor tennis courts',
      iconUrl: 'https://cdn.turfbooking.com/sports/tennis.svg',
      minPlayers: 2,
      maxPlayers: 4,
    },
    {
      name: 'Pickleball',
      slug: 'pickleball',
      description: 'Rapidly growing paddle sport court with standard dimensions',
      iconUrl: 'https://cdn.turfbooking.com/sports/pickleball.svg',
      minPlayers: 2,
      maxPlayers: 4,
    },
    {
      name: 'Basketball',
      slug: 'basketball',
      description: 'FIBA standard full court and half court basketball facilities',
      iconUrl: 'https://cdn.turfbooking.com/sports/basketball.svg',
      minPlayers: 6,
      maxPlayers: 10,
    },
  ];

  const sportsMap: Record<string, any> = {};
  for (const s of sportsList) {
    sportsMap[s.slug] = await prisma.sport.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
  }
  console.log(`✅ Seeded ${Object.keys(sportsMap).length} basic sports.`);

  // ---------------------------------------------------------------------------
  // 4. Basic Facilities
  // ---------------------------------------------------------------------------
  const facilitiesList = [
    {
      name: 'Floodlights',
      slug: 'floodlights',
      description: 'High-lux LED floodlights for night gameplay',
      iconUrl: 'https://cdn.turfbooking.com/facilities/floodlights.svg',
    },
    {
      name: 'Changing Rooms',
      slug: 'changing-rooms',
      description: 'Separate hygienic changing rooms and restrooms for men and women',
      iconUrl: 'https://cdn.turfbooking.com/facilities/changing-rooms.svg',
    },
    {
      name: 'Drinking Water',
      slug: 'drinking-water',
      description: 'Complimentary RO purified chilled water dispenser',
      iconUrl: 'https://cdn.turfbooking.com/facilities/water.svg',
    },
    {
      name: 'Parking Space',
      slug: 'parking-space',
      description: 'Dedicated 2-wheeler and 4-wheeler vehicle parking',
      iconUrl: 'https://cdn.turfbooking.com/facilities/parking.svg',
    },
    {
      name: 'First Aid Kit',
      slug: 'first-aid',
      description: 'Emergency first aid medical kit and ice packs',
      iconUrl: 'https://cdn.turfbooking.com/facilities/first-aid.svg',
    },
    {
      name: 'Cafeteria',
      slug: 'cafeteria',
      description: 'Beverages, energy drinks, and fresh snacks lounge',
      iconUrl: 'https://cdn.turfbooking.com/facilities/cafe.svg',
    },
    {
      name: 'Equipment Rental',
      slug: 'equipment-rental',
      description: 'Baseballs, cricket bats, footballs, and racquets for rent',
      iconUrl: 'https://cdn.turfbooking.com/facilities/equipment.svg',
    },
    {
      name: 'Spectator Seating',
      slug: 'spectator-seating',
      description: 'Covered bleachers and viewing gallery for fans',
      iconUrl: 'https://cdn.turfbooking.com/facilities/bleachers.svg',
    },
  ];

  const facilitiesMap: Record<string, any> = {};
  for (const f of facilitiesList) {
    facilitiesMap[f.slug] = await prisma.facility.upsert({
      where: { slug: f.slug },
      update: f,
      create: f,
    });
  }
  console.log(`✅ Seeded ${Object.keys(facilitiesMap).length} basic venue facilities.`);

  // ---------------------------------------------------------------------------
  // 5. Seed Users & Mock Turf Owner
  // ---------------------------------------------------------------------------
  const defaultPasswordHash = await argon2.hash('TestSecurePass#2026');

  // Super Admin User
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin.demo@turfplatform.test' },
    update: {},
    create: {
      email: 'superadmin.demo@turfplatform.test',
      phone: '+919900000001',
      passwordHash: defaultPasswordHash,
      fullName: 'Platform Super Admin',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      roles: {
        create: [
          { roleId: rolesMap['SUPER_ADMIN'].id },
          { roleId: rolesMap['ADMIN'].id },
        ],
      },
    },
  });

  // Turf Owner User & Profile
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner.demo@turfarena.test' },
    update: {},
    create: {
      email: 'owner.demo@turfarena.test',
      phone: '+919800000002',
      passwordHash: defaultPasswordHash,
      fullName: 'Vikram Malhotra',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      roles: {
        create: [{ roleId: rolesMap['TURF_OWNER'].id }],
      },
      turfOwner: {
        create: {
          businessName: 'Spartan Sports Arena LLP',
          legalName: 'Spartan Sports Facilities Private Limited',
          panNumber: 'ABCDE1234F',
          gstNumber: '29ABCDE1234F1Z5',
          bankAccountNumber: '123456789012',
          bankIfsc: 'HDFC0000123',
          bankName: 'HDFC Bank',
          isVerified: true,
          isActive: true,
        },
      },
    },
    include: {
      turfOwner: true,
    },
  });

  const turfOwner = ownerUser.turfOwner!;

  // Customer User with Device & Address
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer.demo@sportfan.test' },
    update: {},
    create: {
      email: 'customer.demo@sportfan.test',
      phone: '+919700000003',
      passwordHash: defaultPasswordHash,
      fullName: 'Aditya Verma',
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      roles: {
        create: [{ roleId: rolesMap['CUSTOMER'].id }],
      },
      devices: {
        create: {
          deviceToken: 'mock_fcm_token_aditya_verma_ios_device_sample_2026',
          deviceType: 'IOS',
          deviceName: 'iPhone 15 Pro',
          osVersion: 'iOS 18.2',
          appVersion: '1.0.0',
        },
      },
      addresses: {
        create: {
          addressLine1: 'Flat 402, Green Glen Layout',
          addressLine2: 'Bellandur Outer Ring Road',
          cityId: bengaluru.id,
          stateId: karnataka.id,
          postalCode: '560103',
          addressType: 'HOME',
          isDefault: true,
        },
      },
    },
  });

  console.log(`✅ Seeded Users: Super Admin (${superAdmin.email}), Owner (${ownerUser.email}), Customer (${customerUser.email}).`);

  // ---------------------------------------------------------------------------
  // 6. Turf Venue with Sports, Facilities, Images, Operating Hours & Pricing
  // ---------------------------------------------------------------------------
  const spartanTurf = await prisma.turf.upsert({
    where: { slug: 'spartan-sports-arena-koramangala' },
    update: {},
    create: {
      ownerId: turfOwner.id,
      cityId: bengaluru.id,
      areaId: koramangala.id,
      name: 'Spartan Sports Arena Koramangala',
      slug: 'spartan-sports-arena-koramangala',
      description: 'Premier floodlit FIFA-certified multi-sport turf facility with locker rooms, cafeteria, and parking.',
      addressLine: '80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka',
      postalCode: '560034',
      latitude: 12.9352,
      longitude: 77.6245,
      contactPhone: '+919800000002',
      contactEmail: 'contact@spartansports.test',
      coverImageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
      rules: '1. Studs allowed only on Football turf. 2. Non-marking shoes mandatory for indoor badminton. 3. Please reach 10 minutes prior to slot.',
      ratingAverage: 4.85,
      totalReviews: 42,
      isActive: true,
      isApproved: true,
      images: {
        create: [
          {
            imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
            caption: 'Main Football Turf Floodlit View',
            displayOrder: 1,
            isCover: true,
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
            caption: 'Badminton & Pickleball Court Area',
            displayOrder: 2,
            isCover: false,
          },
        ],
      },
      turfSports: {
        create: [
          { sportId: sportsMap['football'].id },
          { sportId: sportsMap['cricket'].id },
          { sportId: sportsMap['badminton'].id },
          { sportId: sportsMap['pickleball'].id },
        ],
      },
      turfFacilities: {
        create: [
          { facilityId: facilitiesMap['floodlights'].id },
          { facilityId: facilitiesMap['changing-rooms'].id },
          { facilityId: facilitiesMap['drinking-water'].id },
          { facilityId: facilitiesMap['parking-space'].id },
          { facilityId: facilitiesMap['cafeteria'].id },
        ],
      },
      operatingHours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          dayOfWeek: day,
          openTime: '06:00',
          closeTime: '23:00',
          isClosed: false,
        })),
      },
      pricingRules: {
        create: [
          {
            sportId: sportsMap['football'].id,
            ruleName: 'Weekday Regular Rate',
            dayType: 'WEEKDAY',
            startTime: '06:00',
            endTime: '17:00',
            hourlyPrice: 1200.00,
            isActive: true,
          },
          {
            sportId: sportsMap['football'].id,
            ruleName: 'Weekday Prime Night',
            dayType: 'WEEKDAY',
            startTime: '17:00',
            endTime: '23:00',
            hourlyPrice: 1800.00,
            isActive: true,
          },
          {
            sportId: sportsMap['football'].id,
            ruleName: 'Weekend All-Day Prime',
            dayType: 'WEEKEND',
            startTime: '06:00',
            endTime: '23:00',
            hourlyPrice: 2000.00,
            isActive: true,
          },
        ],
      },
      blockedSlots: {
        create: [
          {
            blockDate: new Date('2026-10-01'),
            startTime: '06:00',
            endTime: '12:00',
            reason: 'Annual Turf Deep Cleaning & Grass Grooming',
            blockedByUserId: ownerUser.id,
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded Turf: "${spartanTurf.name}" with 4 sports, 5 facilities, 7-day operating hours, 3 pricing rules, and 1 maintenance blocked slot.`);

  // ---------------------------------------------------------------------------
  // 7. Seed Sample Audit Log
  // ---------------------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'TURF_APPROVED',
      entityType: 'Turf',
      entityId: spartanTurf.id,
      newValues: { status: 'APPROVED', isApproved: true, name: spartanTurf.name },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Platform Seeder Engine)',
    },
  });
  console.log('✅ Seeded initial platform AuditLog entry.');

  console.log('🎉 Phase 2 Database Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
