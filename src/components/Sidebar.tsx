'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, Building2, Settings, ChevronLeft, ChevronRight, Sparkles, LogOut } from 'lucide-react';
import { productService, DbProduct } from '@/lib/services/dbService';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [productsExpanded, setProductsExpanded] = useState(true);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  useEffect(() => {
    if (user?.email) setUserEmail(user.email);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const prods = await productService.getAll();
        setProducts(prods);
      } catch {
        // Silently fail — sidebar still renders
      }
    };
    load();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/sign-up-login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  const allProducts = products.map((p) => ({
    id: p.id,
    name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
    href: `/product-detail?id=${p.id}`,
    isNew: !p.isStatic,
  }));

  const displayEmail = userEmail
    ? userEmail.length > 22
      ? userEmail.slice(0, 22) + '…'
      : userEmail
    : 'honeyimtb2000@gma…';

  const subMenuHeight = allProducts.length * 34 + 8;

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-white border-r border-[var(--border)] flex flex-col z-40"
      style={{
        width: open ? '240px' : '64px',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Logo / Brand */}
      <div className="flex items-center px-3 py-3 border-b border-[var(--border)] min-h-[56px] overflow-hidden">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1e1b6e] flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/proquoment-logo.png" alt="Proquoment" className="w-6 h-6 object-contain" />
          </div>
          <div
            className="overflow-hidden"
            style={{
              maxWidth: open ? '160px' : '0px',
              opacity: open ? 1 : 0,
              transition: 'max-width 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            }}
          >
            <span className="text-sm font-bold text-[var(--foreground)] truncate whitespace-nowrap block tracking-tight">
              Proquoment
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 overflow-x-hidden">
        {/* Overview */}
        <Link
          href="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
            isActive('/') ? 'bg-[var(--secondary)] text-primary' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <LayoutDashboard size={18} className="flex-shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden transition-all duration-200"
            style={{ maxWidth: open ? '160px' : '0px', opacity: open ? 1 : 0 }}
          >
            Overview
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              Overview
            </div>
          )}
        </Link>

        {/* Products */}
        <div>
          <Link
            href="/products-list"
            onClick={() => setProductsExpanded(!productsExpanded)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
              isActive('/products-list') || isActive('/product-detail')
                ? 'bg-[var(--secondary)] text-primary'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Package size={18} className="flex-shrink-0" />
            <span
              className="flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-200"
              style={{ maxWidth: open ? '120px' : '0px', opacity: open ? 1 : 0 }}
            >
              Products
            </span>
            {!open && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
                Products
              </div>
            )}
          </Link>

          {/* Animated sub-menu */}
          <div
            className="overflow-hidden"
            style={{
              maxHeight: open && productsExpanded ? `${subMenuHeight}px` : '0px',
              opacity: open && productsExpanded ? 1 : 0,
              transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            }}
          >
            <div className="mt-0.5 ml-4 pl-3 border-l border-[var(--border)] space-y-0.5 py-1">
              {allProducts.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-all duration-150 truncate"
                >
                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${p.isNew ? 'bg-primary' : 'bg-current'}`} />
                  <span className="truncate">{p.name}</span>
                  {p.isNew && (
                    <span className="ml-auto flex-shrink-0 text-[10px] font-medium text-primary bg-[var(--secondary)] px-1.5 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Organization */}
        <Link
          href="/organization"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
            isActive('/organization') ? 'bg-[var(--secondary)] text-primary' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <Building2 size={18} className="flex-shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden transition-all duration-200"
            style={{ maxWidth: open ? '160px' : '0px', opacity: open ? 1 : 0 }}
          >
            Organization
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              Organization
            </div>
          )}
        </Link>

        {/* Account */}
        <Link
          href="/account"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
            isActive('/account') ? 'bg-[var(--secondary)] text-primary' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <Settings size={18} className="flex-shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden transition-all duration-200"
            style={{ maxWidth: open ? '160px' : '0px', opacity: open ? 1 : 0 }}
          >
            Account
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              Account
            </div>
          )}
        </Link>

        {/* New Product CTA */}
        <div className="pt-2">
          <Link
            href="/new-product"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#2e29c4] active:scale-95 transition-all duration-150 overflow-hidden"
          >
            <Sparkles size={15} className="flex-shrink-0" />
            <span
              className="whitespace-nowrap overflow-hidden transition-all duration-200"
              style={{ maxWidth: open ? '120px' : '0px', opacity: open ? 1 : 0 }}
            >
              New Product
            </span>
          </Link>
        </div>
      </nav>

      {/* Bottom: Toggle + User + Sign Out */}
      <div className="border-t border-[var(--border)] px-2 py-3 space-y-1 overflow-hidden">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-all duration-150 w-full group relative"
        >
          {open ? (
            <ChevronLeft size={16} className="flex-shrink-0" />
          ) : (
            <ChevronRight size={16} className="flex-shrink-0" />
          )}
          <span
            className="whitespace-nowrap overflow-hidden transition-all duration-200"
            style={{ maxWidth: open ? '160px' : '0px', opacity: open ? 1 : 0 }}
          >
            Close panel
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              Open panel
            </div>
          )}
        </button>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg group relative">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
          </div>
          <span
            className="text-xs text-[var(--muted-foreground)] truncate whitespace-nowrap overflow-hidden transition-all duration-200 flex-1"
            style={{ maxWidth: open ? '120px' : '0px', opacity: open ? 1 : 0 }}
          >
            {displayEmail}
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              {userEmail || 'Not signed in'}
            </div>
          )}
        </div>

        {/* Sign Out button */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-all duration-150 w-full group relative disabled:opacity-50"
        >
          <LogOut size={16} className="flex-shrink-0" />
          <span
            className="whitespace-nowrap overflow-hidden transition-all duration-200"
            style={{ maxWidth: open ? '160px' : '0px', opacity: open ? 1 : 0 }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </span>
          {!open && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
              Sign out
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
