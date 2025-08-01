import { Request, Response } from "express";
import { PrismaClient, VehicleType, SlotStatus } from "../generated/prisma";

const prisma = new PrismaClient();

// Get available slots by vehicle type
export const getAvailableSlotsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!type || !Object.values(VehicleType).includes(type as VehicleType)) {
      return res.status(400).json({ error: "Invalid vehicle type" });
    }

    const slots = await prisma.slot.findMany({
      where: {
        type: type as VehicleType,
        status: SlotStatus.AVAILABLE
      },
      orderBy: {
        location: 'asc' // Lower location numbers are nearer
      }
    });

    res.status(200).json(slots);
  } catch (err) {
    console.error("Error fetching available slots:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Find nearest available slot based on vehicle type
export const findNearestAvailableSlot = async (vehicleType: VehicleType) => {
  try {
    let compatibleTypes: VehicleType[] = [];
    
    switch (vehicleType) {
      case VehicleType.CAR:
        compatibleTypes = [VehicleType.CAR]; // Car can use regular or compact slots
        break;
      case VehicleType.BIKE:
        compatibleTypes = [VehicleType.BIKE]; // Bike slots only
        break;
      case VehicleType.EV:
        compatibleTypes = [VehicleType.EV]; // EV slots with charger
        break;
      case VehicleType.HANDICAP_ACCESSIBLE:
        compatibleTypes = [VehicleType.HANDICAP_ACCESSIBLE]; // Reserved accessible slots
        break;
      default:
        throw new Error("Invalid vehicle type");
    }

    const slot = await prisma.slot.findFirst({
      where: {
        type: { in: compatibleTypes },
        status: SlotStatus.AVAILABLE
      },
      orderBy: {
        location: 'asc' // Get the nearest (lowest location number)
      }
    });

    return slot;
  } catch (err) {
    console.error("Error finding nearest slot:", err);
    throw err;
  }
};

// Update slot status
export const updateSlotStatus = async (slotId: string, status: SlotStatus) => {
  try {
    const updatedSlot = await prisma.slot.update({
      where: { id: slotId },
      data: { status }
    });
    return updatedSlot;
  } catch (err) {
    console.error("Error updating slot status:", err);
    throw err;
  }
};

// Get all slots with their current status
export const getAllSlots = async (req: Request, res: Response) => {
  try {
    const slots = await prisma.slot.findMany({
      include: {
        sessions: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            vehicle: true
          }
        }
      },
      orderBy: {
        location: 'asc'
      }
    });

    res.status(200).json(slots);
  } catch (err) {
    console.error("Error fetching all slots:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get slot statistics
export const getSlotStatistics = async (req: Request, res: Response) => {
  try {
    const stats = await prisma.slot.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get total count
    const totalSlots = await prisma.slot.count();

    // Initialize counts
    let available = 0;
    let occupied = 0;
    let maintenance = 0;

    // Parse the grouped results
    stats.forEach(stat => {
      switch (stat.status) {
        case SlotStatus.AVAILABLE:
          available = stat._count.status;
          break;
        case SlotStatus.OCCUPIED:
          occupied = stat._count.status;
          break;
        case SlotStatus.MAINTENANCE:
          maintenance = stat._count.status;
          break;
      }
    });

    const statistics = {
      total: totalSlots,
      available,
      occupied,
      maintenance,
      occupancyRate: totalSlots > 0 ? ((occupied / totalSlots) * 100).toFixed(2) : "0.00"
    };

    res.status(200).json(statistics);
  } catch (err) {
    console.error("Error fetching slot statistics:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};