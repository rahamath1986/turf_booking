'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import type { IconType } from 'react-icons';

export interface WorkspaceNavItem {
  href: string;
  label: string;
  icon: IconType;
}

interface Props {
  title: string;
  subtitle: string;
  initials: string;
  gradient: string;
  navItems: WorkspaceNavItem[];
  activeClass: string;
  dotClass: string;
}

export default function WorkspaceSidebar({
  title,
  subtitle,
  initials,
  gradient,
  navItems,
  activeClass,
  dotClass,
}: Props) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-950">
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-6">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white ${gradient}`}
        >
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive ? activeClass : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {isActive && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dotClass}`} />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.fullName || 'User'}</p>
            <p className="truncate text-xs text-gray-500">{user?.email || ''}</p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {(user?.roles || []).map((r) => (
            <span key={r} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {r}
            </span>
          ))}
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
