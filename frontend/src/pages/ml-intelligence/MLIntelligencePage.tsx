import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  User,
  Calendar,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { mlIntelligenceApi } from '../../api/mlIntelligenceApi';
import {
  MLIntelligenceOverview,
  MLIntelligenceTaskItem,
  MLIntelligenceTaskAssessment,
  BottleneckCategorySummary,
  MLTasksFilterParams,
} from '../../types/mlIntelligence';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export const MLIntelligencePage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [overview, setOverview] = useState<MLIntelligenceOverview | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckCategorySummary[]>([]);
  const [tasks, setTasks] = useState<MLIntelligenceTaskItem[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedProcess, setSelectedProcess] = useState<string>('ALL');
  const [selectedBottleneck, setSelectedBottleneck] = useState<string>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState('desc');

  // Drawer state
  const [assessment, setAssessment] = useState<MLIntelligenceTaskAssessment | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [priorityUpdateSuccess, setPriorityUpdateSuccess] = useState(false);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Overview & Bottlenecks
  const fetchOverviewAndBottlenecks = useCallback(async () => {
    try {
      const [ovData, bnData] = await Promise.all([
        mlIntelligenceApi.getOverview(),
        mlIntelligenceApi.getBottlenecks(),
      ]);
      setOverview(ovData);
      setBottlenecks(bnData.categories);
    } catch (err: any) {
      console.error('Failed to load ML intelligence summary', err);
      setError('Could not load intelligence overview metrics. Please retry.');
    }
  }, []);

  // 2. Fetch Tasks list
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: MLTasksFilterParams = {
        page: currentPage,
        size: pageSize,
        risk_level: selectedRisk !== 'ALL' ? selectedRisk : undefined,
        attention_priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
        process: selectedProcess !== 'ALL' ? selectedProcess : undefined,
        bottleneck: selectedBottleneck !== 'ALL' ? selectedBottleneck : undefined,
        overdue_only: overdueOnly || undefined,
        search: searchTerm.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const res = await mlIntelligenceApi.listTasks(params);
      setTasks(res.items);
      setTotalTasks(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      console.error('Failed to list at-risk tasks', err);
      setError('Could not fetch operational tasks. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    selectedRisk,
    selectedPriority,
    selectedProcess,
    selectedBottleneck,
    overdueOnly,
    searchTerm,
    sortBy,
    sortOrder,
  ]);

  // Initial load
  useEffect(() => {
    fetchOverviewAndBottlenecks();
  }, [fetchOverviewAndBottlenecks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchOverviewAndBottlenecks(), fetchTasks()]);
    setIsRefreshing(false);
  };

  // Handle Task Assessment Drawer
  const handleOpenAssessment = async (taskId: number) => {
    setIsDrawerOpen(true);
    setIsAssessmentLoading(true);
    setPriorityUpdateSuccess(false);
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
    setPriorityUpdateSuccess(false);
  };

  // Handle Prioritise Task
  const handlePrioritiseTask = async (taskId: number) => {
    try {
      await mlIntelligenceApi.updateTaskPriority(taskId, 'HIGH');
      setPriorityUpdateSuccess(true);
      // Refresh task detail and list
      const data = await mlIntelligenceApi.getTaskAssessment(taskId);
      setAssessment(data);
      fetchTasks();
    } catch (err) {
      console.error('Failed to update priority', err);
    }
  };

  // Filter Reset
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedRisk('ALL');
    setSelectedPriority('ALL');
    setSelectedProcess('ALL');
    setSelectedBottleneck('ALL');
    setOverdueOnly(false);
    setSortBy('priority');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm !== '' ||
      selectedRisk !== 'ALL' ||
      selectedPriority !== 'ALL' ||
      selectedProcess !== 'ALL' ||
      selectedBottleneck !== 'ALL' ||
      overdueOnly
    );
  }, [searchTerm, selectedRisk, selectedPriority, selectedProcess, selectedBottleneck, overdueOnly]);

  // Helper formatting badges
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA]">
            <Flame className="w-3 h-3 text-[#D92D20]" />
            Critical Attention
          </span>
        );
      case 'NEEDS_ATTENTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF0C7] text-[#B54708] border border-[#FEDF89]">
            <AlertTriangle className="w-3 h-3 text-[#B54708]" />
            Needs Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F2F4F7] text-[#344054] border border-[#EAECF0]">
            <CheckCircle2 className="w-3 h-3 text-[#667085]" />
            Routine Monitor
          </span>
        );
    }
  };

  const renderRiskBadge = (risk: string, probability: number) => {
    const pct = `${(probability * 100).toFixed(1)}%`;
    switch (risk) {
      case 'HIGH':
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] w-fit">
              <AlertCircle className="w-3 h-3" />
              High Risk ({pct})
            </span>
            <div className="w-24 bg-[#EAECF0] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#D92D20] h-full rounded-full"
                style={{ width: `${Math.min(100, probability * 100)}%` }}
              />
            </div>
          </div>
        );
      case 'MEDIUM':
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89] w-fit">
              <Clock className="w-3 h-3" />
              Medium Risk ({pct})
            </span>
            <div className="w-24 bg-[#EAECF0] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#F79009] h-full rounded-full"
                style={{ width: `${Math.min(100, probability * 100)}%` }}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] w-fit">
              <CheckCircle2 className="w-3 h-3" />
              Low Risk ({pct})
            </span>
            <div className="w-24 bg-[#EAECF0] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#12B76A] h-full rounded-full"
                style={{ width: `${Math.min(100, probability * 100)}%` }}
              />
            </div>
          </div>
        );
    }
  };

  const renderBottleneckTag = (tag: string) => {
    switch (tag) {
      case 'WAITING_RESPONSE':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF]"
          >
            Awaiting Response
          </span>
        );
      case 'PENDING_DEPENDENCY':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#FEF6EE] text-[#C4320A] border border-[#F9DBAF]"
          >
            Prerequisite Blocked
          </span>
        );
      case 'WORKLOAD_PRESSURE':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#FDF2FA] text-[#C11574] border border-[#FCCEEE]"
          >
            Workload Strain
          </span>
        );
      case 'REPEATED_REMINDERS':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#F4F3FF] text-[#5925DC] border border-[#D9D6FE]"
          >
            Escalation / Reminders
          </span>
        );
      case 'STALLED_PROGRESS':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]"
          >
            Stalled Progress
          </span>
        );
      case 'LIFECYCLE_MILESTONE':
        return (
          <span
            key={tag}
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#F8F9FC] text-[#3E4784] border border-[#D5D9EB]"
          >
            Lifecycle Milestone
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[#E1DBEA] bg-white shadow-[0_2px_12px_rgba(49,35,75,0.04)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7F56D9] to-[#6941C6] text-white flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6941C6]">
                Operational Intelligence
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F4F3FF] text-[#5925DC] border border-[#D9D6FE]">
                Decision Support Mode
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1D2939] tracking-tight mt-0.5">
              ML Intelligence — Task Delay Risk Prediction
            </h1>
            <p className="text-[13px] text-[#475467] mt-0.5 max-w-2xl">
              Proactive operational intelligence identifying tasks at risk of delay, tracking verified
              blockers, and highlighting priority actions for HR managers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D0D5DD] bg-white text-[#344054] text-xs font-semibold hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Intelligence'}</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] flex items-center justify-between text-xs text-[#B42318]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="underline font-semibold hover:text-[#912018]"
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTION A: At-a-glance Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* High Delay Risk */}
        <div
          onClick={() => {
            setSelectedRisk('HIGH');
            setSelectedPriority('ALL');
            setOverdueOnly(false);
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedRisk === 'HIGH'
              ? 'border-[#FDA29B] bg-[#FFF8F7] shadow-sm'
              : 'border-[#EAECF0] bg-white hover:border-[#FECDCA] hover:bg-[#FFFBFB]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#475467]">High Delay-Risk Tasks</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#D92D20]">
              {overview?.high_risk_tasks ?? 0}
            </span>
            <span className="text-[11px] text-[#475467]">
              of {overview?.total_active_tasks ?? 0} active
            </span>
          </div>
          <p className="text-[11px] text-[#475467] mt-1">
            Tasks with statistical indicators suggesting SLA risk
          </p>
        </div>

        {/* Critical & Needs Attention */}
        <div
          onClick={() => {
            setSelectedPriority('CRITICAL');
            setSelectedRisk('ALL');
            setOverdueOnly(false);
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedPriority === 'CRITICAL'
              ? 'border-[#FEDF89] bg-[#FFFCF5] shadow-sm'
              : 'border-[#EAECF0] bg-white hover:border-[#FEDF89] hover:bg-[#FFFEFB]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#475467]">Urgent Attention Needed</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF0C7] text-[#B54708] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#B54708]">
              {overview?.needs_attention ?? 0}
            </span>
            <span className="text-[11px] text-[#475467]">require action</span>
          </div>
          <p className="text-[11px] text-[#475467] mt-1">
            Overdue tasks or items blocked by active dependencies
          </p>
        </div>

        {/* Overdue Tasks */}
        <div
          onClick={() => {
            setOverdueOnly(!overdueOnly);
            setSelectedPriority('ALL');
            setSelectedRisk('ALL');
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            overdueOnly
              ? 'border-[#FECDCA] bg-[#FEF3F2] shadow-sm'
              : 'border-[#EAECF0] bg-white hover:border-[#FECDCA] hover:bg-[#FEF3F2]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#475467]">Overdue Operational Tasks</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEE4E2] text-[#B42318] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#B42318]">
              {overview?.overdue_tasks ?? 0}
            </span>
            <span className="text-[11px] text-[#475467]">past target date</span>
          </div>
          <p className="text-[11px] text-[#475467] mt-1">
            Requires assignee follow-up or approved timeline extension
          </p>
        </div>

        {/* Upcoming At-Risk Deadlines */}
        <div
          onClick={() => {
            setSelectedRisk('HIGH');
            setOverdueOnly(false);
          }}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            selectedRisk === 'HIGH' && !overdueOnly
              ? 'border-[#D9D6FE] bg-[#F9F8FF] shadow-sm'
              : 'border-[#EAECF0] bg-white hover:border-[#D9D6FE] hover:bg-[#F9F8FF]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#475467]">Upcoming At-Risk (≤7d)</span>
            <div className="w-8 h-8 rounded-lg bg-[#F4F3FF] text-[#5925DC] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#5925DC]">
              {overview?.upcoming_at_risk_deadlines ?? 0}
            </span>
            <span className="text-[11px] text-[#475467]">due in next 7 days</span>
          </div>
          <p className="text-[11px] text-[#475467] mt-1">
            Proactive window to unblock assignees before delays occur
          </p>
        </div>
      </div>

      {/* SECTION C: Operational Bottlenecks Breakdown Cards */}
      <Card>
        <CardHeader className="pb-3 border-b border-[#EAECF0]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#7F56D9]" />
              <CardTitle className="text-sm font-bold text-[#1D2939]">
                Verified Operational Bottlenecks Across Active Tasks
              </CardTitle>
            </div>
            <span className="text-xs text-[#475467]">
              Click any bottleneck category to filter the operational table below
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bottlenecks.map((cat) => {
              const isSelected = selectedBottleneck === cat.filter_key;
              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedBottleneck(isSelected ? 'ALL' : cat.filter_key);
                    setCurrentPage(1);
                  }}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#7F56D9] bg-[#F9F8FF] shadow-2xs ring-1 ring-[#7F56D9]'
                      : 'border-[#EAECF0] bg-[#FAFAFC] hover:border-[#D0D5DD] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D2939]">{cat.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        cat.count > 0
                          ? isSelected
                            ? 'bg-[#7F56D9] text-white'
                            : 'bg-[#F4F3FF] text-[#5925DC] border border-[#D9D6FE]'
                          : 'bg-[#EAECF0] text-[#667085]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475467] mt-1.5 leading-relaxed">
                    {cat.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#EAECF0]/60">
                    <span className="text-[10px] font-semibold text-[#7F56D9]">
                      {isSelected ? 'Active Filter (Click to clear)' : 'Filter matching tasks →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* SECTION B: Main Table of Tasks at Risk */}
      <Card>
        <CardHeader className="pb-4 border-b border-[#EAECF0]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-[#1D2939] flex items-center gap-2">
                <span>Tasks at Risk of Delay</span>
                <span className="text-xs font-semibold text-[#475467] bg-[#F2F4F7] px-2.5 py-0.5 rounded-full">
                  {totalTasks} total matching
                </span>
              </CardTitle>
              <p className="text-xs text-[#475467] mt-0.5">
                Real-time assessment combining statistical risk estimation with verified operational
                dependencies.
              </p>
            </div>

            {/* Quick Actions / Reset */}
            <div className="flex items-center gap-2 flex-wrap">
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] hover:bg-[#FEE4E2] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-4">
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
              <input
                type="text"
                placeholder="Search title, code, employee, assignee..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1D2939] focus:outline-none focus:ring-1 focus:ring-[#7F56D9] placeholder:text-[#98A2B3]"
              />
            </div>

            {/* Attention Priority */}
            <div>
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] focus:outline-none focus:ring-1 focus:ring-[#7F56D9]"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical Attention</option>
                <option value="NEEDS_ATTENTION">Needs Attention</option>
                <option value="MONITOR">Routine Monitoring</option>
              </select>
            </div>

            {/* Delay Risk */}
            <div>
              <select
                value={selectedRisk}
                onChange={(e) => {
                  setSelectedRisk(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] focus:outline-none focus:ring-1 focus:ring-[#7F56D9]"
              >
                <option value="ALL">All Risk Tiers</option>
                <option value="HIGH">High Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>
            </div>

            {/* HR Process */}
            <div>
              <select
                value={selectedProcess}
                onChange={(e) => {
                  setSelectedProcess(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] focus:outline-none focus:ring-1 focus:ring-[#7F56D9]"
              >
                <option value="ALL">All Lifecycle Stages</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="PROBATION">Probation</option>
                <option value="CONFIRMATION">Confirmation</option>
                <option value="PERFORMANCE">Performance</option>
                <option value="OFFBOARDING">Offboarding</option>
                <option value="COMPLIANCE">Compliance</option>
              </select>
            </div>

            {/* Overdue Toggle */}
            <div>
              <button
                onClick={() => {
                  setOverdueOnly(!overdueOnly);
                  setCurrentPage(1);
                }}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  overdueOnly
                    ? 'bg-[#FEF3F2] border-[#FDA29B] text-[#B42318]'
                    : 'bg-white border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB]'
                }`}
              >
                {overdueOnly ? '✓ Overdue Only' : 'Overdue Only'}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAECF0] bg-[#FAFAFC] text-[11px] font-bold text-[#475467] uppercase tracking-wider">
                  <th className="py-3 px-4">Task & Process</th>
                  <th className="py-3 px-4">Assignee & Subject</th>
                  <th className="py-3 px-4">Deadline & Status</th>
                  <th className="py-3 px-4">Delay Risk</th>
                  <th className="py-3 px-4">HR Attention Priority</th>
                  <th className="py-3 px-4">Verified Bottlenecks</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#475467]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#7F56D9]" />
                        <span>Analyzing live task records & predicting delay risks...</span>
                      </div>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#475467]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-[#12B76A]" />
                        <span className="font-semibold text-sm text-[#1D2939]">
                          No tasks match the active filters
                        </span>
                        <p className="text-xs text-[#475467] max-w-sm">
                          All operational activities are either resolved or within acceptable
                          operational tolerance.
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={handleResetFilters}
                            className="mt-2 text-xs font-semibold text-[#7F56D9] underline"
                          >
                            Reset filters to view all tasks
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr
                      key={task.task_id}
                      className="hover:bg-[#F9F8FF]/50 transition-colors group cursor-pointer"
                      onClick={() => handleOpenAssessment(task.task_id)}
                    >
                      {/* Task & Process */}
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-[#667085]">
                            {task.task_code}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F2F4F7] text-[#344054]">
                            {task.category}
                          </span>
                        </div>
                        <p className="font-medium text-[#1D2939] truncate mt-1 group-hover:text-[#6941C6] transition-colors">
                          {task.title}
                        </p>
                        <p className="text-[11px] text-[#475467] mt-0.5 line-clamp-1 italic">
                          {task.main_concern}
                        </p>
                      </td>

                      {/* Assignee & Subject */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#344054]">
                            {task.assignee.full_name}
                          </span>
                          <span className="text-[11px] text-[#475467]">
                            {task.assignee.role || 'HR Coordinator'}
                          </span>
                          {task.employee && (
                            <span className="text-[10px] text-[#6941C6] mt-0.5 font-medium">
                              For: {task.employee.full_name} ({task.employee.employee_code})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deadline & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#1D2939]">{task.due_date}</span>
                          {task.is_overdue ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D92D20] mt-0.5">
                              <AlertCircle className="w-3 h-3" />
                              {task.overdue_days}d Overdue
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-medium mt-0.5 ${
                                task.days_remaining <= 2
                                  ? 'text-[#B54708] font-bold'
                                  : 'text-[#475467]'
                              }`}
                            >
                              In {task.days_remaining} day{task.days_remaining === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delay Risk */}
                      <td className="py-3.5 px-4">
                        {renderRiskBadge(task.risk_level, task.delay_probability)}
                      </td>

                      {/* HR Attention Priority */}
                      <td className="py-3.5 px-4">
                        {renderPriorityBadge(task.hr_attention_priority)}
                      </td>

                      {/* Bottlenecks */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {task.bottlenecks.length > 0 ? (
                            task.bottlenecks.map((b) => renderBottleneckTag(b))
                          ) : (
                            <span className="text-[11px] text-[#98A2B3]">No blockers</span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAssessment(task.task_id);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054] text-xs font-semibold hover:bg-[#F9FAFB] hover:border-[#6941C6] hover:text-[#6941C6] transition-all shadow-2xs inline-flex items-center gap-1"
                        >
                          <span>Assess</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="py-3 px-4 border-t border-[#EAECF0] bg-[#FAFAFC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#475467]">
            <div className="flex items-center gap-2">
              <span>
                Showing {tasks.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(currentPage * pageSize, totalTasks)} of {totalTasks} tasks
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 px-2 py-1 rounded border border-[#D0D5DD] bg-white text-xs text-[#344054]"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="px-3 py-1 rounded-md border border-[#D0D5DD] bg-white font-medium hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoading}
                className="px-3 py-1 rounded-md border border-[#D0D5DD] bg-white font-medium hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION D: Task Risk & Operational Assessment Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#EAECF0] bg-[#FAFAFC] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#667085]">
                    {assessment?.task_code || 'Loading task...'}
                  </span>
                  {assessment && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F2F4F7] text-[#344054]">
                      {assessment.category}
                    </span>
                  )}
                  {assessment && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        assessment.status === 'COMPLETED'
                          ? 'bg-[#ECFDF3] text-[#027A48]'
                          : assessment.status === 'BLOCKED'
                          ? 'bg-[#FEF3F2] text-[#B42318]'
                          : 'bg-[#EFF8FF] text-[#175CD3]'
                      }`}
                    >
                      {assessment.status}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#1D2939] mt-1">
                  {assessment?.title || 'Operational Risk Assessment'}
                </h2>
                {assessment?.employee && (
                  <p className="text-xs text-[#475467] mt-0.5">
                    Subject Employee: <strong className="text-[#1D2939]">{assessment.employee.full_name}</strong> ({assessment.employee.employee_code}) · {assessment.employee.department || 'General'}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-2 rounded-lg text-[#667085] hover:bg-[#EAECF0] hover:text-[#1D2939] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isAssessmentLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#475467] gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#7F56D9]" />
                  <span>Loading full operational evidence & dependency breakdown...</span>
                </div>
              ) : assessment ? (
                <>
                  {/* 1. Attention Priority Banner */}
                  <div
                    className={`p-4 rounded-xl border ${
                      assessment.hr_attention_priority === 'CRITICAL'
                        ? 'bg-[#FEF3F2] border-[#FDA29B]'
                        : assessment.hr_attention_priority === 'NEEDS_ATTENTION'
                        ? 'bg-[#FFFAEB] border-[#FEDF89]'
                        : 'bg-[#F9FAFB] border-[#EAECF0]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderPriorityBadge(assessment.hr_attention_priority)}
                        <span className="text-xs font-bold text-[#1D2939]">
                          Operational Priority Rationale
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#475467]">
                        Due: {assessment.due_date}
                      </span>
                    </div>
                    <p className="text-xs text-[#344054] mt-2 font-medium">
                      {assessment.hr_attention_rule}
                    </p>
                    <p className="text-[11px] text-[#475467] mt-1">
                      Main Concern: {assessment.main_concern}
                    </p>
                  </div>

                  {/* 2. ML Delay Risk Assessment */}
                  <div className="p-4 rounded-xl border border-[#D9D6FE] bg-[#F9F8FF]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#7F56D9]" />
                        <span className="text-xs font-bold text-[#1D2939]">
                          Estimated Task Delay Risk
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F4F3FF] text-[#6941C6] border border-[#D9D6FE]">
                        Advisory Assessment
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="text-2xl font-black text-[#5925DC]">
                        {(assessment.model_prediction.delay_probability * 100).toFixed(1)}%
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-[#344054]">
                            Risk Classification: {assessment.model_prediction.risk_level}
                          </span>
                        </div>
                        <div className="w-full bg-[#EAECF0] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              assessment.model_prediction.risk_level === 'HIGH'
                                ? 'bg-[#D92D20]'
                                : assessment.model_prediction.risk_level === 'MEDIUM'
                                ? 'bg-[#F79009]'
                                : 'bg-[#12B76A]'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                assessment.model_prediction.delay_probability * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#475467] mt-3 italic leading-relaxed">
                      {assessment.model_prediction.advisory_note}
                    </p>

                    {/* Contributing factors */}
                    {assessment.model_prediction.contributing_factors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#D9D6FE]/50">
                        <span className="text-[11px] font-bold text-[#344054] block mb-1.5">
                          Operational Contributing Factors:
                        </span>
                        <div className="space-y-1">
                          {assessment.model_prediction.contributing_factors.map((cf, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] py-0.5"
                            >
                              <span className="text-[#344054]">• {cf.effect}</span>
                              <span
                                className={`font-mono font-semibold ${
                                  cf.impact > 0 ? 'text-[#B42318]' : 'text-[#027A48]'
                                }`}
                              >
                                {cf.impact > 0 ? `+${cf.impact}` : cf.impact}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Verified Operational Facts */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475467]">
                      Verified Operational Evidence (Live Database Records)
                    </h3>

                    {/* Assignee & Workload */}
                    <div className="p-3.5 rounded-xl border border-[#EAECF0] bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-[#667085]" />
                          <span className="text-xs font-bold text-[#1D2939]">
                            Assigned Owner: {assessment.assignee.full_name}
                          </span>
                        </div>
                        <span className="text-xs text-[#475467]">{assessment.assignee.email}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#EAECF0]">
                        <div>
                          <span className="text-[#475467]">Current Active Workload:</span>{' '}
                          <strong className="text-[#1D2939]">
                            {assessment.operational_facts.owner_workload.active_tasks_count} tasks
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#475467]">Historical Delay Rate:</span>{' '}
                          <strong className="text-[#1D2939]">
                            {(
                              assessment.operational_facts.owner_workload.historical_delay_rate *
                              100
                            ).toFixed(1)}
                            %
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Prerequisite Dependencies */}
                    <div className="p-3.5 rounded-xl border border-[#EAECF0] bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1D2939]">
                          Prerequisite Dependencies ({assessment.operational_facts.dependencies.length})
                        </span>
                      </div>
                      {assessment.operational_facts.dependencies.length === 0 ? (
                        <p className="text-xs text-[#475467]">No prerequisite blockers configured.</p>
                      ) : (
                        <div className="space-y-2">
                          {assessment.operational_facts.dependencies.map((dep) => (
                            <div
                              key={dep.id}
                              className="p-2.5 rounded-lg border border-[#EAECF0] bg-[#FAFAFC] text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono text-[10px] text-[#667085]">
                                  {dep.task_code}
                                </span>
                                <p className="font-semibold text-[#1D2939]">{dep.title}</p>
                                <span className="text-[11px] text-[#475467]">Owner: {dep.owner_name}</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  dep.status === 'COMPLETED'
                                    ? 'bg-[#ECFDF3] text-[#027A48]'
                                    : 'bg-[#FEF3F2] text-[#B42318]'
                                }`}
                              >
                                {dep.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Follow-up Notes */}
                    <div className="p-3.5 rounded-xl border border-[#EAECF0] bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1D2939]">
                          Recent Follow-up Activity ({assessment.operational_facts.follow_ups.length})
                        </span>
                      </div>
                      {assessment.operational_facts.follow_ups.length === 0 ? (
                        <p className="text-xs text-[#475467]">No follow-ups recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {assessment.operational_facts.follow_ups.map((fu) => (
                            <div
                              key={fu.id}
                              className="p-2.5 rounded-lg border border-[#EAECF0] bg-[#FAFAFC] text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#344054]">{fu.follow_up_date}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    fu.response_received
                                      ? 'bg-[#ECFDF3] text-[#027A48]'
                                      : 'bg-[#FEF0C7] text-[#B54708]'
                                  }`}
                                >
                                  {fu.response_received ? 'Response Received' : 'Response Pending'}
                                </span>
                              </div>
                              <p className="text-xs text-[#1D2939] mt-1">{fu.notes}</p>
                              {fu.response_notes && (
                                <p className="text-[11px] text-[#027A48] mt-1 bg-white p-1.5 rounded border border-[#EAECF0]">
                                  Response: {fu.response_notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Escalations */}
                    {assessment.operational_facts.escalations.length > 0 && (
                      <div className="p-3.5 rounded-xl border border-[#FECDCA] bg-[#FEF3F2]/50">
                        <span className="text-xs font-bold text-[#B42318] block mb-2">
                          Active Escalations ({assessment.operational_facts.escalations.length})
                        </span>
                        <div className="space-y-2">
                          {assessment.operational_facts.escalations.map((esc) => (
                            <div
                              key={esc.id}
                              className="p-2.5 rounded-lg border border-[#FECDCA] bg-white text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#B42318]">
                                  Level {esc.escalation_level} Escalation
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEE4E2] text-[#D92D20]">
                                  {esc.status}
                                </span>
                              </div>
                              <p className="text-xs text-[#1D2939] mt-1">{esc.reason}</p>
                              <p className="text-[11px] text-[#475467] mt-0.5">
                                Escalated to: {esc.escalated_to_name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Suggested Next Steps */}
                  <div className="p-4 rounded-xl border border-[#A6F4C5] bg-[#F6FEF9]">
                    <span className="text-xs font-bold text-[#027A48] flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Suggested Actionable Steps for HR
                    </span>
                    <ul className="space-y-1.5 text-xs text-[#1D2939]">
                      {assessment.suggested_next_steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] mt-1.5 shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[#EAECF0] bg-[#FAFAFC] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {assessment?.available_actions.can_prioritise && (
                  <button
                    onClick={() => handlePrioritiseTask(assessment.task_id)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-[#FEF0C7] text-[#B54708] border border-[#FEDF89] hover:bg-[#FEE4E2] transition-colors"
                  >
                    {priorityUpdateSuccess ? '✓ Prioritised High' : 'Prioritise to High'}
                  </button>
                )}
                <button
                  onClick={() => {
                    navigate(assessment?.available_actions.task_url || '/tasks');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#7F56D9] text-white hover:bg-[#6941C6] transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <span>Open in Tasks</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(assessment?.available_actions.follow_ups_url || '/follow-ups');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] transition-colors"
                >
                  Follow-ups
                </button>
                <button
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#475467] hover:bg-[#EAECF0] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
