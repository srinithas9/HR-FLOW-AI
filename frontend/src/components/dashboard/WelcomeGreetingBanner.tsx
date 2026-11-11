import React, { useEffect, useState } from 'react';
import { Building2, RotateCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { departmentApi } from '../../api/departmentApi';
import { Department } from '../../types/department';
import { cn } from '../../utils/cn';

interface WelcomeGreetingBannerProps {
  selectedDepartmentId?: number;
  onDepartmentChange: (deptId?: number) => void;
  operationalDate?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const WelcomeGreetingBanner: React.FC<WelcomeGreetingBannerProps> = ({
  selectedDepartmentId,
  onDepartmentChange,
  onRefresh,
  isRefreshing,
}) => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const roleCode = user?.role?.role_code || '';
  const isManager = (roleCode as string) === 'REPORTING_MANAGER' || (roleCode as string) === 'PEOPLE_MANAGER';

  useEffect(() => {
    if (!isManager) {
      departmentApi
        .listDepartments()
        .then((data) => setDepartments(data.filter((d) => d.is_active)))
        .catch((err) => console.error('Failed to load departments:', err));
    }
  }, [isManager]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  };

  // Clean first name without role label
  const firstName = React.useMemo(() => {
    if (user?.full_name) {
      return user.full_name.trim().split(' ')[0];
    }
    if (user?.email) {
      const handle = user.email.split('@')[0];
      return handle.charAt(0).toUpperCase() + handle.slice(1);
    }
    return 'Team';
  }, [user]);

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
      {/* Left: Unbordered Heading with Greeting and Description (No Duplicate Date) */}
      <div>
        <h1 className="text-2xl sm:text-[30px] lg:text-[32px] font-extrabold text-[#1E162B] tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[#5C5270] font-medium mt-1">
          Here is your HR operations overview for today.
        </p>
      </div>

      {/* Right: Department Filter & Functional Refresh Button aligned neatly */}
      <div className="flex items-center gap-3 shrink-0">
        {isManager ? (
          <div className="flex items-center gap-2.5 px-4 h-11 bg-purple-50 border border-purple-200 rounded-xl text-[14px] font-semibold text-purple-800">
            <Building2 className="w-4.5 h-4.5 text-purple-600 shrink-0" />
            <span>Reporting Hierarchy</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative flex items-center min-w-[220px] sm:min-w-[260px]">
              <Building2 className="w-4.5 h-4.5 text-[#5425CB] absolute left-3.5 pointer-events-none" />
              <select
                aria-label="Filter by department"
                value={selectedDepartmentId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  onDepartmentChange(val);
                }}
                className="w-full h-11 pl-10 pr-9 bg-white hover:bg-[#FAF8FE] border border-[#E2DBEB] hover:border-[#DCD5E8] text-[#1E162B] text-[14px] sm:text-[15px] font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all cursor-pointer shadow-2xs appearance-none"
              >
                <option value="">
                  All Departments {departments.length > 0 ? `(${departments.length})` : ''}
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]">
                ▼
              </div>
            </div>

            {selectedDepartmentId && (
              <button
                type="button"
                onClick={() => onDepartmentChange(undefined)}
                className="text-[13px] font-bold text-[#5425CB] hover:text-[#3B1599] transition-colors underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* Functional Refresh Button with duplicate-click prevention */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-11 px-4 flex items-center gap-2 bg-white hover:bg-[#FAF8FE] border border-[#E2DBEB] hover:border-[#5425CB]/50 text-[#1E162B] hover:text-[#5425CB] text-[14px] font-bold rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Refresh dashboard metrics"
            aria-label="Refresh dashboard"
          >
            <RotateCw className={cn("w-4 h-4 text-[#5425CB]", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </div>
  );
};
