import { prisma } from '@/lib/prisma';
import { getConfiguredRegions } from './config';

export interface DoctorFilterOptions {
  specialty?: string;
  region?: string;
  telehealth?: boolean;
  inNetwork?: boolean;
  availableToday?: boolean;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export async function queryDoctors(options?: DoctorFilterOptions) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(50, Math.max(1, options?.limit ?? 12));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};

  if (options?.specialty && options.specialty !== 'All Specialties') {
    whereClause.specialty = { contains: options.specialty };
  }

  if (options?.region && options.region !== 'All Regions') {
    whereClause.region = { contains: options.region };
  }

  if (options?.telehealth !== undefined) {
    whereClause.telehealthAvailable = options.telehealth;
  }

  if (options?.inNetwork !== undefined) {
    whereClause.inNetworkHospital = options.inNetwork;
  }

  if (options?.availableToday !== undefined) {
    whereClause.availableToday = options.availableToday;
  }

  if (options?.searchQuery && options.searchQuery.trim().length > 0) {
    const q = options.searchQuery.trim();
    whereClause.OR = [
      { name: { contains: q } },
      { specialty: { contains: q } },
      { subspecialty: { contains: q } },
      { hospitalAffiliation: { contains: q } },
      { city: { contains: q } },
      { bio: { contains: q } },
    ];
  }

  const [total, doctors] = await Promise.all([
    prisma.doctorProfile.count({ where: whereClause }),
    prisma.doctorProfile.findMany({
      where: whereClause,
      include: {
        availabilitySlots: {
          where: { isBooked: false },
          orderBy: { startsAt: 'asc' },
          take: 5,
        },
      },
      orderBy: [{ triageMatchPercent: 'desc' }, { rating: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    doctors,
    configuredRegions: getConfiguredRegions(),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDoctorById(id: string) {
  return prisma.doctorProfile.findUnique({
    where: { id },
    include: {
      availabilitySlots: {
        where: { isBooked: false },
        orderBy: { startsAt: 'asc' },
      },
    },
  });
}
