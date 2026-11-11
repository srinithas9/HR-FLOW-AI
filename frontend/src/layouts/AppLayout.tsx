import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { cn } from '../utils/cn';

export const AppLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const location = useLocation();

  const isCopilotRoute =
    location.pathname.startsWith('/ai-intelligence') ||
    location.pathname.startsWith('/copilot');

  return (
    <div className="min-h-screen bg-[#F7F5FB] flex flex-row antialiased selection:bg-[#EDE7FF] selection:text-[#5425CB]">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      {/* Main Content Layout - Flex-1 takes all remaining width, avoiding any overlap */}
      <div className="flex flex-col flex-1 min-w-0 min-h-screen bg-[#F7F5FB]">
        {/* Sticky Header */}
        <Header onToggleSidebar={() => setIsMobileOpen((prev) => !prev)} />

        {/* Content Container */}
        <main
          className={cn(
            isCopilotRoute
              ? 'flex-1 flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden'
              : 'flex-1 p-4 sm:p-6 lg:p-8 w-full'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
