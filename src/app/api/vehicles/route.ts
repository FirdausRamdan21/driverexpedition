import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vehicles = await prisma.transitVehicle.findMany({
      orderBy: [{ route: { code: "asc" } }, { plateNumber: "asc" }],
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            isOnline: true,
          },
        },
        route: {
          include: {
            stops: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data armada." },
      { status: 500 }
    );
  }
}
