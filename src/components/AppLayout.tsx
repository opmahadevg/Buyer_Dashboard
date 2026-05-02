'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import AnnouncementBanner from './AnnouncementBanner';
import PageTransition from './PageTransition';
import { Toaster } from 'sonner';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { userProfileService } from '@/lib/services/dbService';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/new-product') setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userProfileService.get();
        if (profile?.organizationId) {
          setOrganizationId(profile.organizationId);
        }
      } catch {
        // Silently fail
      }
    };
    loadProfile();
  }, []);

  useRealtimeNotifications({ organizationId, enabled: true });

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Toaster position="bottom-right" richColors />
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: sidebarOpen ? '240px' : '64px' }}
      >
        <AnnouncementBanner message="Labor Day Notice: Asia production pauses May 1–6. Expect slower responses in this period." />
        <main className="flex-1 overflow-y-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
