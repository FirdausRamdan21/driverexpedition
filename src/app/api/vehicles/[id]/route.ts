import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface PatchBody {
  action?:
    | "increment_seat"
    | "decrement_seat"
    | "toggle_active"
    | "move_next_stop"
    | "move_prev_stop"
    | "move_to_stop";
  stopIndex?: number;
  occupiedSeats?: number;
  isActive?: boolean;
  currentLat?: number;
  currentLng?: number;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;

    const vehicle = await prisma.transitVehicle.findUnique({
      where: { id },
      include: {
        route: {
          include: {
            stops: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: "Armada tidak ditemukan." },
        { status: 404 }
      );
    }

    const stops = vehicle.route.stops;
    let nextOccupied = vehicle.occupiedSeats;
    let nextActive = vehicle.isActive;
    let nextLat = vehicle.currentLat;
    let nextLng = vehicle.currentLng;
    let nextStopIdx = vehicle.currentStopIdx;

    switch (body.action) {
      case "increment_seat":
        nextOccupied = Math.min(vehicle.maxSeats, vehicle.occupiedSeats + 1);
        break;
      case "decrement_seat":
        nextOccupied = Math.max(0, vehicle.occupiedSeats - 1);
        break;
      case "toggle_active":
        nextActive = !vehicle.isActive;
        break;
      case "move_next_stop":
        if (stops.length > 0) {
          nextStopIdx = (vehicle.currentStopIdx + 1) % stops.length;
          nextLat = stops[nextStopIdx].lat;
          nextLng = stops[nextStopIdx].lng;
        }
        break;
      case "move_prev_stop":
        if (stops.length > 0) {
          nextStopIdx =
            (vehicle.currentStopIdx - 1 + stops.length) % stops.length;
          nextLat = stops[nextStopIdx].lat;
          nextLng = stops[nextStopIdx].lng;
        }
        break;
      case "move_to_stop":
        if (
          typeof body.stopIndex === "number" &&
          body.stopIndex >= 0 &&
          body.stopIndex < stops.length
        ) {
          nextStopIdx = body.stopIndex;
          nextLat = stops[nextStopIdx].lat;
          nextLng = stops[nextStopIdx].lng;
        }
        break;
      default:
        if (typeof body.occupiedSeats === "number") {
          nextOccupied = Math.min(
            vehicle.maxSeats,
            Math.max(0, Math.round(body.occupiedSeats))
          );
        }
        if (typeof body.isActive === "boolean") {
          nextActive = body.isActive;
        }
        if (typeof body.currentLat === "number") {
          nextLat = body.currentLat;
        }
        if (typeof body.currentLng === "number") {
          nextLng = body.currentLng;
        }
        break;
    }

    const updated = await prisma.transitVehicle.update({
      where: { id },
      data: {
        occupiedSeats: nextOccupied,
        isActive: nextActive,
        currentLat: nextLat,
        currentLng: nextLng,
        currentStopIdx: nextStopIdx,
        driver: {
          update: {
            isOnline: nextActive,
            currentLat: nextLat,
            currentLng: nextLng,
          },
        },
      },
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

    return NextResponse.json({ vehicle: updated });
  } catch (error) {
    console.error("PATCH /api/vehicles/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status armada." },
      { status: 500 }
    );
  }
}
