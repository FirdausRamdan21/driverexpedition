import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Driver Expedition database...");

  // Clear existing data in dependency order
  await prisma.feederOrder.deleteMany();
  await prisma.transitVehicle.deleteMany();
  await prisma.halte.deleteMany();
  await prisma.route.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const passenger = await prisma.user.create({
    data: {
      name: "Budi Santoso",
      email: "budi@penumpang.id",
      password: "hashed_demo_password",
      role: Role.PASSENGER,
      isOnline: true,
      currentLat: -6.2835,
      currentLng: 106.8212,
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      name: "Pak Hendra",
      email: "hendra@transit.id",
      password: "hashed_demo_password",
      role: Role.TRANSIT_DRIVER,
      isOnline: true,
      currentLat: -6.2869,
      currentLng: 106.8265,
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      name: "Bang Roni",
      email: "roni@transit.id",
      password: "hashed_demo_password",
      role: Role.TRANSIT_DRIVER,
      isOnline: true,
      currentLat: -6.2426,
      currentLng: 106.8256,
    },
  });

  const driver3 = await prisma.user.create({
    data: {
      name: "Mas Dimas",
      email: "dimas@transit.id",
      password: "hashed_demo_password",
      role: Role.TRANSIT_DRIVER,
      isOnline: true,
      currentLat: -6.1931,
      currentLng: 106.823,
    },
  });

  await prisma.user.create({
    data: {
      name: "Admin Operator",
      email: "admin@driverexpedition.id",
      password: "hashed_demo_password",
      role: Role.ADMIN,
      isOnline: true,
    },
  });

  // Route 1: K06 Ragunan - Galunggung
  const routeK06 = await prisma.route.create({
    data: {
      code: "K06",
      name: "Ragunan - Galunggung",
      colorHex: "#2563EB",
      stops: {
        create: [
          { name: "Halte Ragunan", lat: -6.306, lng: 106.8202, orderIndex: 1 },
          { name: "Halte Jati Padang", lat: -6.2869, lng: 106.8265, orderIndex: 2 },
          { name: "Halte Pejaten", lat: -6.2724, lng: 106.83, orderIndex: 3 },
          { name: "Halte Mampang Prapatan", lat: -6.2426, lng: 106.8256, orderIndex: 4 },
          { name: "Halte Kuningan Timur", lat: -6.2297, lng: 106.8295, orderIndex: 5 },
          { name: "Halte Galunggung", lat: -6.2055, lng: 106.8232, orderIndex: 6 },
        ],
      },
    },
    include: { stops: { orderBy: { orderIndex: "asc" } } },
  });

  // Route 2: JAK-12 Blok M - Kota
  const routeJak12 = await prisma.route.create({
    data: {
      code: "JAK-12",
      name: "Blok M - Kota",
      colorHex: "#059669",
      stops: {
        create: [
          { name: "Halte Blok M", lat: -6.2434, lng: 106.7981, orderIndex: 1 },
          { name: "Halte Bundaran Senayan", lat: -6.2275, lng: 106.8016, orderIndex: 2 },
          { name: "Halte Gelora Bung Karno", lat: -6.2217, lng: 106.8065, orderIndex: 3 },
          { name: "Halte Bundaran HI", lat: -6.1931, lng: 106.823, orderIndex: 4 },
          { name: "Halte Monas", lat: -6.1763, lng: 106.8229, orderIndex: 5 },
          { name: "Halte Kota", lat: -6.1376, lng: 106.8147, orderIndex: 6 },
        ],
      },
    },
    include: { stops: { orderBy: { orderIndex: "asc" } } },
  });

  // Transit Vehicles
  await prisma.transitVehicle.createMany({
    data: [
      {
        plateNumber: "B 7102 TJA",
        vehicleType: "BUS",
        maxSeats: 30,
        occupiedSeats: 11, // ~37% Lega
        currentLat: routeK06.stops[1].lat,
        currentLng: routeK06.stops[1].lng,
        currentStopIdx: 1,
        isActive: true,
        routeId: routeK06.id,
        driverId: driver1.id,
      },
      {
        plateNumber: "B 7248 TJA",
        vehicleType: "SHUTTLE",
        maxSeats: 14,
        occupiedSeats: 10, // ~71% Mulai Padat
        currentLat: routeK06.stops[3].lat,
        currentLng: routeK06.stops[3].lng,
        currentStopIdx: 3,
        isActive: true,
        routeId: routeK06.id,
        driverId: driver2.id,
      },
      {
        plateNumber: "B 1945 JAK",
        vehicleType: "ANGKOT",
        maxSeats: 12,
        occupiedSeats: 11, // ~92% Penuh
        currentLat: routeJak12.stops[3].lat,
        currentLng: routeJak12.stops[3].lng,
        currentStopIdx: 3,
        isActive: true,
        routeId: routeJak12.id,
        driverId: driver3.id,
      },
    ],
  });

  console.log(
    `Seed selesai! Penumpang demo: ${passenger.email}, 2 Rute, 12 Halte, 3 Armada aktif.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
