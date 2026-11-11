import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, ChevronRight, Calendar } from 'lucide-react';
import { getBreadcrumbs, getPageMeta } from '../../config/navigation';
import { cn } from '../../utils/cn';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const pageMeta = getPageMeta(location.pathname);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="h-18 sm:h-22 bg-white/95 backdrop-blur-sm border-b border-[#E2DBEB] sticky top-0 z-30 flex items-center justify-between px-5 sm:px-7 lg:px-8 shadow-xs">
      {/* Left: Mobile Drawer Trigger + Hierarchical Breadcrumb & Page Heading */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2.5 rounded-xl text-[#5C5270] hover:text-[#5425CB] hover:bg-[#EDE7FF] lg:hidden transition-colors border border-transparent hover:border-[#DCD0FF] cursor-pointer"
          aria-label="Toggle mobile navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="min-w-0">
          {/* Breadcrumbs Navigation */}
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-[14px] sm:text-[15px] font-medium text-[#5C5270] mb-0.5">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-4 h-4 text-[#827799]" />}
                  {crumb.path && !isLast ? (
                    <Link
                      to={crumb.path}
                      className="hover:text-[#5425CB] transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn('truncate', isLast && 'font-bold text-[#1E162B]')}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Prominent Page Heading */}
          <h1 className="text-2xl sm:text-[28px] lg:text-[32px] font-extrabold text-[#1E162B] tracking-tight leading-tight truncate">
            {pageMeta.title}
          </h1>
        </div>
      </div>

      {/* Right: Clean, spacious contextual information (no duplicate profile/signout controls) */}
      <div className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#FAF8FE] border border-[#E2DBEB] text-[13px] sm:text-[14px] font-bold text-[#5C5270] shadow-2xs">
        <Calendar className="w-4 h-4 text-[#6938EF]" />
        <span>{formattedDate}</span>
      </div>
    </header>
  );
};
