'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  HiOutlineChartBarSquare,
  HiOutlineUsers,
  HiOutlineBuildingStorefront,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineDocumentChartBar,
  HiOutlineTag,
  HiOutlineReceiptPercent,
  HiOutlineBanknotes,
  HiOutlineStar,
  HiOutlineArrowUturnLeft,
  HiOutlineMap,
  HiOutlineUserCircle,
  HiOutlineBell,
  HiOutlineArrowRightOnRectangle,
} from 'react-icons/hi2';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HiOutlineChartBarSquare },
  { href: '/users', label: 'Users', icon: HiOutlineUsers },
  { href: '/owners', label: 'Owners', icon: HiOutlineBuildingStorefront },
  { href: '/turfs', label: 'Turfs', icon: HiOutlineMapPin },
  { href: '/bookings', label: 'Bookings', icon: HiOutlineCalendarDays },
  { href: '/catalog', label: 'Catalog', icon: HiOutlineTag },
  { href: '/offers', label: 'Offers', icon: HiOutlineReceiptPercent },
  { href: '/settlements', label: 'Settlements', icon: HiOutlineBanknotes },
  { href: '/reviews', label: 'Reviews', icon: HiOutlineStar },
  { href: '/refunds', label: 'Refunds', icon: HiOutlineArrowUturnLeft },
  { href: '/locations', label: 'Locations', icon: HiOutlineMap },
  { href: '/reports', label: 'Reports', icon: HiOutlineDocumentChartBar },
  { href: '/notifications', label: 'Notifications', icon: HiOutlineBell },
  { href: '/profile', label: 'My Profile', icon: HiOutlineUserCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
          TA
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Turf Admin</p>
          <p className="text-xs text-gray-500">Super Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? 'text-emerald-400' : ''}`} />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.fullName || 'Admin'}</p>
            <p className="truncate text-xs text-gray-500">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
