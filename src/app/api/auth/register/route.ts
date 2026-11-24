import { NextResponse } from "next/server";
import { Role, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/crypto";
import { SESSION_COOKIE_NAME, signSession, getRoleDashboardPath } from "@/lib/auth";

const VEHICLE_DEFAULTS: Record<VehicleType, { maxWeightKg: number; maxVolumeM3: number }> = {
  MOTOR: { maxWeightKg: 20, maxVolumeM3: 0.06 },
  VAN: { maxWeightKg: 600, maxVolumeM3: 3.0 },
  MOBIL_BOX: { maxWeightKg: 1500, maxVolumeM3: 8.0 },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      phone,
      role,
      vehicleType,
      plateNumber,
    } = body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      role?: Role;
      vehicleType?: VehicleType;
      plateNumber?: string;
    };

    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { error: "Nama, email, password, dan nomor HP wajib diisi" },
        { status: 400 }
      );
    }

    const safeRole: Role = role === Role.DRIVER ? Role.DRIVER : Role.USER;
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    if (safeRole === Role.DRIVER) {
      if (!vehicleType || !plateNumber) {
        return NextResponse.json(
          { error: "Driver wajib mengisi jenis kendaraan dan nomor plat" },
          { status: 400 }
        );
      }
      const plateExists = await prisma.driverProfile.findUnique({
        where: { plateNumber: plateNumber.trim().toUpperCase() },
      });
      if (plateExists) {
        return NextResponse.json(
          { error: "Nomor plat kendaraan sudah terdaftar" },
          { status: 409 }
        );
      }
    }

    const vType = (vehicleType || VehicleType.MOTOR) as VehicleType;
    const defaults = VEHICLE_DEFAULTS[vType] || VEHICLE_DEFAULTS.MOTOR;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashPassword(password),
        phone: phone.trim(),
        role: safeRole,
        ...(safeRole === Role.DRIVER
          ? {
              driverProfile: {
                create: {
                  vehicleType: vType,
                  plateNumber: plateNumber!.trim().toUpperCase(),
                  maxWeightKg: defaults.maxWeightKg,
                  maxVolumeM3: defaults.maxVolumeM3,
                  isOnline: false,
                  isVerified: false,
                  currentLat: -6.2088,
                  currentLng: 106.8456,
                },
              },
            }
          : {}),
      },
      include: { driverProfile: true },
    });

    const token = signSession({ userId: user.id, role: user.role });
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          driverProfile: user.driverProfile,
        },
        redirectTo: getRoleDashboardPath(user.role),
      },
      { status: 201 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat registrasi" },
      { status: 500 }
    );
  }
}
