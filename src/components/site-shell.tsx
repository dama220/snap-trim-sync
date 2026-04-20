import { Link } from "@tanstack/react-router";
import { Scissors, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-card shadow-playful group-hover:rotate-6 transition-transform">
            <Scissors className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl font-bold">SnipShop</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/salons" className="text-sm font-medium hover:text-primary transition">Find a salon</Link>
          <Link to="/about" className="text-sm font-medium hover:text-primary transition">How it works</Link>
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => signOut()}>Sign out</Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link to="/signup"><Button size="sm" className="rounded-full">List your salon</Button></Link>
            </>
          )}
        </nav>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 py-3 space-y-2">
          <Link to="/salons" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Find a salon</Link>
          <Link to="/about" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>How it works</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Dashboard</Link>
              <Button size="sm" variant="outline" className="w-full" onClick={() => { setOpen(false); signOut(); }}>Sign out</Button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Log in</Button>
              </Link>
              <Link to="/signup" className="flex-1" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full rounded-full">List salon</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="font-display font-semibold text-foreground">SnipShop</span>
        </div>
        <p>Book your next haircut in seconds. Online, offline, or via WhatsApp.</p>
        <p className="mt-2 text-xs">© {new Date().getFullYear()} SnipShop. Made with ❤️</p>
      </div>
    </footer>
  );
}
