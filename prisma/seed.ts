import { PrismaClient, Role, VehicleType, OrderStatus, StopStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Driver Expedition database...");

  // 1. Pricing Configs
  const pricingData = [
    {
      vehicleType: VehicleType.MOTOR,
      baseFare: 12000,
      perKmRate: 3000,
      multiDropFee: 4000,
      platformCutPct: 0.15,
      maxWeightKg: 20,
      maxVolumeM3: 0.06,
    },
    {
      vehicleType: VehicleType.VAN,
      baseFare: 45000,
      perKmRate: 6500,
      multiDropFee: 10000,
      platformCutPct: 0.15,
      maxWeightKg: 600,
      maxVolumeM3: 3.0,
    },
    {
      vehicleType: VehicleType.MOBIL_BOX,
      baseFare: 85000,
      perKmRate: 9500,
      multiDropFee: 15000,
      platformCutPct: 0.15,
      maxWeightKg: 1500,
      maxVolumeM3: 8.0,
    },
  ];

  for (const config of pricingData) {
    await prisma.pricingConfig.upsert({
      where: { vehicleType: config.vehicleType },
      update: config,
      create: config,
    });
  }

  const defaultPass = hashPassword("password123");

  // 2. Demo Users across 4 Roles
  const owner = await prisma.user.upsert({
    where: { email: "owner@expedition.id" },
    update: {},
    create: {
      name: "Budi Santoso (Owner)",
      email: "owner@expedition.id",
      password: defaultPass,
      phone: "08111000001",
      role: Role.OWNER,
    },
  });

  const karyawan = await prisma.user.upsert({
    where: { email: "admin@expedition.id" },
    update: {},
    create: {
      name: "Siti Rahma (Karyawan)",
      email: "admin@expedition.id",
      password: defaultPass,
      phone: "08111000002",
      role: Role.KARYAWAN,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "user@expedition.id" },
    update: {},
    create: {
      name: "Andi Wijaya (Pemesan)",
      email: "user@expedition.id",
      password: defaultPass,
      phone: "081234567890",
      role: Role.USER,
    },
  });

  const driverMotor = await prisma.user.upsert({
    where: { email: "driver.motor@expedition.id" },
    update: {},
    create: {
      name: "Rudi Hartono (Motor)",
      email: "driver.motor@expedition.id",
      password: defaultPass,
      phone: "081311112222",
      role: Role.DRIVER,
      driverProfile: {
        create: {
          vehicleType: VehicleType.MOTOR,
          plateNumber: "B 4512 KXT",
          maxWeightKg: 20,
          maxVolumeM3: 0.06,
          isOnline: true,
          isVerified: true,
          currentLat: -6.2088,
          currentLng: 106.8456,
        },
      },
    },
  });

  const driverVan = await prisma.user.upsert({
    where: { email: "driver.van@expedition.id" },
    update: {},
    create: {
      name: "Dedi Kurniawan (Van)",
      email: "driver.van@expedition.id",
      password: defaultPass,
      phone: "081333334444",
      role: Role.DRIVER,
      driverProfile: {
        create: {
          vehicleType: VehicleType.VAN,
          plateNumber: "B 9021 VNA",
          maxWeightKg: 600,
          maxVolumeM3: 3.0,
          isOnline: true,
          isVerified: true,
          currentLat: -6.195,
          currentLng: 106.823,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "driver.box@expedition.id" },
    update: {},
    create: {
      name: "Joko Susilo (Mobil Box)",
      email: "driver.box@expedition.id",
      password: defaultPass,
      phone: "081355556666",
      role: Role.DRIVER,
      driverProfile: {
        create: {
          vehicleType: VehicleType.MOBIL_BOX,
          plateNumber: "B 8821 BOX",
          maxWeightKg: 1500,
          maxVolumeM3: 8.0,
          isOnline: false,
          isVerified: false, // Menunggu verifikasi Karyawan
          currentLat: -6.22,
          currentLng: 106.85,
        },
      },
    },
  });

  // 3. Sample Orders
  const existingOrder1 = await prisma.order.findUnique({
    where: { orderCode: "EXP-20261124-001" },
  });

  if (!existingOrder1) {
    await prisma.order.create({
      data: {
        orderCode: "EXP-20261124-001",
        customerId: customer.id,
        driverId: driverMotor.id,
        vehicleType: VehicleType.MOTOR,
        pickupAddress: "Gudang Pusat Tanah Abang, Jakarta Pusat",
        pickupLat: -6.1889,
        pickupLng: 106.8148,
        totalWeightKg: 12.5,
        totalVolumeM3: 0.04,
        totalDistanceKm: 11.4,
        totalPrice: 54200,
        platformFee: 8130,
        driverEarning: 46070,
        status: OrderStatus.COMPLETED,
        rating: 5,
        review: "Pengiriman multi-titik sangat cepat dan rapi!",
        stops: {
          create: [
            {
              sequenceOrder: 1,
              recipientName: "Toko Roti Mawar",
              recipientPhone: "08120001111",
              address: "Jl. Sudirman Kav 25, Jakarta Selatan",
              lat: -6.2146,
              lng: 106.8218,
              itemDesc: "2 Dus Kue Kering",
              weightKg: 6.5,
              volumeM3: 0.02,
              status: StopStatus.DELIVERED,
              proofPhotoUrl: "https://placehold.co/400x300/png?text=POD+Stop+1",
              completedAt: new Date(),
            },
            {
              sequenceOrder: 2,
              recipientName: "Kantor Kreatif Nusantara",
              recipientPhone: "08120002222",
              address: "Jl. HR Rasuna Said, Kuningan",
              lat: -6.2241,
              lng: 106.8326,
              itemDesc: "1 Paket Dokumen & Sample",
              weightKg: 6.0,
              volumeM3: 0.02,
              status: StopStatus.DELIVERED,
              proofPhotoUrl: "https://placehold.co/400x300/png?text=POD+Stop+2",
              completedAt: new Date(),
            },
          ],
        },
      },
    });
  }

  const existingOrder2 = await prisma.order.findUnique({
    where: { orderCode: "EXP-20261124-002" },
  });

  if (!existingOrder2) {
    await prisma.order.create({
      data: {
        orderCode: "EXP-20261124-002",
        customerId: customer.id,
        driverId: driverVan.id,
        vehicleType: VehicleType.VAN,
        pickupAddress: "Warehouse Sunter Jaya, Jakarta Utara",
        pickupLat: -6.1484,
        pickupLng: 106.8758,
        totalWeightKg: 145,
        totalVolumeM3: 1.2,
        totalDistanceKm: 18.6,
        totalPrice: 185900,
        platformFee: 27885,
        driverEarning: 158015,
        status: OrderStatus.IN_DELIVERY,
        stops: {
          create: [
            {
              sequenceOrder: 1,
              recipientName: "Minimarket Berkah",
              recipientPhone: "08129991111",
              address: "Kelapa Gading Boulevard, Jakarta Utara",
              lat: -6.1574,
              lng: 106.9065,
              itemDesc: "15 Karton Minuman",
              weightKg: 60,
              volumeM3: 0.45,
              status: StopStatus.DELIVERED,
              proofPhotoUrl: "https://placehold.co/400x300/png?text=POD+Kelapa+Gading",
              completedAt: new Date(),
            },
            {
              sequenceOrder: 2,
              recipientName: "Cafe Kopi Senja",
              recipientPhone: "08129992222",
              address: "Jl. Pemuda Rawamangun, Jakarta Timur",
              lat: -6.1931,
              lng: 106.8891,
              itemDesc: "10 Karung Biji Kopi",
              weightKg: 50,
              volumeM3: 0.4,
              status: StopStatus.ARRIVED,
            },
            {
              sequenceOrder: 3,
              recipientName: "Resto Sate Khas",
              recipientPhone: "08129993333",
              address: "Jl. Tebet Raya No. 45, Jakarta Selatan",
              lat: -6.2297,
              lng: 106.8511,
              itemDesc: "8 Dus Bahan Baku",
              weightKg: 35,
              volumeM3: 0.35,
              status: StopStatus.WAITING,
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete!", {
    owner: owner.email,
    karyawan: karyawan.email,
    customer: customer.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
