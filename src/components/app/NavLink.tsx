"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
}

export default function NavLink({ href, icon, label, collapsed }: NavLinkProps) {
  const pathname = usePathname();
  // Match exact for /dashboard, prefix for everything else
  const isActive =
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F5BFF]",
        isActive
          ? "bg-[#2F5BFF] text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
