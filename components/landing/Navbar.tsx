"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { NeonButton } from "@/components/ui/NeonButton";

const NAV_LINKS = [
  { href: "#about", label: "About" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#dashboard-preview", label: "Dashboard preview" },
  { href: "#creator", label: "Creator" },
];

export function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-white/10 bg-midnight/80">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="Becoming" className="h-8 sm:h-9 w-auto" />
          <span className="text-lg sm:text-xl font-bold tracking-wider hidden sm:inline">BECOMING</span>
        </Link>
        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-white/80 hover:text-neon-cyan transition-colors"
            >
              {label}
            </a>
          ))}
          <Link href={user ? "/app" : "/signin"}>
            <NeonButton variant="primary" className="py-2">
              Start
            </NeonButton>
          </Link>
        </div>
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg border border-white/20 text-white/80 hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <Link href={user ? "/app" : "/signin"}>
            <NeonButton variant="primary" className="py-2 px-4 text-sm">
              Start
            </NeonButton>
          </Link>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 flex flex-col gap-2">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="py-2 text-sm text-white/80 hover:text-neon-cyan transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
