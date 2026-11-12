import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  Flame,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Search,
  X,
  ShieldCheck,
  Info,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { KPICard } from '../../components/ui/KPICard';
import { analyticsApi } from '../../api/analyticsApi';
import { mlIntelligenceApi } from '../../api/mlIntelligenceApi';
import { departmentApi } from '../../api/departmentApi';
import {
  AnalyticsPerformanceResponse,
  ActivityRecordItem,
  HROperationalObservation,
} from '../../types/analytics';
import {
  MLIntelligenceOverview,
  MLIntelligenceTaskItem,
  MLIntelligenceTaskAssessment,
} from '../../types/mlIntelligence';
import { Department } from '../../types/department';

export const HROperationsInsightsPage: React.FC = () => {
  const navigate = useNavigate();

  // Filters State
  const [selectedPeriod, setSelectedPeriod] = useState<string>('12m');
  const [selectedProcess, setSelectedProcess] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Section 1: Analytics Data State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPerformanceResponse | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Section 2: ML Intelligence Data State
  const [mlOverview, setMlOverview] = useState<MLIntelligenceOverview | null>(null);
  const [tasksCache, setTasksCache] = useState<{
    filterKey: string;
    HIGH?: MLIntelligenceTaskItem[];
    MEDIUM?: MLIntelligenceTaskItem[];
    LOW?: MLIntelligenceTaskItem[];
  }>({ filterKey: 'ALL::ALL' });
  const [isOverviewLoading, setIsOverviewLoading] = useState<boolean>(true);
  const [isTasksLoading, setIsTasksLoading] = useState<boolean>(true);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlRetryNonce, setMlRetryNonce] = useState<number>(0);

  // Interactive Risk Indicator Tab: 'HIGH' | 'MEDIUM' | 'LOW' (High Risk selected by default)
  const [selectedRiskTab, setSelectedRiskTab] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  // Risk Classification Explanation Modal / Popover
  const [showRiskClassificationInfo, setShowRiskClassificationInfo] = useState<boolean>(false);

  // Task Search within Risk Table
  const [taskSearchTerm, setTaskSearchTerm] = useState<string>('');

  // Assessment Drawer State
  const [assessment, setAssessment] = useState<MLIntelligenceTaskAssessment | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Drill-down Modal State
  const [drillDownTitle, setDrillDownTitle] = useState<string>('');
  const [drillDownActionInfo, setDrillDownActionInfo] = useState<{
    whyItMatters?: string;
    recommendedAction?: string;
    targetRoute?: string;
  } | null>(null);
  const [drillDownActivities, setDrillDownActivities] = useState<ActivityRecordItem[]>([]);
  const [isDrillDownLoading, setIsDrillDownLoading] = useState<boolean>(false);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState<boolean>(false);
  const [drillDownTotal, setDrillDownTotal] = useState<number>(0);

  // Load Departments for Filter
  useEffect(() => {
    departmentApi
      .listDepartments()
      .then((data) => setDepartments(data))
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  const mlFilterKey = `${selectedDepartment}::${selectedProcess}`;

  // Fetch Operational Analytics (re-runs only when analytics filters change)
  useEffect(() => {
    const controller = new AbortController();
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    const deptId = selectedDepartment !== 'ALL' ? Number(selectedDepartment) : undefined;
    const proc = selectedProcess !== 'ALL' ? selectedProcess : undefined;

    analyticsApi
      .getPerformance(
        {
          period: selectedPeriod,
          department_id: deptId,
          process: proc,
        },
        controller.signal
      )
      .then((data) => {
        setAnalyticsData(data);
      })
      .catch((err: any) => {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return;
        console.error('Failed to load operational analytics', err);
        setAnalyticsError(
          err.response?.data?.detail || 'Failed to retrieve operational performance metrics.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsAnalyticsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedPeriod, selectedProcess, selectedDepartment]);

  // Fetch ML Overview Counts (scoped by department; independent of period and stage)
  useEffect(() => {
    const controller = new AbortController();
    setIsOverviewLoading(true);
    setMlError(null);

    const deptId = selectedDepartment !== 'ALL' ? Number(selectedDepartment) : undefined;

    mlIntelligenceApi
      .getOverview(deptId, controller.signal)
      .then((overviewRes) => {
        setMlOverview(overviewRes);
      })
      .catch((err: any) => {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return;
        console.error('Failed to load ML intelligence data', err);
        setMlError(
          err.response?.data?.detail || 'Failed to load task delay risk predictions.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsOverviewLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedDepartment, mlRetryNonce]);

  // Lazy-fetch only the currently selected Risk Tab and cache per (department, process) filter
  useEffect(() => {
    if (tasksCache.filterKey === mlFilterKey && tasksCache[selectedRiskTab] !== undefined) {
      setIsTasksLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsTasksLoading(true);
    setMlError(null);

    const deptId = selectedDepartment !== 'ALL' ? Number(selectedDepartment) : undefined;
    const proc = selectedProcess !== 'ALL' ? selectedProcess : undefined;

    mlIntelligenceApi
      .listTasks(
        {
          risk_level: selectedRiskTab,
          process: proc,
          department_id: deptId,
          size: 50,
        },
        controller.signal
      )
      .then((res) => {
        const items = res.items || [];
        setTasksCache((prev) =>
          prev.filterKey === mlFilterKey
            ? { ...prev, [selectedRiskTab]: items }
            : { filterKey: mlFilterKey, [selectedRiskTab]: items }
        );
      })
      .catch((err: any) => {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return;
        console.error('Failed to load ML intelligence tasks', err);
        setMlError(
          err.response?.data?.detail || 'Failed to load task delay risk predictions.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsTasksLoading(false);
        }
      });

    return () => controller.abort();
  }, [mlFilterKey, selectedDepartment, selectedProcess, selectedRiskTab, mlRetryNonce, tasksCache]);

  const handleRetryMl = () => {
    setTasksCache({ filterKey: mlFilterKey });
    setMlRetryNonce((n) => n + 1);
  };

  // Open Task Assessment Drawer
  const handleOpenAssessment = async (taskId: number) => {
    setIsDrawerOpen(true);
    setIsAssessmentLoading(true);
    try {
      const data = await mlIntelligenceApi.getTaskAssessment(taskId);
      setAssessment(data);
    } catch (err) {
      console.error('Failed to load task assessment', err);
    } finally {
      setIsAssessmentLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setAssessment(null);
  };

  // Open Drill-Down Modal for underlying activities
  const handleOpenDrillDown = async (
    title: string,
    filterParams: {
      process?: string;
      status?: string;
      month?: string;
      delay_reason?: string;
      department_id?: number;
    },
    actionContext?: {
      whyItMatters?: string;
      recommendedAction?: string;
      targetRoute?: string;
    }
  ) => {
    setDrillDownTitle(title);
    setDrillDownActionInfo(actionContext || null);
    setIsDrillDownOpen(true);
    setIsDrillDownLoading(true);
    try {
      const deptId =
        filterParams.department_id ||
        (selectedDepartment !== 'ALL' ? Number(selectedDepartment) : undefined);
      const res = await analyticsApi.listActivities({
        process: filterParams.process,
        status: filterParams.status,
        month: filterParams.month,
        delay_reason: filterParams.delay_reason,
        department_id: deptId,
        page: 1,
        size: 50,
      });
      setDrillDownActivities(res.items || []);
      setDrillDownTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load drill-down records', err);
      setDrillDownActivities([]);
      setDrillDownTotal(0);
    } finally {
      setIsDrillDownLoading(false);
    }
  };

  // Recommended Next Step Click Handler
  const handleRecommendedNextStep = (obs: HROperationalObservation) => {
    let targetRoute = '/action-center';
    if (obs.action_filter?.process) {
      const p = obs.action_filter.process.toLowerCase();
      if (p === 'onboarding') targetRoute = '/lifecycle/onboarding';
      else if (p === 'documentation') targetRoute = '/lifecycle/documentation';
      else if (p === 'probation') targetRoute = '/lifecycle/probation';
      else if (p === 'confirmation') targetRoute = '/lifecycle/confirmation';
      else if (p === 'performance') targetRoute = '/lifecycle/performance-reviews';
      else if (p === 'offboarding') targetRoute = '/lifecycle/offboarding';
    }

    handleOpenDrillDown(
      obs.title,
      obs.action_filter || {},
      {
        whyItMatters: obs.why_it_matters,
        recommendedAction: obs.recommended_action,
        targetRoute: targetRoute,
      }
    );
  };

  // Active risk task list according to selected risk indicator
  const activeTaskList = useMemo(() => {
    if (tasksCache.filterKey !== mlFilterKey) return [];
    return tasksCache[selectedRiskTab] ?? [];
  }, [tasksCache, mlFilterKey, selectedRiskTab]);

  // Filter tasks by search term
  const filteredTasks = useMemo(() => {
    if (!taskSearchTerm.trim()) return activeTaskList;
    const term = taskSearchTerm.toLowerCase();
    return activeTaskList.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        t.task_code.toLowerCase().includes(term) ||
        (t.employee?.full_name && t.employee.full_name.toLowerCase().includes(term)) ||
        (t.assignee?.full_name && t.assignee.full_name.toLowerCase().includes(term)) ||
        t.category.toLowerCase().includes(term)
    );
  }, [activeTaskList, taskSearchTerm]);

  // On-time percentage bar color helper
  const getOnTimeBarColor = (pct: number) => {
    if (pct >= 85) return '#12B76A';
    if (pct >= 70) return '#F79009';
    return '#F04438';
  };

  return (
    <div className="space-y-6 pb-16 w-full text-[#292238]">
      {/* =========================================================================
          PART 1 — PAGE HEADING AND FILTER TOOLBAR
          ========================================================================= */}
      <div className="space-y-4">
        {/* Page Heading and Subtitle (left-aligned) */}
        <div>
          <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-bold text-[#292238] tracking-tight">
            HR Operations Insights
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#625A70] mt-1">
            Understand HR performance, identify delays and decide what needs attention.
          </p>
        </div>

        {/* Clean, Aligned Filter Toolbar Directly Below Heading */}
        <div className="bg-white rounded-2xl border border-[#E1DBEA] p-5 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* 1. Reporting Period */}
            <div>
              <label className="block text-[13px] sm:text-[14px] font-bold text-[#1E162B] uppercase tracking-wider mb-2">
                Reporting Period
              </label>
              <div className="relative">
                <select
                  aria-label="Filter by reporting period"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full h-11 px-4 bg-white hover:bg-[#FAF8FE] border border-[#E1DBEA] hover:border-[#C9BBEF] text-[#1E162B] text-[14px] sm:text-[15px] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all cursor-pointer shadow-xs appearance-none"
                >
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="12m">Last 12 Months</option>
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* 2. Lifecycle Stage */}
            <div>
              <label className="block text-[13px] sm:text-[14px] font-bold text-[#1E162B] uppercase tracking-wider mb-2">
                Lifecycle Stage
              </label>
              <div className="relative">
                <select
                  aria-label="Filter by lifecycle process"
                  value={selectedProcess}
                  onChange={(e) => setSelectedProcess(e.target.value)}
                  className="w-full h-11 px-4 bg-white hover:bg-[#FAF8FE] border border-[#E1DBEA] hover:border-[#C9BBEF] text-[#1E162B] text-[14px] sm:text-[15px] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all cursor-pointer shadow-xs appearance-none"
                >
                  <option value="ALL">All Stages</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="DOCUMENTATION">Documentation</option>
                  <option value="PROBATION">Probation</option>
                  <option value="CONFIRMATION">Confirmation</option>
                  <option value="PERFORMANCE">Performance Reviews</option>
                  <option value="OFFBOARDING">Offboarding</option>
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* 3. Department */}
            <div>
              <label className="block text-[13px] sm:text-[14px] font-bold text-[#1E162B] uppercase tracking-wider mb-2">
                Department
              </label>
              <div className="relative">
                <select
                  aria-label="Filter by department"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full h-11 px-4 bg-white hover:bg-[#FAF8FE] border border-[#E1DBEA] hover:border-[#C9BBEF] text-[#1E162B] text-[14px] sm:text-[15px] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all cursor-pointer shadow-xs appearance-none"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PART 2 — OPERATIONAL PERFORMANCE (Comes First)
          ========================================================================= */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E162B] tracking-tight">
            Operational Performance
          </h2>
          <p className="text-[14px] sm:text-[15px] text-[#5C5270] mt-1 font-medium">
            How efficiently employee lifecycle activities are being completed across the organisation.
          </p>
        </div>

        {analyticsError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{analyticsError}</span>
          </div>
        )}

        {/* Four Professional Standardized KPI Components */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* KPI 1: Completed Activities */}
          <KPICard
            title="Completed Activities"
            value={isAnalyticsLoading ? '—' : analyticsData?.kpis.activities_completed ?? 0}
            unit="activities"
            indicator="Selected Period"
            indicatorColor="bg-[#EDE7FF] text-[#5425CB] border-[#DCD0FF]"
            icon={CheckCircle2}
            accent="violet"
          />

          {/* KPI 2: On-Time Rate */}
          <KPICard
            title="On-Time Rate"
            value={isAnalyticsLoading ? '—' : `${analyticsData?.kpis.on_time_completion_rate ?? 0}%`}
            indicator={(analyticsData?.kpis.on_time_completion_rate ?? 0) >= 80 ? 'Target Met' : 'Below Target'}
            indicatorColor={
              (analyticsData?.kpis.on_time_completion_rate ?? 0) >= 80
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : (analyticsData?.kpis.on_time_completion_rate ?? 0) >= 70
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }
            icon={TrendingUp}
            accent={
              (analyticsData?.kpis.on_time_completion_rate ?? 0) >= 80
                ? 'emerald'
                : (analyticsData?.kpis.on_time_completion_rate ?? 0) >= 70
                ? 'amber'
                : 'rose'
            }
          />

          {/* KPI 3: Median Completion Time */}
          <KPICard
            title="Median Duration"
            value={isAnalyticsLoading ? '—' : analyticsData?.kpis.median_completion_time_days ?? 0}
            unit="days"
            indicator="Start to Finish"
            indicatorColor="bg-blue-50 text-blue-800 border-blue-200"
            icon={Clock}
            accent="blue"
          />

          {/* KPI 4: Late Completions */}
          <KPICard
            title="Late Completions"
            value={isAnalyticsLoading ? '—' : analyticsData?.kpis.late_completions ?? 0}
            unit="delayed"
            indicator={(analyticsData?.kpis.late_completions ?? 0) > 0 ? 'Requires Review' : 'Zero Delays'}
            indicatorColor={
              (analyticsData?.kpis.late_completions ?? 0) > 0
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }
            icon={(analyticsData?.kpis.late_completions ?? 0) > 0 ? AlertTriangle : CheckCircle2}
            accent={(analyticsData?.kpis.late_completions ?? 0) > 0 ? 'rose' : 'emerald'}
          />
        </div>

        {/* =========================================================================
            PART 3 — OPERATIONAL ANALYTICS CHARTS (Balanced 2x2 Grid)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Chart 1: On-Time Completion by Lifecycle Process */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1DBEA] shadow-2xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#292238]">
                On-Time Completion by Process
              </h3>
              <p className="text-xs text-[#625A70] mt-0.5">
                Compare how reliably each HR process is completed within its due date. Click any bar to inspect underlying records.
              </p>
            </div>
            <div className="h-80 w-full">
              {isAnalyticsLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[#625A70]">
                  Loading process metrics...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData?.on_time_by_process || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2EEF9" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 11, fill: '#625A70' }}
                    />
                    <YAxis
                      dataKey="process_name"
                      type="category"
                      tick={{ fontSize: 12, fill: '#292238', fontWeight: 600 }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `${val}% (${item.payload.on_time_count} on-time, ${item.payload.late_count} late of ${item.payload.completed_count} total)`,
                        'On-Time Rate',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #DDD1FA',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="on_time_percentage"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(entry: any) =>
                        handleOpenDrillDown(
                          `Completed Activities — ${entry.process_name}`,
                          { process: entry.process_key }
                        )
                      }
                    >
                      {(analyticsData?.on_time_by_process || []).map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={getOnTimeBarColor(entry.on_time_percentage)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Monthly Operational Completion Trend */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1DBEA] shadow-2xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#292238]">
                Monthly Completion Trends
              </h3>
              <p className="text-xs text-[#625A70] mt-0.5">
                See how many activities were completed and how many were completed late over time.
              </p>
            </div>
            <div className="h-80 w-full">
              {isAnalyticsLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[#625A70]">
                  Loading completion trends...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analyticsData?.monthly_trend || []}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2EEF9" />
                    <XAxis
                      dataKey="month_label"
                      tick={{ fontSize: 11, fill: '#625A70' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#625A70' }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        val,
                        name === 'completed' ? 'Total Completed' : 'Late Completions',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #DDD1FA',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="Completed Activities"
                      stroke="#5425CB"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#5425CB' }}
                      activeDot={{
                        r: 6,
                        onClick: (_e: any, payload: any) =>
                          handleOpenDrillDown(
                            `Activities Completed in ${payload.payload.month_label}`,
                            { month: payload.payload.month }
                          ),
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      name="Late Completions"
                      stroke="#E11D48"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#E11D48' }}
                      activeDot={{
                        r: 6,
                        onClick: (_e: any, payload: any) =>
                          handleOpenDrillDown(
                            `Late Activities in ${payload.payload.month_label}`,
                            { month: payload.payload.month, status: 'LATE' }
                          ),
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Time Taken to Complete Each HR Process */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1DBEA] shadow-2xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#292238]">
                Time Taken to Complete Each HR Process
              </h3>
              <p className="text-xs text-[#625A70] mt-0.5">
                Compare how long different HR processes take from start to completion.
              </p>
            </div>
            <div className="h-80 w-full">
              {isAnalyticsLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[#625A70]">
                  Loading completion times...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData?.turnaround_by_process || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2EEF9" />
                    <XAxis
                      type="number"
                      unit="d"
                      tick={{ fontSize: 11, fill: '#625A70' }}
                    />
                    <YAxis
                      dataKey="process_name"
                      type="category"
                      tick={{ fontSize: 12, fill: '#292238', fontWeight: 600 }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} days (evaluated across ${item.payload.sample_size} activities)`,
                        'Median Duration',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #DDD1FA',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="median_days"
                      fill="#7C3AED"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(entry: any) =>
                        handleOpenDrillDown(
                          `${entry.process_name} — Duration Drill-down`,
                          { process: entry.process_key }
                        )
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 4: Why HR Activities Are Delayed / Operational Process Volume */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1DBEA] shadow-2xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#292238]">
                {analyticsData?.delay_reasons && analyticsData.delay_reasons.length > 0
                  ? 'Why HR Activities Are Delayed'
                  : 'Activity Volume by Lifecycle Process'}
              </h3>
              <p className="text-xs text-[#625A70] mt-0.5">
                {analyticsData?.delay_reasons && analyticsData.delay_reasons.length > 0
                  ? 'See the reasons recorded against delayed activities.'
                  : 'Compare total activities completed on-time versus late across lifecycle stages.'}
              </p>
            </div>
            <div className="h-80 w-full">
              {isAnalyticsLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[#625A70]">
                  Loading delay analysis...
                </div>
              ) : analyticsData?.delay_reasons && analyticsData.delay_reasons.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData.delay_reasons}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2EEF9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#625A70' }} />
                    <YAxis
                      dataKey="reason"
                      type="category"
                      tick={{ fontSize: 11, fill: '#292238', fontWeight: 500 }}
                      width={170}
                    />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} activities (${item.payload.percentage}%)`,
                        'Affected Count',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #DDD1FA',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="affected_activities"
                      fill="#E11D48"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(entry: any) =>
                        handleOpenDrillDown(
                          `Delayed Activities: ${entry.reason}`,
                          { delay_reason: entry.reason }
                        )
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                /* High-value replacement: Activity Volume Comparison across Processes */
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData?.on_time_by_process || []}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2EEF9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#625A70' }} />
                    <YAxis
                      dataKey="process_name"
                      type="category"
                      tick={{ fontSize: 12, fill: '#292238', fontWeight: 600 }}
                      width={130}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        val,
                        name === 'on_time_count' ? 'On-Time Completed' : 'Late Completed',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #DDD1FA',
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar
                      dataKey="on_time_count"
                      name="On-Time Activities"
                      fill="#10B981"
                      stackId="a"
                      radius={[0, 0, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: any) =>
                        handleOpenDrillDown(
                          `On-Time Activities — ${entry.process_name}`,
                          { process: entry.process_key, status: 'ON_TIME' }
                        )
                      }
                    />
                    <Bar
                      dataKey="late_count"
                      name="Late Activities"
                      fill="#F43F5E"
                      stackId="a"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(entry: any) =>
                        handleOpenDrillDown(
                          `Late Activities — ${entry.process_name}`,
                          { process: entry.process_key, status: 'LATE' }
                        )
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            PART 4 — HR INSIGHTS: WHAT NEEDS ATTENTION?
            ========================================================================= */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-[#E1DBEA] shadow-xs space-y-5">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg sm:text-xl font-extrabold text-[#1E162B] tracking-tight">
              What Needs Attention?
            </h3>
            <p className="text-[14px] sm:text-[15px] text-[#5C5270] mt-1 font-medium">
              Practical observations derived from actual operational analytics to guide HR prioritisation.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {!analyticsData?.observations || analyticsData.observations.length === 0 ? (
              <div className="p-8 text-center text-[15px] text-[#5C5270] bg-[#FAF8FE] rounded-xl border border-dashed border-[#E1DBEA]">
                All tracked lifecycle operations are currently running within expected SLA tolerances.
              </div>
            ) : (
              analyticsData.observations.map((obs) => (
                <div
                  key={obs.id}
                  className="p-5 sm:p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-5 border-[#E1DBEA] hover:border-[#C9BBEF] bg-[#FAF8FE]/70 hover:bg-white shadow-xs"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`px-3 py-1 rounded-md text-[11px] sm:text-[12px] font-bold uppercase tracking-wider ${
                          obs.severity === 'critical'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : obs.severity === 'warning'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-purple-50 text-[#5425CB] border border-purple-200'
                        }`}
                      >
                        {obs.category}
                      </span>
                      <span className="text-[13px] font-bold text-[#5C5270]">
                        Process: {obs.metric_or_process}
                      </span>
                    </div>

                    <h4 className="text-[16px] sm:text-[17px] font-bold text-[#1E162B]">{obs.title}</h4>

                    <p className="text-[14px] sm:text-[15px] text-[#1E162B] leading-relaxed">
                      <strong>Observed: </strong>
                      {obs.observation}
                    </p>

                    <p className="text-[14px] sm:text-[15px] text-[#5C5270] leading-relaxed">
                      <strong>Why it matters: </strong>
                      {obs.why_it_matters}
                    </p>

                    <div className="pt-1.5 flex items-start gap-2 text-[14px] sm:text-[15px] text-[#5425CB] font-bold">
                      <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-[#5425CB]" />
                      <span>
                        Recommended action: {obs.recommended_action}
                      </span>
                    </div>
                  </div>

                  <div className="self-end md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRecommendedNextStep(obs)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5425CB] hover:bg-[#3B1599] text-white text-[14px] sm:text-[15px] font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Recommended Next Step</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          PART 5 — TASK DELAY RISK & PRIORITIES
          ========================================================================= */}
      <section className="space-y-4 pt-6 border-t border-[#E1DBEA]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E162B] tracking-tight">
              Task Delay Risk & Priorities
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#5C5270] mt-1 font-medium">
              Identify tasks that may be delayed so HR can decide what needs attention first.
            </p>
          </div>

          {/* How Risk is Classified Link */}
          <button
            type="button"
            onClick={() => setShowRiskClassificationInfo(true)}
            className="text-[14px] font-bold text-[#5425CB] hover:text-[#3B1599] inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-2 self-start sm:self-auto"
          >
            <Info className="w-4 h-4" />
            <span>How risk is classified</span>
          </button>
        </div>

        {mlError && (
          <div className="p-4.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-[14px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{mlError}</span>
            </div>
            <button
              type="button"
              onClick={handleRetryMl}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 3 Interactive Risk Indicators (High Risk selected by default) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {/* 1. HIGH RISK */}
          <button
            type="button"
            onClick={() => setSelectedRiskTab('HIGH')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedRiskTab === 'HIGH'
                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-[#E1DBEA] hover:border-rose-200 hover:bg-rose-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                High Risk
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedRiskTab === 'HIGH'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-rose-700">
                {isOverviewLoading ? '—' : mlOverview?.high_risk_tasks ?? (tasksCache.HIGH?.length ?? 0)}
              </span>
              <span className="text-xs font-medium text-[#625A70]">active tasks</span>
            </div>
            <p className="text-[11px] text-[#625A70] mt-2">
              Review first: urgent deadline, active blockers, or heavy backlog
            </p>
          </button>

          {/* 2. MEDIUM RISK */}
          <button
            type="button"
            onClick={() => setSelectedRiskTab('MEDIUM')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedRiskTab === 'MEDIUM'
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-[#E1DBEA] hover:border-amber-200 hover:bg-amber-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Medium Risk
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedRiskTab === 'MEDIUM'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-amber-700">
                {isOverviewLoading ? '—' : mlOverview?.medium_risk_tasks ?? (tasksCache.MEDIUM?.length ?? 0)}
              </span>
              <span className="text-xs font-medium text-[#625A70]">active tasks</span>
            </div>
            <p className="text-[11px] text-[#625A70] mt-2">
              Monitor closely: moderate warning signs or tight milestones
            </p>
          </button>

          {/* 3. LOW RISK */}
          <button
            type="button"
            onClick={() => setSelectedRiskTab('LOW')}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedRiskTab === 'LOW'
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-[#E1DBEA] hover:border-emerald-200 hover:bg-emerald-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Low Risk
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedRiskTab === 'LOW'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-emerald-700">
                {isOverviewLoading ? '—' : mlOverview?.low_risk_tasks ?? (tasksCache.LOW?.length ?? 0)}
              </span>
              <span className="text-xs font-medium text-[#625A70]">active tasks</span>
            </div>
            <p className="text-[11px] text-[#625A70] mt-2">
              Routine monitoring: operating within acceptable buffers
            </p>
          </button>
        </div>

        {/* =========================================================================
            PART 7 — TASK RISK TABLE REDESIGN (10 Columns, Full Width)
            ========================================================================= */}
        <div className="bg-white rounded-2xl border border-[#E1DBEA] shadow-2xs overflow-hidden w-full space-y-0">
          {/* Table Header with Search */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  selectedRiskTab === 'HIGH'
                    ? 'bg-rose-600'
                    : selectedRiskTab === 'MEDIUM'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              />
              <h3 className="text-sm sm:text-base font-bold text-[#292238]">
                {selectedRiskTab === 'HIGH'
                  ? 'High Risk Tasks (Review First)'
                  : selectedRiskTab === 'MEDIUM'
                  ? 'Medium Risk Tasks (Monitor Closely)'
                  : 'Low Risk Tasks (Routine Monitoring)'}
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF8FE] border border-[#E1DBEA] text-[#625A70]">
                {filteredTasks.length} tasks
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks, IDs, employees..."
                value={taskSearchTerm}
                onChange={(e) => setTaskSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#E1DBEA] rounded-xl text-[#292238] focus:outline-none focus:ring-1 focus:ring-[#5425CB] placeholder:text-gray-400"
              />
              {taskSearchTerm && (
                <button
                  type="button"
                  onClick={() => setTaskSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 10-Column Responsive Operational Table */}
          <RiskTaskTable
            tasks={filteredTasks}
            isLoading={isTasksLoading}
            onReview={handleOpenAssessment}
            selectedRiskTab={selectedRiskTab}
          />
        </div>
      </section>

      {/* =========================================================================
          PART 6 — RISK CLASSIFICATION EXPLANATION MODAL
          ========================================================================= */}
      {showRiskClassificationInfo && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-[#E1DBEA] p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#5425CB] border border-purple-200 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#292238]">How Risk is Classified</h3>
                  <p className="text-xs text-[#625A70]">Backend prediction thresholds & model evidence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRiskClassificationInfo(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#292238]">
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
                <span className="font-bold text-rose-800">High Risk (Delay Probability ≥ 20.0%)</span>
                <p className="text-rose-900">
                  Tasks where calibrated delay probability is 20.0% or higher. Triggered by imminent deadlines (≤ 2 days), active prerequisite blockers, open escalations, or severe assignee workload backlog (≥ 15 active tasks).
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
                <span className="font-bold text-amber-800">Medium Risk (10.0% to 19.9%)</span>
                <p className="text-amber-900">
                  Tasks with calibrated delay risk between 10.0% and 19.9%. Displays moderate operational warning signs, pending stakeholder responses, or tight upcoming milestone dates.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                <span className="font-bold text-emerald-800">Low Risk (Delay Probability &lt; 10.0%)</span>
                <p className="text-emerald-900">
                  Tasks with calibrated delay risk below 10.0%. Operating with adequate schedule buffers and verified prerequisites; routine monitoring recommended.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 text-[11px] text-[#625A70] space-y-1">
                <p>
                  <strong>Model Version:</strong> v2.1.0-phase7a (Random Forest Classifier calibrated via Sigmoid Platt scaling on 8 approved features).
                </p>
                <p>
                  <strong>Advisory Note:</strong> Delay risk is an estimate based on historical patterns and task attributes. Predictions are intended to assist HR prioritisation, and actual overdue status is evaluated separately.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRiskClassificationInfo(false)}
                className="px-4 py-2 rounded-xl bg-[#5425CB] text-white text-xs font-semibold hover:bg-[#3B1599] transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PART 8 — TASK REVIEW DETAIL DRAWER
          ========================================================================= */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in-50">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-[#E1DBEA]">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E1DBEA] flex items-center justify-between bg-[#FAF8FE]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5425CB]">
                  Task Operational Assessment
                </span>
                <h3 className="text-base sm:text-lg font-bold text-[#292238] mt-0.5">
                  {assessment?.task_code || 'Task Assessment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-[#292238]">
              {isAssessmentLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-xs text-[#625A70]">
                  <span>Loading live task assessment and verified facts...</span>
                </div>
              ) : assessment ? (
                <>
                  {/* Confirmed Task Information */}
                  <div className="p-4 rounded-xl border border-[#E1DBEA] bg-[#FAF8FE]/50 space-y-2">
                    <h4 className="text-sm font-bold text-[#292238]">{assessment.title}</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#625A70] pt-1">
                      <div>
                        <span className="font-semibold text-[#292238]">Process: </span>
                        {assessment.category}
                      </div>
                      <div>
                        <span className="font-semibold text-[#292238]">Task Owner: </span>
                        {assessment.assignee.full_name}
                      </div>
                      <div>
                        <span className="font-semibold text-[#292238]">Due Date: </span>
                        {assessment.due_date}
                      </div>
                      <div>
                        <span className="font-semibold text-[#292238]">Associated Employee: </span>
                        {assessment.employee
                          ? `${assessment.employee.full_name} (${assessment.employee.employee_code})`
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* ML-Predicted Delay Risk Section */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#5425CB] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Model Prediction Details
                    </h5>
                    <div className="p-4 rounded-xl border border-[#DDD1FA] bg-[#FAF8FE] space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-[#625A70]">Estimated Delay Probability</p>
                          <p className="text-2xl font-bold font-mono text-[#5425CB]">
                            {(assessment.model_prediction.delay_probability * 100).toFixed(1)}%
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            assessment.model_prediction.risk_level === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : assessment.model_prediction.risk_level === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {assessment.model_prediction.risk_level} Risk
                        </span>
                      </div>

                      {/* Contributing Factors */}
                      {assessment.model_prediction.contributing_factors.length > 0 && (
                        <div className="pt-2 border-t border-[#E1DBEA] space-y-1.5">
                          <p className="text-[11px] font-semibold text-[#292238]">
                            Key Contributing Risk Factors:
                          </p>
                          <div className="space-y-1">
                            {assessment.model_prediction.contributing_factors.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-[#E1DBEA]"
                              >
                                <span className="font-medium text-[#292238]">{f.factor}</span>
                                <span
                                  className={`font-semibold ${
                                    f.effect === 'INCREASES_RISK'
                                      ? 'text-rose-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {f.effect === 'INCREASES_RISK' ? '+' : '-'}
                                  {(Math.abs(f.impact) * 100).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Verified Operational Facts */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#292238] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Operational Facts
                    </h5>
                    <div className="p-4 rounded-xl border border-[#E1DBEA] bg-white space-y-3">
                      {/* Prerequisites */}
                      <div>
                        <p className="font-semibold text-[#292238] mb-1">
                          Prerequisite Dependencies:
                        </p>
                        {(assessment.operational_facts?.dependencies ||
                          assessment.prerequisites ||
                          []).length === 0 ? (
                          <p className="text-[#625A70] italic">
                            No prerequisite dependencies linked.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {(
                              assessment.operational_facts?.dependencies ||
                              assessment.prerequisites ||
                              []
                            ).map((p: any) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-[#FAF8FE] border border-[#E1DBEA]"
                              >
                                <div>
                                  <span className="font-mono text-[10px] text-[#625A70]">
                                    {p.task_code}
                                  </span>
                                  <p className="font-medium text-[#292238]">{p.title}</p>
                                  <p className="text-[10px] text-[#625A70]">
                                    Owner: {p.owner_name}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    p.status === 'COMPLETED'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Workload and Historical metrics */}
                      {(assessment.operational_facts?.owner_workload ||
                        assessment.assignee_workload) && (
                        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-lg bg-[#FAF8FE] border border-[#E1DBEA]">
                            <span className="text-[10px] text-[#625A70]">
                              Assignee Active Workload
                            </span>
                            <p className="text-sm font-bold font-mono text-[#292238]">
                              {(
                                assessment.operational_facts?.owner_workload ||
                                assessment.assignee_workload
                              )?.active_tasks_count}{' '}
                              tasks
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#FAF8FE] border border-[#E1DBEA]">
                            <span className="text-[10px] text-[#625A70]">
                              Historical Delay Rate
                            </span>
                            <p className="text-sm font-bold font-mono text-[#292238]">
                              {(
                                ((assessment.operational_facts?.owner_workload ||
                                  assessment.assignee_workload)?.historical_delay_rate ??
                                  0) * 100
                              ).toFixed(1)}
                              %
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Practical Suggested HR Action */}
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#292238]">
                      Suggested HR Action
                    </h5>
                    <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 text-[#292238]">
                      <p className="leading-relaxed">
                        {assessment.suggested_action ||
                          'Contact task owner to ensure prerequisites are satisfied before the target date.'}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[#E1DBEA] bg-[#FAF8FE] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="px-4 py-2 rounded-xl border border-[#E1DBEA] bg-white text-xs font-semibold text-[#292238] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCloseDrawer();
                  navigate('/action-center');
                }}
                className="px-4 py-2 rounded-xl bg-[#5425CB] text-white text-xs font-bold hover:bg-[#3B1599] transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>Open in Task Management</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRILL-DOWN & RECOMMENDED NEXT STEP ACTIVITY RECORDS MODAL
          ========================================================================= */}
      {isDrillDownOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border border-[#E1DBEA]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E1DBEA] flex items-center justify-between bg-[#FAF8FE]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5425CB]">
                  Underlying Activity Records
                </span>
                <h3 className="text-base sm:text-lg font-bold text-[#292238] mt-0.5">
                  {drillDownTitle}
                </h3>
                <p className="text-xs text-[#625A70] mt-0.5">
                  Showing {drillDownActivities.length} of {drillDownTotal} matching records
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrillDownOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recommended Action Context Banner (if triggered from What Needs Attention) */}
            {drillDownActionInfo && (
              <div className="p-4 bg-purple-50/70 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-[#292238]">
                    <strong>Why it matters: </strong>
                    {drillDownActionInfo.whyItMatters}
                  </p>
                  <p className="text-[#5425CB] font-semibold">
                    <strong>Recommended Next Step: </strong>
                    {drillDownActionInfo.recommendedAction}
                  </p>
                </div>
                {drillDownActionInfo.targetRoute && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrillDownOpen(false);
                      navigate(drillDownActionInfo.targetRoute!);
                    }}
                    className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#5425CB] text-white text-xs font-semibold hover:bg-[#3B1599] transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Open Lifecycle Workspace
                  </button>
                )}
              </div>
            )}

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-0">
              {isDrillDownLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-xs text-[#625A70]">
                  <span>Loading underlying records...</span>
                </div>
              ) : drillDownActivities.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#625A70]">
                  No matching activity records found for this filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E1DBEA] bg-[#FAF8FE] text-[11px] font-bold text-[#625A70] uppercase tracking-wider">
                        <th className="py-3 px-4">Task ID & Title</th>
                        <th className="py-3 px-4">Process</th>
                        <th className="py-3 px-4">Assignee</th>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[#292238]">
                      {drillDownActivities.map((act) => (
                        <tr key={act.task_id} className="hover:bg-[#FAF8FE]/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[10px] text-[#625A70]">
                              {act.task_code}
                            </span>
                            <p className="font-semibold text-[#292238]">{act.title}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF8FE] border border-[#E1DBEA] text-[#292238]">
                              {act.process_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[#292238]">
                            {act.assignee_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[#625A70]">
                            {act.employee_name ? (
                              <span>
                                {act.employee_name}{' '}
                                {act.employee_code && (
                                  <span className="font-mono text-[10px]">
                                    ({act.employee_code})
                                  </span>
                                )}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-[#625A70]">
                            {act.due_date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {act.duration_days !== null ? `${act.duration_days} days` : '—'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                act.is_late
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {act.is_late ? 'Late' : 'On-Time'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E1DBEA] bg-[#FAF8FE] flex justify-end">
              <button
                type="button"
                onClick={() => setIsDrillDownOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#292238] text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                Close Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 10-Column Responsive Operational Risk Task Table (Part 7)
 */
interface RiskTaskTableProps {
  tasks: MLIntelligenceTaskItem[];
  isLoading: boolean;
  onReview: (taskId: number) => void;
  selectedRiskTab: 'HIGH' | 'MEDIUM' | 'LOW';
}

const RiskTaskTable: React.FC<RiskTaskTableProps> = ({
  tasks,
  isLoading,
  onReview,
  selectedRiskTab,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Reset page when task list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [tasks.length, selectedRiskTab]);

  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const paginatedTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-xs text-[#625A70]">
        <span>Evaluating active tasks with calibrated ML model...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-14 text-center text-xs text-[#625A70] space-y-1">
        <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
        <p className="font-semibold text-sm text-[#292238]">No Matching Tasks</p>
        <p>No active tasks currently match the selected risk category and filters.</p>
      </div>
    );
  }

  const formatBottleneckReason = (t: MLIntelligenceTaskItem) => {
    if (t.bottlenecks && t.bottlenecks.length > 0) {
      const b = t.bottlenecks[0];
      if (b === 'PENDING_DEPENDENCY') return 'Prerequisite blocker';
      if (b === 'WAITING_RESPONSE') return 'Awaiting response';
      if (b === 'WORKLOAD_PRESSURE') return 'Workload backlog';
      if (b === 'REPEATED_REMINDERS') return 'Repeated reminders';
      if (b === 'STALLED_PROGRESS') return 'Stalled progress';
      if (b === 'LIFECYCLE_MILESTONE') return 'Upcoming milestone';
      return b.replace(/_/g, ' ').toLowerCase();
    }
    if (t.active_blockers_count > 0) return 'Prerequisite blocker';
    if (t.main_concern) return t.main_concern;
    return 'No recorded blocker';
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Overdue
        </span>
      );
    }
    const s = status.toUpperCase();
    if (s === 'BLOCKED') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Blocked
        </span>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          In Progress
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">
        Pending
      </span>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-[#E1DBEA] bg-[#FAF8FE] text-[13px] sm:text-[14px] font-bold text-[#5C5270] uppercase tracking-wider h-14">
              <th className="py-4 px-4 w-28">Task ID</th>
              <th className="py-4 px-4 w-36">Lifecycle Process</th>
              <th className="py-4 px-4 min-w-[220px]">Task</th>
              <th className="py-4 px-4 min-w-[170px]">Employee</th>
              <th className="py-4 px-4 min-w-[170px]">Assigned To</th>
              <th className="py-4 px-4 w-36">Due Date</th>
              <th className="py-4 px-4 w-32">Status</th>
              <th className="py-4 px-4 w-36">Predicted Risk</th>
              <th className="py-4 px-4 min-w-[200px]">Why It Needs Attention</th>
              <th className="py-4 px-4 text-right w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[#1E162B]">
            {paginatedTasks.map((t) => (
              <tr key={t.task_id} className="hover:bg-[#FAF8FE] transition-colors">
                {/* 1. Task ID */}
                <td className="py-4.5 px-4 font-mono font-bold text-[#5425CB] whitespace-nowrap text-[14px]">
                  {t.task_code}
                </td>

                {/* 2. Lifecycle Process */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 rounded-md text-[12px] font-bold bg-[#FAF8FE] border border-[#E1DBEA] text-[#1E162B]">
                    {t.category}
                  </span>
                </td>

                {/* 3. Task Name */}
                <td className="py-4.5 px-4">
                  <div className="font-bold text-[#1E162B] line-clamp-2 leading-snug text-[15px]">
                    {t.title}
                  </div>
                </td>

                {/* 4. Employee */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  {t.employee ? (
                    <div>
                      <div className="font-bold text-[#1E162B] text-[15px]">
                        {t.employee.full_name}
                      </div>
                      <div className="text-[13px] text-[#5C5270] font-mono">
                        {t.employee.employee_code}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* 5. Assigned To */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  <div>
                    <div className="font-bold text-[#1E162B] text-[15px]">
                      {t.assignee.full_name}
                    </div>
                    {t.assignee.role && (
                      <div className="text-[13px] text-[#5C5270]">
                        {t.assignee.role}
                      </div>
                    )}
                  </div>
                </td>

                {/* 6. Due Date */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  <div className="font-semibold text-[#1E162B] font-mono text-[14px] sm:text-[15px]">{t.due_date}</div>
                  {t.is_overdue && t.overdue_days > 0 ? (
                    <div className="text-[12px] font-bold text-rose-700">
                      {t.overdue_days}d overdue
                    </div>
                  ) : t.days_remaining <= 2 ? (
                    <div className="text-[12px] font-medium text-amber-700">
                      In {t.days_remaining}d
                    </div>
                  ) : null}
                </td>

                {/* 7. Status */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  {getStatusBadge(t.status, t.is_overdue)}
                </td>

                {/* 8. Predicted Risk */}
                <td className="py-4.5 px-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
                      t.risk_level === 'HIGH'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : t.risk_level === 'MEDIUM'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <span>{t.risk_level}</span>
                    <span className="font-mono text-[11px]">
                      ({(t.delay_probability * 100).toFixed(1)}%)
                    </span>
                  </span>
                </td>

                {/* 9. Why It Needs Attention */}
                <td className="py-4.5 px-4">
                  <div className="text-[14px] text-[#5C5270] line-clamp-2 leading-relaxed">
                    {formatBottleneckReason(t)}
                  </div>
                </td>

                {/* 10. Action */}
                <td className="py-4.5 px-4 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onReview(t.task_id)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-[#E1DBEA] hover:border-[#5425CB] bg-white hover:bg-[#FAF8FE] text-[14px] font-bold text-[#5425CB] transition-colors cursor-pointer h-10"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {tasks.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-[#FAF8FE]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#625A70]">
          <div>
            Showing <strong className="text-[#292238]">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-[#292238]">
              {Math.min(currentPage * pageSize, tasks.length)}
            </strong>{' '}
            of <strong className="text-[#292238]">{tasks.length}</strong> tasks
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-[#E1DBEA] bg-white hover:bg-gray-50 text-[#292238] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>

              <span className="px-2 font-medium">
                Page <strong className="text-[#292238]">{currentPage}</strong> of{' '}
                <strong className="text-[#292238]">{totalPages}</strong>
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-[#E1DBEA] bg-white hover:bg-gray-50 text-[#292238] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
