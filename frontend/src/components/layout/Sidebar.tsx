import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import { HRFlowLogo } from '../common/HRFlowLogo';
import {
  getAccessibleNavGroups,
  isRouteActive,
} from '../../config/navigation';

interface SidebarProps {
  isOpen: boolean; // Mobile open state
  onClose: () => void; // Mobile close callback
  isCollapsed?: boolean; // Desktop collapsed state
  onToggleCollapse?: () => void; // Desktop collapse toggle
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const userRole = user?.role?.role_code;

  // Track accordion open states by item path
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => ({
    '/lifecycle': location.pathname.startsWith('/lifecycle'),
    '/insights':
      location.pathname.startsWith('/insights') ||
      location.pathname.startsWith('/analytics') ||
      location.pathname.startsWith('/ml-intelligence') ||
      location.pathname.startsWith('/ai-intelligence') ||
      location.pathname.startsWith('/copilot'),
  }));

  // Auto-expand accordions on route changes
  useEffect(() => {
    if (location.pathname.startsWith('/lifecycle')) {
      setExpandedItems((prev) => ({ ...prev, '/lifecycle': true }));
    }
    if (
      location.pathname.startsWith('/insights') ||
      location.pathname.startsWith('/analytics') ||
      location.pathname.startsWith('/ml-intelligence') ||
      location.pathname.startsWith('/ai-intelligence') ||
      location.pathname.startsWith('/copilot')
    ) {
      setExpandedItems((prev) => ({ ...prev, '/insights': true }));
    }
  }, [location.pathname]);

  // Auto-close mobile drawer on route changes
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  const navGroups = getAccessibleNavGroups(userRole);

  const formatRoleLabel = (code?: string): string => {
    switch (code) {
      case 'ADMIN':
        return 'System Admin';
      case 'HR_MANAGER':
        return 'HR Manager';
      case 'HR_EXECUTIVE':
        return 'HR Executive';
      case 'REPORTING_MANAGER':
        return 'Reporting Manager';
      default:
        return code || 'HR User';
    }
  };

  const getUserInitials = (name?: string): string => {
    if (!name) return 'HR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container — Restored Rich Lavender Palette with Clear Visual Boundary */}
      <aside
        aria-label="Main Navigation"
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 lg:static lg:sticky lg:top-0 lg:h-screen lg:shrink-0 bg-[#E6DFF2] border-r border-[#D1C5E4] flex flex-col transition-all duration-200 ease-in-out shadow-[4px_0_20px_rgba(42,31,69,0.06)]',
          // Mobile responsive: slide-over drawer
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Desktop responsive: expanded (264px) vs collapsed (72px) width
          isCollapsed ? 'lg:w-[72px] w-[72px]' : 'lg:w-[264px] w-[264px]'
        )}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-[#D1C5E4] shrink-0 bg-[#E6DFF2]">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2 overflow-hidden focus:outline-none"
            title="HR Flow AI Dashboard"
          >
            <HRFlowLogo
              size="md"
              variant="dark"
              showText={!isCollapsed}
            />
          </NavLink>

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={cn(
                'hidden lg:flex items-center justify-center w-8 h-8 rounded-xl border border-[#D1C5E4] text-[#5E4E7A] hover:text-[#1E162B] hover:border-[#5425CB] hover:bg-[#DAD0EC] transition-colors cursor-pointer',
                isCollapsed && 'mx-auto'
              )}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4.5 h-4.5" />
              ) : (
                <ChevronLeft className="w-4.5 h-4.5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-5 space-y-6 scrollbar-thin scrollbar-thumb-[#C8B9DD]">
          {navGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {/* Group Title (Prominent, High-Contrast #5E4E7A) */}
              {!isCollapsed && group.title && (
                <div className="px-3.5 pt-3 pb-2 text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-[#5E4E7A] select-none">
                  {group.title}
                </div>
              )}
              {isCollapsed && (
                <div className="w-8 mx-auto my-3 border-t border-[#D1C5E4]" />
              )}

              {/* Items in Group */}
              {group.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isAnyChildActive = item.children?.some((child) =>
                  isRouteActive(location.pathname, child.path)
                ) ?? false;
                const isParentActive = isRouteActive(location.pathname, item.path) || isAnyChildActive;
                const isExpanded = !!expandedItems[item.path];

                if (hasChildren) {
                  // Expandable Accordion Item (Employee Lifecycle, HR Insights & Assistance)
                  return (
                    <div key={item.path} className="space-y-1.5">
                      {/* Parent Item Header */}
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsed && onToggleCollapse) {
                              onToggleCollapse();
                              setExpandedItems((prev) => ({ ...prev, [item.path]: true }));
                            } else {
                              setExpandedItems((prev) => ({
                                ...prev,
                                [item.path]: !prev[item.path],
                              }));
                            }
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-150 select-none text-left cursor-pointer',
                            isParentActive
                              ? 'bg-white/90 text-[#3B1599] font-extrabold border-l-4 border-[#5425CB] shadow-xs'
                              : 'text-[#2A1F45] hover:text-[#1E162B] hover:bg-[#DAD0EC]',
                            isCollapsed && 'justify-center px-0'
                          )}
                          title={isCollapsed ? item.name : undefined}
                          aria-expanded={isExpanded}
                        >
                          <Icon
                            className={cn(
                              'w-4.5 h-4.5 shrink-0 transition-colors',
                              isParentActive ? 'text-[#5425CB]' : 'text-[#5E4E7A] group-hover:text-[#1E162B]'
                            )}
                          />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 whitespace-nowrap text-[14px]">{item.name}</span>
                              <ChevronDown
                                className={cn(
                                  'w-4 h-4 text-[#5E4E7A] transition-transform duration-200 shrink-0',
                                  isExpanded && 'transform rotate-180'
                                )}
                              />
                            </>
                          )}
                        </button>

                        {/* Collapsed Tooltip */}
                        {isCollapsed && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block px-3 py-1.5 bg-[#1E162B] border border-[#3E355B] text-white text-[13px] font-semibold rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </div>

                      {/* Sub-items (Expanded with Lavender Guide Line) */}
                      {!isCollapsed && isExpanded && (
                        <div className="ml-5 pl-2.5 py-1 space-y-1 border-l-2 border-[#D1C5E4] transition-all">
                          {/* Overview Link for Lifecycle */}
                          {item.path === '/lifecycle' && (
                            <NavLink
                              to="/lifecycle"
                              end
                              className={({ isActive }) =>
                                cn(
                                  'group flex items-center justify-between px-3 py-2 rounded-lg text-[13.5px] font-semibold transition-colors select-none whitespace-nowrap',
                                  isActive
                                    ? 'bg-white text-[#3B1599] font-bold border-l-3 border-[#5425CB] shadow-xs'
                                    : 'text-[#463863] hover:text-[#1E162B] hover:bg-[#DAD0EC]'
                                )
                              }
                            >
                              <span>Overview</span>
                            </NavLink>
                          )}

                          {/* Child Links */}
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                className={({ isActive }) => {
                                  const active = isActive || isRouteActive(location.pathname, child.path);
                                  return cn(
                                    'group flex items-center justify-between px-3 py-2 rounded-lg text-[13.5px] font-semibold transition-colors select-none whitespace-nowrap',
                                    active
                                      ? 'bg-white text-[#3B1599] font-bold border-l-3 border-[#5425CB] shadow-xs'
                                      : 'text-[#463863] hover:text-[#1E162B] hover:bg-[#DAD0EC]'
                                  );
                                }}
                              >
                                {({ isActive }) => {
                                  const active = isActive || isRouteActive(location.pathname, child.path);
                                  return (
                                    <>
                                      <div className="flex items-center gap-2 whitespace-nowrap">
                                        {ChildIcon && (
                                          <ChildIcon
                                            className={cn(
                                              'w-4 h-4 shrink-0 transition-colors',
                                              active ? 'text-[#5425CB]' : 'text-[#5E4E7A] group-hover:text-[#1E162B]'
                                            )}
                                          />
                                        )}
                                        <span className="whitespace-nowrap">{child.name}</span>
                                      </div>
                                    </>
                                  );
                                }}
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Standard Single Nav Link
                return (
                  <div key={item.path} className="relative group">
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-150 select-none cursor-pointer',
                          isActive
                            ? 'bg-white text-[#3B1599] font-extrabold border-l-4 border-[#5425CB] shadow-xs'
                            : 'text-[#2A1F45] hover:text-[#1E162B] hover:bg-[#DAD0EC]',
                          isCollapsed && 'justify-center px-0'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'w-4.5 h-4.5 shrink-0 transition-colors',
                              isActive ? 'text-[#5425CB]' : 'text-[#5E4E7A] group-hover:text-[#1E162B]'
                            )}
                          />
                          {!isCollapsed && (
                            <>
                              <span className="flex-1 whitespace-nowrap text-[14px]">{item.name}</span>
                              {item.badge && (
                                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DDD1FA] text-[#3B1599] border border-[#C5B2FF]">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>

                    {/* Tooltip on Hover when Collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block px-3 py-1.5 bg-[#1E162B] border border-[#3E355B] text-white text-[13px] font-semibold rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
                        {item.name}
                        {item.badge && ` (${item.badge})`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer / User Profile & Sign Out */}
        <div className="p-3.5 border-t border-[#D1C5E4] shrink-0 bg-[#E6DFF2]">
          {!isCollapsed ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#D1C5E4] shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-[#5425CB] text-white border border-[#6938EF] flex items-center justify-center text-[14px] font-extrabold shrink-0 shadow-xs">
                  {getUserInitials(user?.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[#1E162B] truncate leading-tight">
                    {user?.full_name || 'HR User'}
                  </p>
                  <p className="text-[13px] text-[#5E4E7A] font-semibold truncate mt-0.5">
                    {formatRoleLabel(userRole)}
                  </p>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[14px] sm:text-[15px] font-bold text-[#5E4E7A] hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-full bg-[#5425CB] text-white border border-[#6938EF] flex items-center justify-center text-[14px] font-bold shadow-xs"
                title={`${user?.full_name} (${formatRoleLabel(userRole)})`}
              >
                {getUserInitials(user?.full_name)}
              </div>
              <button
                onClick={logout}
                className="p-2 text-[#5E4E7A] hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
