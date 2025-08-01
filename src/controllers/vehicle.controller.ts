import { Request, Response } from "express";
import { PrismaClient, VehicleType, SessionStatus, BillingType, SlotStatus } from "../generated/prisma";
import { findNearestAvailableSlot, updateSlotStatus } from "./slot.controller";

const prisma = new PrismaClient();

export const getVehicles = async (req: Request, res: Response) => {
  try {
    const {
      type,
      numberPlate,
      sessionStatus,
      billingType
    } = req.query;
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(type && { type: type as VehicleType }),
        ...(numberPlate && {
          numberPlate: {
            contains: numberPlate as string,
            mode: "insensitive",
          },
        }),
        ...(sessionStatus || billingType
          ? {
              sessions: {
                some: {
                  ...(sessionStatus && {
                    status: sessionStatus as SessionStatus,
                  }),
                  ...(billingType && {
                    billingType: billingType as BillingType,
                  }),
                },
              },
            }
          : {}),
      },
      include: {
        sessions: true,
      },
    });
    res.status(200).json(vehicles);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Real-time vehicle search for popover
export const searchVehiclesRealtime = async (req: Request, res: Response) => {
  try {
    const { q, limit = 10, includeActive = false } = req.query;
    
    if (!q || (q as string).length < 2) {
      return res.status(200).json([]);
    }

    const searchTerm = (q as string).toLowerCase();
    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Cap at 50 results

    const whereClause: any = {
      numberPlate: {
        contains: searchTerm,
        mode: "insensitive",
      },
    };

    // If includeActive is false, only show vehicles without active sessions
    if (includeActive === 'false') {
      whereClause.sessions = {
        none: {
          status: "ACTIVE"
        }
      };
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        sessions: {
          where: { status: "ACTIVE" },
          include: {
            slot: {
              select: {
                location: true,
                type: true
              }
            },
            billing: {
              select: {
                amount: true,
                isPaid: true
              }
            }
          }
        },
        _count: {
          select: {
            sessions: true
          }
        }
      },
      take: limitNum,
      orderBy: [
        {
          sessions: {
            _count: 'desc'
          }
        },
        {
          numberPlate: 'asc'
        }
      ]
    });

    // Format response for popover display
    const formattedVehicles = vehicles.map(vehicle => ({
      id: vehicle.id,
      numberPlate: vehicle.numberPlate,
      type: vehicle.type,
      isActive: vehicle.sessions.length > 0,
      totalSessions: vehicle._count.sessions,
      activeSession: vehicle.sessions.length > 0 ? {
        slot: vehicle.sessions[0].slot,
        entryTime: vehicle.sessions[0].entryTime,
        billing: vehicle.sessions[0].billing
      } : null
    }));

    res.status(200).json(formattedVehicles);
  } catch (err: any) {
    console.error("Error searching vehicles:", err);
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
};

// Create vehicle entry with automatic slot assignment
export const createVehicleEntry = async (req: Request, res: Response) => {
  try {
    const { numberPlate, type, staffId, billingType = BillingType.HOURLY } = req.body;

    // Validate required fields
    if (!numberPlate || !type || !staffId) {
      return res.status(400).json({ 
        error: "Number plate, vehicle type, and staff ID are required" 
      });
    }

    if (!Object.values(VehicleType).includes(type)) {
      return res.status(400).json({ error: "Invalid vehicle type" });
    }

    let vehicle = await prisma.vehicle.findUnique({
      where: { numberPlate }
    });

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          numberPlate,
          type: type as VehicleType
        }
      });
    }

    const activeSession = await prisma.session.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: SessionStatus.ACTIVE
      }
    });

    if (activeSession) {
      return res.status(400).json({ 
        error: "Vehicle already has an active parking session" 
      });
    }

    const availableSlot = await findNearestAvailableSlot(vehicle.type);
    
    if (!availableSlot) {
      return res.status(404).json({ 
        error: `No available slots for vehicle type: ${vehicle.type}` 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.slot.update({
        where: { id: availableSlot.id },
        data: { status: SlotStatus.OCCUPIED }
      });

      const session = await tx.session.create({
        data: {
          vehicleId: vehicle.id,
          slotId: availableSlot.id,
          staffId,
          billingType: billingType as BillingType,
          status: SessionStatus.ACTIVE
        },
        include: {
          vehicle: true,
          slot: true,
          staff: true
        }
      });

      return session;
    });

    res.status(201).json({
      message: "Vehicle entry successful",
      session: result,
      assignedSlot: {
        id: availableSlot.id,
        location: availableSlot.location,
        type: availableSlot.type
      }
    });

  } catch (err) {
    console.error("Error creating vehicle entry:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};