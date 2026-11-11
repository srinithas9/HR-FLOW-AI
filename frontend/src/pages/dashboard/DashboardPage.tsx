import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import {
  DashboardOverviewResponse,
  MilestoneItem,
} from '../../types/dashboard';
import { WelcomeGreetingBanner } from '../../components/dashboard/WelcomeGreetingBanner';
import { DashboardKPIBar } from '../../components/dashboard/DashboardKPIBar';
import { LifecyclePipeline } from '../../components/dashboard/LifecyclePipeline';
import { AttentionRequiredTable } from '../../components/dashboard/AttentionRequiredTable';
import { UpcomingMilestones } from '../../components/dashboard/UpcomingMilestones';
import { HRDailyBriefing } from '../../components/dashboard/HRDailyBriefing';
import { Button } from '../../components/ui/Button';
import { copilotApi } from '../../api/copilotApi';
import { HRDailyBriefingResponse } from '../../types/copilot';

export const DashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const deptParam = searchParams.get('department');
  const selectedDepartmentId = deptParam ? Number(deptParam) : undefined;

  // Data states
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [dailyBriefing, setDailyBriefing] = useState<HRDailyBriefingResponse | null>(null);

  // Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Department change handler with URL persistence
  const handleDepartmentChange = useCallback(
    (deptId?: number) => {
      if (deptId) {
        setSearchParams({ department: String(deptId) });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams]
  );

  // Load dashboard data
  const loadDashboardData = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [overviewData, milestonesData, briefingData] = await Promise.all([
          dashboardApi.getOverview(selectedDepartmentId),
          dashboardApi.getUpcomingMilestones(selectedDepartmentId, 30),
          copilotApi.getDailyBriefing(selectedDepartmentId).catch((err) => {
            console.warn('Daily briefing fetch non-fatal fallback:', err);
            return null;
          }),
        ]);

        setOverview(overviewData);
        setMilestones(milestonesData);
        setDailyBriefing(briefingData);
      } catch (err: any) {
        console.error('Failed to load dashboard data:', err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Unable to connect to HR Flow AI service. Please verify backend connectivity.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDepartmentId]
  );

  // Initial load and parameter change trigger
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Fallback defaults for loading state
  const kpis = overview?.kpis || {
    total_employees: 0,
    new_joiners_this_month: 0,
    exits_this_month: 0,
    pending_hr_actions: 0,
    active_employees: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    tasks_due_next_7_days: 0,
  };

  const lifecycle = overview?.lifecycle || {
    onboarding_active: 0,
    probation_active: 0,
    confirmation_pending: 0,
    documentation_pending: 0,
    performance_reviews_in_progress: 0,
    offboarding_in_progress: 0,
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* SECTION 1: HEADER & PERSONALIZED GREETING + DEPARTMENT FILTER */}
      <WelcomeGreetingBanner
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={handleDepartmentChange}
        operationalDate={overview?.operational_date}
        onRefresh={loadDashboardData}
        isRefreshing={isLoading}
      />

      {/* ERROR ALERT WITH RETRY */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData()}
            className="border-red-300 text-red-700 hover:bg-red-100 text-xs h-7 px-3"
          >
            Retry
          </Button>
        </div>
      )}

      {/* SECTION 2: FOUR APPROVED KPI CARDS */}
      <DashboardKPIBar kpis={kpis} isLoading={isLoading} />

      {/* SECTION 3: SIX-STAGE EMPLOYEE LIFECYCLE OVERVIEW */}
      <LifecyclePipeline lifecycle={lifecycle} isLoading={isLoading} />

      {/* SECTION 4: ATTENTION REQUIRED (Multi-Category Triage Table) */}
      <AttentionRequiredTable
        items={overview?.attention_required || []}
        totalCount={overview?.total_attention_count || 0}
        isLoading={isLoading}
      />

      {/* SECTION 5: UPCOMING MILESTONES (Card-based Layout) */}
      <UpcomingMilestones milestones={milestones} isLoading={isLoading} />

      {/* SECTION 6: HR DAILY BRIEFING */}
      <HRDailyBriefing
        briefing={dailyBriefing}
        items={overview?.daily_briefing || []}
        isLoading={isLoading}
      />
    </div>
  );
};
