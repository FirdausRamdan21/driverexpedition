import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const routes = await prisma.route.findMany({
      orderBy: { code: "asc" },
      include: {
        stops: {
          orderBy: { orderIndex: "asc" },
        },
        vehicles: {
          orderBy: { plateNumber: "asc" },
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ routes });
  } catch (error) {
    console.error("GET /api/routes error:", error);
    return NextResponse.json(
      { error: "Gagal memuat data rute dan armada." },
      { status: 500 }
    );
  }
}
