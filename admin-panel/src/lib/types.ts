// =============================================================================
// CORE TYPES - Matching Backend API Responses
// =============================================================================

export interface User {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  roles: string[];
  _count?: { bookings: number };
}

export interface TurfOwner {
  id: string;
  userId: string;
  businessName: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    isActive: boolean;
  };
  _count?: { turfs: number };
  turfs?: TurfSummary[];
  commissionConfig?: CommissionConfig | null;
}

export interface CommissionConfig {
  id: string;
  ownerId: string;
  commissionPercentage: number;
  isActive: boolean;
}

export interface TurfSummary {
  id: string;
  name: string;
  slug: string;
  isApproved: boolean;
  isActive: boolean;
}

export interface Turf {
  id: string;
  ownerId: string;
  cityId: string;
  areaId: string | null;
  name: string;
  slug: string;
  description: string | null;
  addressLine: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  contactPhone: string | null;
  contactEmail: string | null;
  coverImageUrl: string | null;
  rules: string | null;
  cancellationPolicy: string | null;
  ratingAverage: number;
  totalReviews: number;
  isActive: boolean;
  isApproved: boolean;
  isFeatured: boolean;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  advancePaymentAllowed: boolean;
  minAdvancePercentage: number;
  minAdvanceAmount: number;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    businessName: string;
    userId: string;
    user?: { email: string; fullName: string };
  };
  city?: { id: string; name: string };
  area?: { id: string; name: string } | null;
  _count?: { bookings: number; reviews?: number };
  turfSports?: { sport: { id: string; name: string } }[];
  turfFacilities?: { facility: { id: string; name: string } }[];
  images?: { id: string; imageUrl: string; caption: string | null }[];
}

export interface Booking {
  id: string;
  bookingNumber: string;
  turfId: string;
  turfName: string | null;
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  sport: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  basePrice: number;
  taxAmount: number;
  discountAmount: number;
  paymentStatus: string | null;
  refundStatus: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface PlatformStats {
  users: number;
  turfs: number;
  sports: number;
  cities: number;
  bookings: { total: number; active: number };
  totalRevenue: number;
  pendingApprovals: { owners: number; turfs: number };
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RevenueReport {
  totals: {
    revenue: number;
    bookingsCount: number;
    taxAmount: number;
    discountAmount: number;
  };
  trend: {
    period: string;
    revenue: number;
    bookingsCount: number;
    taxAmount: number;
    discountAmount: number;
  }[];
}

export interface BookingsReport {
  total: number;
  byStatus: Record<string, number>;
  trend: { period: string; [status: string]: string | number }[];
}

export interface UsersReport {
  totalUsers: number;
  newUsersInPeriod: number;
  verifiedUsers: number;
  verificationRate: number;
  byRole: { role: string; count: number }[];
}

export interface TurfsReport {
  total: number;
  approved: number;
  active: number;
  approvalRate: number;
  byCity: { cityId: string; cityName: string; turfCount: number }[];
}

export interface CommissionReport {
  totals: {
    transactionCount: number;
    grossAmount: number;
    commissionAmount: number;
    refundAmount: number;
    netOwnerEarning: number;
  };
  settled: { count: number; commissionAmount: number; netOwnerEarning: number };
  unsettled: { count: number; commissionAmount: number; netOwnerEarning: number };
}

export interface RefundsReport {
  totalCount: number;
  totalAmount: number;
  totalCancellationFees: number;
  byStatus: { status: string; count: number; amount: number }[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
  };
}
