import { Request, Response } from "express";
import { PrismaClient, VehicleType, SessionStatus, BillingType } from "../generated/prisma";
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
        sessions: true, // Or limit to last session using `orderBy` and `take`
      },
    });
    res.status(200).json(vehicles);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};