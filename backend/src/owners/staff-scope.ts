import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/enums/role.enum';

export interface ManagedScope {
  /** Platform admins bypass all scoping. */
  all: boolean;
  /** TurfOwner profile IDs the caller may operate. */
  ownerIds: string[];
  /** Turf IDs the caller may operate. */
  turfIds: string[];
}

/**
 * Resolve which owners/turfs a caller may operate:
 * - SUPER_ADMIN / ADMIN -> all
 * - TURF_OWNER (own profile) -> own turfs
 * - MANAGER / STAFF with an active StaffAssignment -> assigned owner's turfs
 *   (or the single assigned turf when turfId is set)
 * - everyone else -> nothing
 */
export async function resolveManagedScope(
  prisma: PrismaService,
  userId: string,
  userRoles: string[] = [],
): Promise<ManagedScope> {
  const empty: ManagedScope = { all: false, ownerIds: [], turfIds: [] };

  if (
    userRoles.includes(Role.SUPER_ADMIN) ||
    userRoles.includes(Role.ADMIN)
  ) {
    return { all: true, ownerIds: [], turfIds: [] };
  }

  const profile = await prisma.turfOwner.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (profile) {
    const turfs = await prisma.turf.findMany({
      where: { ownerId: profile.id, deletedAt: null },
      select: { id: true },
    });
    return {
      all: false,
      ownerIds: [profile.id],
      turfIds: turfs.map((t) => t.id),
    };
  }

  const assignment = await prisma.staffAssignment.findFirst({
    where: { userId, isActive: true },
    select: { turfOwnerId: true, turfId: true },
  });
  if (!assignment) return empty;

  if (assignment.turfId) {
    const turf = await prisma.turf.findFirst({
      where: { id: assignment.turfId, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!turf) return empty;
    return { all: false, ownerIds: [turf.ownerId], turfIds: [turf.id] };
  }

  const turfs = await prisma.turf.findMany({
    where: { ownerId: assignment.turfOwnerId, deletedAt: null },
    select: { id: true },
  });
  return {
    all: false,
    ownerIds: [assignment.turfOwnerId],
    turfIds: turfs.map((t) => t.id),
  };
}
