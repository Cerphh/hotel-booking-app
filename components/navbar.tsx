"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation"; // <-- to detect current page

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname(); // current path

  const handleLogout = async () => {
    await logout();
  };

  const navLinks = [
    { href: "/hotels", label: "Hotels" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "#", label: "About" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-[#8FABD4]/40 bg-[#EFECE3]/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/hotels" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-linear-to-br from-[#4A70A9] to-[#8FABD4] rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-[#EFECE3] font-bold text-lg">H</span>
            </div>
            <span className="hidden text-lg font-semibold tracking-tight text-[#000000] dark:text-white sm:inline">
              HotBook
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium transition rounded-full
                  ${
                    pathname === link.href
                      ? "bg-[#4A70A9] text-white shadow-sm"
                      : "text-zinc-700 hover:text-[#000000] dark:text-zinc-300 dark:hover:text-white"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu / Auth Buttons */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 rounded-full p-1 hover:bg-[#8FABD4]/20 dark:hover:bg-zinc-900 transition">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
                      <AvatarFallback>{user.displayName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium text-[#000000] dark:text-zinc-300">
                      {user.displayName?.split(" ")[0]}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-black dark:text-white">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">My Bookings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favorites">Saved Hotels</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/signin">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-[#4A70A9] text-white hover:bg-[#4A70A9]/90"
                >
                  Sign In
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg p-2 hover:bg-[#8FABD4]/20 dark:hover:bg-zinc-900"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#8FABD4]/40 bg-[#EFECE3]/95 py-4 space-y-2 dark:border-zinc-800 dark:bg-zinc-950">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-full px-4 py-2 text-sm font-medium transition
                  ${
                    pathname === link.href
                      ? "bg-[#4A70A9] text-white shadow-sm"
                      : "text-zinc-700 hover:bg-[#8FABD4]/20 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
