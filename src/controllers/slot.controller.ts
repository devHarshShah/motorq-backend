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

// Update slot maintenance status
export const updateSlotMaintenanceStatus = async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(SlotStatus).includes(status as SlotStatus)) {
      return res.status(400).json({ error: "Invalid status provided" });
    }

    // Check if slot exists
    const existingSlot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    // If setting to MAINTENANCE, make sure no active sessions
    if (status === SlotStatus.MAINTENANCE) {
      const activeSessions = await prisma.session.findMany({
        where: {
          slotId: slotId,
          status: 'ACTIVE'
        }
      });

      if (activeSessions.length > 0) {
        return res.status(400).json({ error: "Cannot set slot to maintenance while there are active sessions" });
      }
    }

    const updatedSlot = await prisma.slot.update({
      where: { id: slotId },
      data: { status: status as SlotStatus },
      include: {
        sessions: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            vehicle: true
          }
        }
      }
    });

    res.status(200).json(updatedSlot);
  } catch (err) {
    console.error("Error updating slot maintenance status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Manually assign slot to session
export const manuallyAssignSlotToSession = async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const { vehicleNumberPlate, staffId, billingType, overrideSlotId } = req.body;

    if (!vehicleNumberPlate || !staffId || !billingType) {
      return res.status(400).json({ error: "Vehicle number plate, staff ID, and billing type are required" });
    }

    if (!['HOURLY', 'DAY_PASS'].includes(billingType)) {
      return res.status(400).json({ error: "Invalid billing type" });
    }

    // Validate staff exists
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    // Check if slot exists
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    // If slot is occupied and no override provided, reject
    if (slot.status === SlotStatus.OCCUPIED && !overrideSlotId) {
      return res.status(400).json({ error: "Slot is occupied. Provide overrideSlotId to reassign the existing session" });
    }

    // If override slot is provided, validate it
    let overrideSlot = null;
    if (overrideSlotId) {
      // Prevent self-override
      if (overrideSlotId === slotId) {
        return res.status(400).json({ error: "Cannot use the same slot as override slot" });
      }

      overrideSlot = await prisma.slot.findUnique({
        where: { id: overrideSlotId },
      });

      if (!overrideSlot) {
        return res.status(404).json({ error: "Override slot not found" });
      }

      if (overrideSlot.status !== SlotStatus.AVAILABLE) {
        return res.status(400).json({ error: "Override slot is not available" });
      }
    }

    // Find or create vehicle
    let vehicle = await prisma.vehicle.findUnique({
      where: { numberPlate: vehicleNumberPlate }
    });

    if (!vehicle) {
      // For manual assignment, default to CAR type - can be made configurable
      vehicle = await prisma.vehicle.create({
        data: {
          numberPlate: vehicleNumberPlate,
          type: slot.type // Use slot's compatible type
        }
      });
    } else {
      // Validate vehicle type compatibility with slot
      if (vehicle.type !== slot.type) {
        return res.status(400).json({ 
          error: `Vehicle type ${vehicle.type} is not compatible with slot type ${slot.type}` 
        });
      }
    }

    // Check if vehicle already has an active session
    const vehicleActiveSession = await prisma.session.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: 'ACTIVE'
      }
    });

    // If vehicle has active session and no override is being performed, reject
    if (vehicleActiveSession && slot.status !== SlotStatus.OCCUPIED) {
      return res.status(400).json({ 
        error: "Vehicle already has an active parking session" 
      });
    }

    // Handle slot assignment or override in a transaction
    const result = await prisma.$transaction(async (tx) => {
      let session;

      if (slot.status === SlotStatus.OCCUPIED && overrideSlotId) {
        // Simple override: move vehicle from occupied slot to empty slot
        
        // Find the existing active session in the occupied slot
        const existingSession = await tx.session.findFirst({
          where: {
            slotId: slotId,
            status: 'ACTIVE'
          }
        });

        if (existingSession) {
          // Move the session to the override slot
          session = await tx.session.update({
            where: { id: existingSession.id },
            data: { slotId: overrideSlotId }
          });

          // Mark override slot as occupied
          await tx.slot.update({
            where: { id: overrideSlotId },
            data: { status: SlotStatus.OCCUPIED }
          });

          // Mark original slot as available
          await tx.slot.update({
            where: { id: slotId },
            data: { status: SlotStatus.AVAILABLE }
          });
        }
      } else {
        // Normal assignment to available slot
        session = await tx.session.create({
          data: {
            vehicleId: vehicle.id,
            slotId: slotId,
            staffId: staffId,
            billingType: billingType,
            entryTime: new Date(),
            status: 'ACTIVE'
          },
          include: {
            vehicle: true,
            slot: true,
            staff: true
          }
        });

        // Update slot status to OCCUPIED
        await tx.slot.update({
          where: { id: slotId },
          data: { status: SlotStatus.OCCUPIED }
        });
      }

      return session;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("Error manually assigning slot to session:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};