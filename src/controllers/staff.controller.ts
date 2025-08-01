import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members'
    });
  }
};