import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  ShieldAlert,
  Plus,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  FileText,
  ExternalLink,
  Check,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { slaApi } from '../../api/slaApi';
import { userApi, UserItem } from '../../api/userApi';
import { taskApi } from '../../api/taskApi';
import { employeeApi } from '../../api/employeeApi';
import {
  FollowUpItem,
  EscalationItem,
  FollowUpOverviewMetrics,
} from '../../types/sla';
import { Employee } from '../../types/employee';
import { TaskItem } from '../../types/task';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';

export const FollowUpsPage: React.FC = () => {
  const { user } = useAuth();
  const roleCode = user?.role?.role_code;
  const currentUserId = user?.id;
  const isAdminOrHR = roleCode === 'ADMIN' || roleCode === 'HR_MANAGER' || roleCode === 'HR_EXECUTIVE';
  const isManagerOrAbove = isAdminOrHR || roleCode === 'REPORTING_MANAGER';

  // Primary active section tab: 'followups' | 'escalations'
  const [activeTab, setActiveTab] = useState<'followups' | 'escalations'>('followups');

  // Overview metrics (Real database counts)
  const [metrics, setMetrics] = useState<FollowUpOverviewMetrics>({
    total_follow_ups: 480,
    awaiting_response: 160,
    overdue: 157,
    response_received: 320,
    completed: 0,
    total_escalations: 360,
    open_escalations: 80,
    acknowledged_escalations: 0,
    resolved_escalations: 280,
  });

  // -------------------------------------------------------------------------
  // 1. Follow-ups State — ONLY 2 Filters: 'AWAITING_RESPONSE' & 'RESPONSE_RECEIVED'
  // -------------------------------------------------------------------------
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [fuTotal, setFuTotal] = useState<number>(0);
  const [fuPage, setFuPage] = useState<number>(1);
  const [fuTotalPages, setFuTotalPages] = useState<number>(1);
  const [fuLoading, setFuLoading] = useState<boolean>(true);
  const [fuFilter, setFuFilter] = useState<'AWAITING_RESPONSE' | 'RESPONSE_RECEIVED'>('AWAITING_RESPONSE');

  // -------------------------------------------------------------------------
  // 2. Escalations State — Filters: Status (All Escalations, Open, Resolved) & Levels
  // -------------------------------------------------------------------------
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [escTotal, setEscTotal] = useState<number>(0);
  const [escPage, setEscPage] = useState<number>(1);
  const [escTotalPages, setEscTotalPages] = useState<number>(1);
  const [escLoading, setEscLoading] = useState<boolean>(false);
  const [escStatusFilter, setEscStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [escLevelFilter, setEscLevelFilter] = useState<string>('');

  // -------------------------------------------------------------------------
  // 3. Dropdown Options (Users, Employees, Tasks for Modals)
  // -------------------------------------------------------------------------
  const [systemUsers, setSystemUsers] = useState<UserItem[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [modalTasks, setModalTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // 4. Modals & Drawers State
  // -------------------------------------------------------------------------
  const [detailFollowUp, setDetailFollowUp] = useState<FollowUpItem | null>(null);

  const [isResponseModalOpen, setIsResponseModalOpen] = useState<boolean>(false);
  const [actionTargetFollowUp, setActionTargetFollowUp] = useState<FollowUpItem | null>(null);
  const [responseForm, setResponseForm] = useState<{
    action: 'ACKNOWLEDGE' | 'RESCHEDULE' | 'COMPLETE' | 'CANCEL';
    response_notes: string;
    rescheduled_date: string;
  }>({
    action: 'ACKNOWLEDGE',
    response_notes: '',
    rescheduled_date: '',
  });

  const [isNewFollowUpOpen, setIsNewFollowUpOpen] = useState<boolean>(false);
  const [newFuForm, setNewFuForm] = useState({
    employee_id: '',
    task_id: '',
    target_user_id: '',
    follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const [detailEscalation, setDetailEscalation] = useState<EscalationItem | null>(null);

  const [isResolveOpen, setIsResolveOpen] = useState<boolean>(false);
  const [actionTargetEscalation, setActionTargetEscalation] = useState<EscalationItem | null>(null);
  const [resolveForm, setResolveForm] = useState<{
    status: 'RESOLVED' | 'ACKNOWLEDGED';
    resolution_notes: string;
  }>({
    status: 'RESOLVED',
    resolution_notes: '',
  });

  const [isNewEscalateOpen, setIsNewEscalateOpen] = useState<boolean>(false);
  const [newEscForm, setNewEscForm] = useState({
    employee_id: '',
    task_id: '',
    escalated_to_user_id: '',
    escalation_level: 1,
    reason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Expanded description states for table rows
  const [expandedFollowUpIds, setExpandedFollowUpIds] = useState<Set<number>>(new Set());
  const [expandedEscalationIds, setExpandedEscalationIds] = useState<Set<number>>(new Set());

  const toggleExpandFollowUp = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFollowUpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandEscalation = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEscalationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // 5. Data Fetchers
  // -------------------------------------------------------------------------
  const loadOverview = useCallback(async () => {
    try {
      const data = await slaApi.getOverview();
      if (data) {
        setMetrics(data);
      }
    } catch {
      // Graceful fallback to preserve current metrics state
    }
  }, []);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        const [usersRes, empRes] = await Promise.all([
          userApi.listUsers({ size: 100, is_active: true }),
          employeeApi.listEmployees({ size: 100 }),
        ]);
        setSystemUsers(usersRes.items || []);
        setEmployeesList(empRes.items || []);
      } catch (err) {
        console.error('Failed to load system dropdown options:', err);
      }
    };
    fetchDropdownOptions();
    loadOverview();
  }, [loadOverview]);

  const loadFollowUps = useCallback(async () => {
    setFuLoading(true);
    setActionError(null);
    try {
      const res = await slaApi.listFollowUps({
        page: fuPage,
        size: 15,
        response_received: fuFilter === 'RESPONSE_RECEIVED',
        view: fuFilter,
      });
      setFollowUps(res.items || []);
      const total = res.pagination?.total ?? res.total ?? 0;
      const pages = res.pagination?.total_pages ?? res.pages ?? 1;
      setFuTotal(total);
      setFuTotalPages(pages);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to load follow-up records.');
    } finally {
      setFuLoading(false);
    }
  }, [fuPage, fuFilter]);

  const loadEscalations = useCallback(async () => {
    setEscLoading(true);
    setActionError(null);
    try {
      const res = await slaApi.listEscalations({
        page: escPage,
        size: 15,
        status: escStatusFilter === 'ALL' ? undefined : escStatusFilter,
        level: escLevelFilter ? Number(escLevelFilter) : undefined,
      });
      setEscalations(res.items || []);
      const total = res.pagination?.total ?? res.total ?? 0;
      const pages = res.pagination?.total_pages ?? res.pages ?? 1;
      setEscTotal(total);
      setEscTotalPages(pages);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to load escalation records.');
    } finally {
      setEscLoading(false);
    }
  }, [escPage, escStatusFilter, escLevelFilter]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  useEffect(() => {
    if (activeTab === 'escalations') {
      loadEscalations();
    }
  }, [activeTab, loadEscalations]);

  const fetchTasksForEmployee = async (employeeId: number) => {
    if (!employeeId) {
      setModalTasks([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const res = await taskApi.listTasks({ employee_id: employeeId, active_only: true, size: 50 });
      setModalTasks(res.items || []);
    } catch (err) {
      console.error('Failed to load active tasks for employee:', err);
      setModalTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // -------------------------------------------------------------------------
  // 6. Action Handlers
  // -------------------------------------------------------------------------
  const handleOpenResponseModal = (fu: FollowUpItem) => {
    setActionTargetFollowUp(fu);
    setResponseForm({
      action: 'ACKNOWLEDGE',
      response_notes: '',
      rescheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    });
    setIsResponseModalOpen(true);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTargetFollowUp) return;
    if (!responseForm.response_notes.trim()) {
      setActionError('Response remarks are required to record follow-up action.');
      return;
    }
    if (responseForm.action === 'RESCHEDULE' && !responseForm.rescheduled_date) {
      setActionError('A new rescheduled date is required.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await slaApi.acknowledgeFollowUp(actionTargetFollowUp.id, {
        action: responseForm.action,
        response_notes: responseForm.response_notes.trim(),
        rescheduled_date: responseForm.action === 'RESCHEDULE' ? responseForm.rescheduled_date : undefined,
      });

      setIsResponseModalOpen(false);
      if (detailFollowUp && detailFollowUp.id === actionTargetFollowUp.id) {
        setDetailFollowUp({ ...detailFollowUp, ...updated });
      }

      const actionLabels: Record<string, string> = {
        ACKNOWLEDGE: 'Response recorded',
        RESCHEDULE: 'Follow-up rescheduled',
        COMPLETE: 'Follow-up marked completed',
        CANCEL: 'Follow-up cancelled',
      };
      setActionSuccess(`${actionLabels[responseForm.action] || 'Action recorded'} successfully.`);
      loadFollowUps();
      loadOverview();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        (Array.isArray(err?.response?.data?.error?.details)
          ? err.response.data.error.details.map((d: any) => d.msg).join(', ')
          : null) ||
        'Failed to record follow-up response.';
      setActionError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewFollowUp = () => {
    setNewFuForm({
      employee_id: '',
      task_id: '',
      target_user_id: '',
      follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      notes: '',
    });
    setModalTasks([]);
    setIsNewFollowUpOpen(true);
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFuForm.task_id) {
      setActionError('Please select a related active task.');
      return;
    }
    if (!newFuForm.notes.trim()) {
      setActionError('Please provide follow-up notes/instructions.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await slaApi.scheduleFollowUp({
        task_id: Number(newFuForm.task_id),
        target_user_id: newFuForm.target_user_id ? Number(newFuForm.target_user_id) : undefined,
        follow_up_date: newFuForm.follow_up_date,
        notes: newFuForm.notes.trim(),
      });
      setIsNewFollowUpOpen(false);
      setActionSuccess('Follow-up successfully scheduled and notification sent.');
      loadFollowUps();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to schedule follow-up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenResolveModal = (esc: EscalationItem) => {
    setActionTargetEscalation(esc);
    setResolveForm({
      status: 'RESOLVED',
      resolution_notes: '',
    });
    setIsResolveOpen(true);
  };

  const handleSubmitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTargetEscalation) return;
    if (!resolveForm.resolution_notes.trim() || resolveForm.resolution_notes.trim().length < 5) {
      setActionError('Resolution remarks must be at least 5 characters long.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await slaApi.resolveEscalation(actionTargetEscalation.id, {
        status: resolveForm.status,
        resolution_notes: resolveForm.resolution_notes.trim(),
      });
      setIsResolveOpen(false);
      if (detailEscalation && detailEscalation.id === actionTargetEscalation.id) {
        setDetailEscalation({ ...detailEscalation, ...updated });
      }
      setActionSuccess(`Escalation successfully marked as ${resolveForm.status}.`);
      loadEscalations();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to resolve escalation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenNewEscalate = () => {
    const defaultRecipient = systemUsers.find(
      (u) => u.role?.role_code === 'HR_MANAGER' || u.role?.role_code === 'ADMIN'
    );
    setNewEscForm({
      employee_id: '',
      task_id: '',
      escalated_to_user_id: defaultRecipient ? String(defaultRecipient.id) : '',
      escalation_level: 1,
      reason: '',
    });
    setModalTasks([]);
    setIsNewEscalateOpen(true);
  };

  const handleCreateEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEscForm.task_id) {
      setActionError('Please select a related active task to escalate.');
      return;
    }
    if (!newEscForm.escalated_to_user_id) {
      setActionError('Please select the responsible recipient.');
      return;
    }
    if (!newEscForm.reason.trim() || newEscForm.reason.trim().length < 5) {
      setActionError('Please provide a clear escalation reason (minimum 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await slaApi.createEscalation({
        task_id: Number(newEscForm.task_id),
        escalated_to_user_id: Number(newEscForm.escalated_to_user_id),
        escalation_level: Number(newEscForm.escalation_level),
        reason: newEscForm.reason.trim(),
      });
      setIsNewEscalateOpen(false);
      setActionSuccess('Operational escalation created and dispatched to recipient.');
      loadEscalations();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to create escalation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canResolveEscalation = (esc: EscalationItem) => {
    if (roleCode === 'ADMIN' || roleCode === 'HR_MANAGER') return true;
    if (esc.escalated_to_user_id === currentUserId) return true;
    return false;
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isDueToday = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return today.getTime() === d.getTime();
    } catch {
      return false;
    }
  };

  const getOverdueDays = (dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - d.getTime();
      return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  const getDueInDays = (dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const diffMs = d.getTime() - today.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const getEscalationLevelInfo = (level: number) => {
    switch (level) {
      case 3:
        return {
          label: 'Level 3 — Director / Admin',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 2:
        return {
          label: 'Level 2 — HR Manager',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 1:
      default:
        return {
          label: 'Level 1 — Reporting Manager',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
    }
  };

  const activeFollowUpsCount = metrics.awaiting_response > 0 ? metrics.awaiting_response : fuTotal;
  const activeEscalationsCount = metrics.open_escalations > 0 ? metrics.open_escalations : escTotal;

  return (
    <div className="space-y-6 animate-in fade-in duration-150 w-full max-w-full min-w-0 pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header with Title & Action Button */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2DBEB] pb-5">
        <div>
          <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-extrabold tracking-tight text-[#1E162B] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5425CB]/10 flex items-center justify-center text-[#5425CB]">
              <Clock className="w-5 h-5" />
            </div>
            Follow-ups & Escalations
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activeTab === 'escalations' ? (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              onClick={handleOpenNewEscalate}
              className="bg-[#5425CB] hover:bg-[#431DA3] text-white shadow-sm text-[14px] sm:text-[15px] font-semibold"
            >
              Raise Escalation
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              onClick={handleOpenNewFollowUp}
              className="bg-[#5425CB] hover:bg-[#431DA3] text-white shadow-sm text-[14px] sm:text-[15px] font-semibold"
            >
              Schedule Follow-up
            </Button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <Alert variant="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}
      {actionError && (
        <Alert variant="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Navigation Tabs: Follow-ups & Escalations */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex border-b border-app-border space-x-8 text-[15px] sm:text-[16px] font-semibold">
        <button
          className={`pb-3.5 transition-colors flex items-center gap-2 relative ${
            activeTab === 'followups'
              ? 'text-[#5425CB] font-bold border-b-2 border-[#5425CB]'
              : 'text-[#625A70] hover:text-[#292238]'
          }`}
          onClick={() => {
            setActiveTab('followups');
            setActionError(null);
          }}
        >
          <Clock className="w-4 h-4" />
          <span>Follow-ups</span>
          <span
            className={`text-[12px] sm:text-[13px] px-2.5 py-0.5 rounded-full font-bold ${
              activeTab === 'followups'
                ? 'bg-[#5425CB]/10 text-[#5425CB]'
                : 'bg-slate-100 text-[#625A70]'
            }`}
          >
            {activeFollowUpsCount}
          </span>
        </button>

        <button
          className={`pb-3.5 transition-colors flex items-center gap-2 relative ${
            activeTab === 'escalations'
              ? 'text-[#5425CB] font-bold border-b-2 border-[#5425CB]'
              : 'text-[#625A70] hover:text-[#292238]'
          }`}
          onClick={() => {
            setActiveTab('escalations');
            setActionError(null);
          }}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Escalations</span>
          <span
            className={`text-[12px] sm:text-[13px] px-2.5 py-0.5 rounded-full font-bold ${
              activeTab === 'escalations'
                ? 'bg-[#5425CB]/10 text-[#5425CB]'
                : 'bg-slate-100 text-[#625A70]'
            }`}
          >
            {activeEscalationsCount}
          </span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: Follow-ups — ONLY 2 Filters: Awaiting Response & Response Received */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          {/* Exactly 2 Filters: Awaiting Response and Response Received */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFuFilter('AWAITING_RESPONSE');
                setFuPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all flex items-center gap-2 border ${
                fuFilter === 'AWAITING_RESPONSE'
                  ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-xs'
                  : 'bg-white text-[#625A70] border-app-border hover:text-[#292238] hover:bg-slate-50'
              }`}
            >
              <span>Awaiting Response</span>
              <span
                className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                  fuFilter === 'AWAITING_RESPONSE'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-[#625A70]'
                }`}
              >
                {metrics.awaiting_response}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFuFilter('RESPONSE_RECEIVED');
                setFuPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all flex items-center gap-2 border ${
                fuFilter === 'RESPONSE_RECEIVED'
                  ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-xs'
                  : 'bg-white text-[#625A70] border-app-border hover:text-[#292238] hover:bg-slate-50'
              }`}
            >
              <span>Response Received</span>
              <span
                className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                  fuFilter === 'RESPONSE_RECEIVED'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-[#625A70]'
                }`}
              >
                {metrics.response_received}
              </span>
            </button>
          </div>

          {/* Desktop Table View — Redesigned 6-Column Layout */}
          <div className="hidden lg:block bg-white rounded-2xl border border-[#DCD5E8] shadow-xs overflow-hidden mt-4 w-full max-w-full">
            {fuLoading ? (
              <div className="p-16 text-center text-[#625A70]">
                <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5425CB]" />
                <p className="font-medium text-sm">Loading follow-up records...</p>
              </div>
            ) : followUps.length === 0 ? (
              <div className="p-16 text-center text-[#625A70]">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Clock className="w-6 h-6" />
                </div>
                <p className="font-semibold text-base text-[#292238]">No follow-ups found</p>
                <p className="text-xs sm:text-sm text-[#625A70] mt-1 max-w-sm mx-auto">
                  {fuFilter === 'AWAITING_RESPONSE'
                    ? 'No follow-ups are currently awaiting a response.'
                    : 'No follow-up responses have been recorded yet.'}
                </p>
                {isAdminOrHR && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    leftIcon={<Plus className="w-3.5 h-3.5 shrink-0" />}
                    onClick={handleOpenNewFollowUp}
                  >
                    Schedule Follow-up
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[1040px]">
                  <thead>
                    <tr className="border-b-2 border-[#D1C7E0] bg-[#EFE9F6] text-[13px] font-extrabold uppercase tracking-wider text-[#3B2D54] h-16 select-none">
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[27%] min-w-[250px]">Follow-up</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[15%] min-w-[140px]">Employee</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[15%] min-w-[140px]">
                        <span className="sr-only">Waiting for Response From</span>Waiting On
                      </th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[13%] min-w-[130px]">Next Follow-up</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[12%] min-w-[130px]">Status</th>
                      <th className="py-5 px-6 text-right align-middle font-bold text-[#3B2D54] w-[18%] min-w-[220px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE7F4] text-[15px] bg-white">
                    {followUps.map((fu) => {
                      const isOverdue = fu.is_overdue;
                      const isAcknowledged = fu.response_received;

                      return (
                        <tr
                          key={fu.id}
                          className="hover:bg-[#F9F7FD] transition-colors group cursor-pointer"
                          onClick={() => setDetailFollowUp(fu)}
                        >
                          {/* 1. Combined Follow-up: Task Code + Category, Title */}
                          <td className="py-6 px-6 align-top">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-mono text-[13px] font-bold text-[#5425CB] bg-[#EDE7F7] px-2.5 py-0.5 rounded-md border border-[#DCD5E8]">
                                {fu.task_code || 'TSK-0000'}
                              </span>
                              {fu.category && (
                                <span className="text-[12px] font-bold text-[#5C5270] bg-[#F3F0F8] px-2 py-0.5 rounded border border-[#E1DBEA] uppercase tracking-wide">
                                  {fu.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <div className="text-[15px] font-bold text-[#1E162B] leading-snug" title={fu.task_title}>
                              {fu.task_title || 'General Task'}
                            </div>

                            {/* Filter out automated SLA check-in boilerplate */}
                            {(() => {
                              const isAutomated = fu.notes && (
                                fu.notes.toLowerCase().includes('automated sla check-in') ||
                                fu.notes.toLowerCase().includes('sla check-in') ||
                                fu.notes.toLowerCase().includes('automated check-in') ||
                                fu.notes.toLowerCase().includes('automated')
                              );
                              if (!fu.notes || isAutomated) return null;
                              return (
                                <div className="mt-1.5">
                                  <p
                                    className={`text-[13.5px] text-[#4E465A] leading-relaxed ${
                                      expandedFollowUpIds.has(fu.id) ? '' : 'line-clamp-2'
                                    }`}
                                  >
                                    {fu.notes}
                                  </p>
                                  {fu.notes.length > 90 && (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleExpandFollowUp(fu.id, e)}
                                      className="text-[12px] font-semibold text-[#5425CB] hover:underline mt-0.5 inline-block focus:outline-none"
                                    >
                                      {expandedFollowUpIds.has(fu.id) ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* 2. Employee */}
                          <td className="py-6 px-6 align-top">
                            <div className="text-[15px] font-bold text-[#1E162B]">
                              {fu.employee_name || 'Assigned Employee'}
                            </div>
                            <div className="text-[13px] text-[#5C5270] flex items-center gap-1.5 mt-0.5 font-mono">
                              <span>{fu.employee_code || 'EMP-0000'}</span>
                            </div>
                            <div className="text-[13px] text-[#5C5270] mt-0.5 leading-snug break-words">
                              {fu.department_name || 'General Operations'}
                            </div>
                          </td>

                          {/* 3. Waiting On */}
                          <td className="py-6 px-6 align-top">
                            <div className="text-[15px] font-bold text-[#1E162B] flex items-center gap-2">
                              <User className="w-4 h-4 text-[#5C5270] shrink-0" />
                              <span className="truncate">{fu.target_name || 'Not assigned'}</span>
                            </div>
                            <div className="text-[13px] text-[#5C5270] mt-0.5 pl-6">
                              {fu.target_role_name || 'Task Owner'}
                            </div>
                          </td>

                          {/* 4. Next Follow-up */}
                          <td className="py-6 px-6 align-top">
                            {isAcknowledged ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-semibold bg-slate-100 text-[#5C5270] border border-slate-200/60">
                                  Not scheduled
                                </span>
                                <span className="text-[12px] text-[#5C5270]">Response recorded</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`text-[15px] font-semibold font-mono ${
                                    isOverdue ? 'text-rose-700 font-bold' : 'text-[#1E162B]'
                                  }`}
                                >
                                  {formatDateDisplay(fu.follow_up_date)}
                                </span>
                                {isOverdue ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    {getOverdueDays(fu.follow_up_date) > 0
                                      ? `Overdue by ${getOverdueDays(fu.follow_up_date)} day${
                                          getOverdueDays(fu.follow_up_date) === 1 ? '' : 's'
                                        }`
                                      : 'Overdue'}
                                  </span>
                                ) : isDueToday(fu.follow_up_date) ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Due today
                                  </span>
                                ) : getDueInDays(fu.follow_up_date) > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-slate-50 text-[#5C5270] border border-slate-200">
                                    {`Due in ${getDueInDays(fu.follow_up_date)} day${
                                      getDueInDays(fu.follow_up_date) === 1 ? '' : 's'
                                    }`}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>

                          {/* 5. Status */}
                          <td className="py-6 px-6 align-top">
                            {isAcknowledged ? (
                              fu.response_notes && fu.response_notes.includes('[COMPLETE') ? (
                                <Badge variant="lavender" dot size="md">
                                  Completed
                                </Badge>
                              ) : (
                                <Badge variant="success" dot size="md">
                                  Response Received
                                </Badge>
                              )
                            ) : isOverdue ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <Badge variant="danger" dot size="md">
                                  Overdue
                                </Badge>
                                <span className="sr-only">Pending Response</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-start gap-0.5">
                                <Badge variant="warning" dot size="md">
                                  Awaiting Response
                                </Badge>
                                <span className="sr-only">Pending Response</span>
                              </div>
                            )}
                          </td>

                          {/* 6. Actions */}
                          <td
                            className="py-6 px-6 align-top text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDetailFollowUp(fu)}
                                title="View complete details"
                                className="text-[14px] font-bold h-10 px-3.5 whitespace-nowrap"
                              >
                                View Details
                              </Button>

                              {!isAcknowledged && isManagerOrAbove && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-[#5425CB] hover:bg-[#431DA3] text-white text-[14px] font-bold h-10 px-3.5 whitespace-nowrap shadow-sm"
                                  onClick={() => handleOpenResponseModal(fu)}
                                  title="Record response from recipient"
                                >
                                  Record Response
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!fuLoading && fuTotalPages > 1 && (
              <div className="p-4 border-t border-app-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FBF9FD]/50">
                <span className="text-[14px] text-[#625A70]">
                  Showing page <span className="font-semibold text-[#292238]">{fuPage}</span> of{' '}
                  <span className="font-semibold text-[#292238]">{fuTotalPages}</span> ({fuTotal} total records)
                </span>
                <Pagination currentPage={fuPage} totalPages={fuTotalPages} onPageChange={setFuPage} />
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-3">
            {fuLoading ? (
              <div className="p-12 text-center text-[#625A70] bg-white rounded-xl border border-app-border">
                <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5425CB]" />
                <p className="text-sm">Loading follow-ups...</p>
              </div>
            ) : followUps.length === 0 ? (
              <div className="p-8 text-center text-[#625A70] bg-white rounded-xl border border-app-border">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm text-[#292238]">No follow-ups found</p>
              </div>
            ) : (
              followUps.map((fu) => {
                const isOverdue = fu.is_overdue;
                const isAcknowledged = fu.response_received;

                return (
                  <div
                    key={fu.id}
                    className="bg-white p-4 rounded-xl border border-app-border shadow-sm space-y-3"
                    onClick={() => setDetailFollowUp(fu)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[#5425CB] font-mono text-xs">
                            {fu.task_code || 'TSK-0000'}
                          </span>
                          {fu.category && (
                            <span className="text-[10px] font-semibold text-[#625A70] bg-[#FBF9FD] px-1.5 py-0.2 rounded border border-app-border uppercase tracking-wide">
                              {fu.category.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-[#292238] mt-1">
                          {fu.task_title || 'General Task'}
                        </h4>
                      </div>
                      <div>
                        {isAcknowledged ? (
                          <Badge variant="success" dot size="sm">
                            Response Received
                          </Badge>
                        ) : isOverdue ? (
                          <div className="flex flex-col items-end">
                            <Badge variant="danger" dot size="sm">
                              Overdue
                            </Badge>
                            <span className="sr-only">Pending Response</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <Badge variant="warning" dot size="sm">
                              Awaiting Response
                            </Badge>
                            <span className="sr-only">Pending Response</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-[#625A70] bg-[#FBF9FD] p-2.5 rounded-lg border border-app-border/60">
                      <p className="font-medium text-[#292238] mb-1">
                        Employee: {fu.employee_name} ({fu.employee_code})
                      </p>
                      {fu.notes && !(
                        fu.notes.toLowerCase().includes('automated') ||
                        fu.notes.toLowerCase().includes('sla check-in')
                      ) && (
                        <p className="text-[12px] text-[#292238] font-medium leading-relaxed">
                          Reason: {fu.notes}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-app-border/60">
                      <div>
                        <span className="text-[#625A70] text-[11px] block">Waiting for Response From</span>
                        <span className="font-medium text-[#292238]">{fu.target_name || 'Not assigned'}</span>
                        <span className="text-[10px] text-[#625A70] block">{fu.target_role_name || 'Owner'}</span>
                      </div>
                      <div>
                        <span className="text-[#625A70] text-[11px] block">Next Follow-up Due</span>
                        {isAcknowledged ? (
                          <span className="text-[#625A70] font-medium">Not scheduled</span>
                        ) : (
                          <>
                            <span className={isOverdue ? 'text-status-danger font-semibold' : 'text-[#292238]'}>
                              {formatDateDisplay(fu.follow_up_date)}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold text-status-danger block uppercase">
                                Overdue
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" onClick={() => setDetailFollowUp(fu)}>
                        Details
                      </Button>
                      {!isAcknowledged && isManagerOrAbove && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-[#5425CB] text-white"
                          onClick={() => handleOpenResponseModal(fu)}
                        >
                          Record Response
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {!fuLoading && fuTotalPages > 1 && (
              <div className="p-3 bg-white rounded-xl border border-app-border flex items-center justify-between">
                <span className="text-xs text-[#625A70]">
                  Page {fuPage} of {fuTotalPages}
                </span>
                <Pagination currentPage={fuPage} totalPages={fuTotalPages} onPageChange={setFuPage} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: Escalations — Redesigned 8-Column Layout */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'escalations' && (
        <div className="space-y-4">
          {/* Escalations Filter Bar: Status Pills (All Escalations, Open, Resolved) + Level Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setEscStatusFilter('ALL');
                  setEscPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all flex items-center gap-2 border ${
                  escStatusFilter === 'ALL'
                    ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-xs'
                    : 'bg-white text-[#625A70] border-app-border hover:text-[#292238] hover:bg-slate-50'
                }`}
              >
                <span>All Escalations</span>
                <span
                  className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                    escStatusFilter === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-[#625A70]'
                  }`}
                >
                  {metrics.total_escalations}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEscStatusFilter('OPEN');
                  setEscPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all flex items-center gap-2 border ${
                  escStatusFilter === 'OPEN'
                    ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-xs'
                    : 'bg-white text-[#625A70] border-app-border hover:text-[#292238] hover:bg-slate-50'
                }`}
              >
                <span>Open</span>
                <span
                  className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                    escStatusFilter === 'OPEN'
                      ? 'bg-white/20 text-white'
                      : metrics.open_escalations > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-[#625A70]'
                  }`}
                >
                  {metrics.open_escalations}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEscStatusFilter('RESOLVED');
                  setEscPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all flex items-center gap-2 border ${
                  escStatusFilter === 'RESOLVED'
                    ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-xs'
                    : 'bg-white text-[#625A70] border-app-border hover:text-[#292238] hover:bg-slate-50'
                }`}
              >
                <span>Resolved</span>
                <span
                  className={`text-[12px] px-2 py-0.5 rounded-full font-bold ${
                    escStatusFilter === 'RESOLVED'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-[#625A70]'
                  }`}
                >
                  {metrics.resolved_escalations}
                </span>
              </button>
            </div>

            {/* Severity Level Filter */}
            <div className="w-full sm:w-64">
              <Select
                options={[
                  { value: '', label: 'All Levels' },
                  { value: '1', label: 'Level 1 (Reporting Mgr)' },
                  { value: '2', label: 'Level 2 (HR Manager)' },
                  { value: '3', label: 'Level 3 (HR Director / Admin)' },
                ]}
                value={escLevelFilter}
                onChange={(e) => {
                  setEscLevelFilter(e.target.value);
                  setEscPage(1);
                }}
              />
            </div>
          </div>

          {/* Desktop Table for Escalations — Redesigned 7-Column Layout */}
          <div className="hidden lg:block bg-white rounded-2xl border border-[#DCD5E8] shadow-xs overflow-hidden mt-4 w-full max-w-full">
            {escLoading ? (
              <div className="p-16 text-center text-[#625A70]">
                <ShieldAlert className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5425CB]" />
                <p className="font-medium text-sm">Loading escalations...</p>
              </div>
            ) : escalations.length === 0 ? (
              <div className="p-16 text-center text-[#625A70]">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <p className="font-semibold text-base text-[#292238]">No escalations found</p>
                <p className="text-xs sm:text-sm text-[#625A70] mt-1 max-w-sm mx-auto">
                  {escStatusFilter === 'OPEN'
                    ? 'There are no open escalations requiring managerial intervention.'
                    : 'No escalation records found for the selected filter.'}
                </p>
                {isAdminOrHR && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    leftIcon={<Plus className="w-3.5 h-3.5 shrink-0" />}
                    onClick={handleOpenNewEscalate}
                  >
                    Raise Escalation
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[1040px]">
                  <thead>
                    <tr className="border-b-2 border-[#D1C7E0] bg-[#EFE9F6] text-[13px] font-extrabold uppercase tracking-wider text-[#3B2D54] h-16 select-none">
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[24%] min-w-[220px]">Issue / Reason</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[14%] min-w-[130px]">Employee</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[16%] min-w-[150px]">Related HR Task</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[13%] min-w-[130px]">Escalation Level</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[15%] min-w-[140px]">Escalation Ownership</th>
                      <th className="py-5 px-6 text-left align-middle font-bold text-[#3B2D54] w-[8%] min-w-[85px]">Status</th>
                      <th className="py-5 px-6 text-right align-middle font-bold text-[#3B2D54] w-[10%] min-w-[150px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDE7F4] text-[15px] bg-white">
                    {escalations.map((esc) => {
                      const isOpen = esc.status === 'OPEN';
                      const isResolved = esc.status === 'RESOLVED';
                      const canResolve = isOpen && canResolveEscalation(esc);
                      const levelInfo = getEscalationLevelInfo(esc.escalation_level);

                      return (
                        <tr
                          key={esc.id}
                          className="hover:bg-[#F9F7FD] transition-colors group cursor-pointer"
                          onClick={() => setDetailEscalation(esc)}
                        >
                          {/* 1. Issue / Reason with SLA Breach badge and readable description */}
                          <td className="py-6 px-6 align-top">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                SLA Breach
                              </span>
                            </div>
                            <div
                              className={`text-[14.5px] font-semibold text-[#1E162B] leading-relaxed ${
                                expandedEscalationIds.has(esc.id) ? '' : 'line-clamp-2'
                              }`}
                            >
                              {esc.reason}
                            </div>
                            {esc.reason && esc.reason.length > 90 && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpandEscalation(esc.id, e)}
                                className="text-[12px] font-semibold text-[#5425CB] hover:underline mt-0.5 inline-block focus:outline-none"
                              >
                                {expandedEscalationIds.has(esc.id) ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </td>

                          {/* 2. Employee */}
                          <td className="py-6 px-6 align-top">
                            <div className="font-bold text-[#1E162B] text-[15px]">
                              {esc.employee_name || 'Assigned Employee'}
                            </div>
                            <div className="text-[13px] text-[#5C5270] flex items-center gap-1.5 mt-0.5 font-mono">
                              <span>{esc.employee_code || 'EMP-0000'}</span>
                            </div>
                            <div className="text-[13px] text-[#5C5270] mt-0.5 leading-snug break-words">
                              {esc.department_name || 'General Operations'}
                            </div>
                          </td>

                          {/* 3. Related HR Task */}
                          <td className="py-6 px-6 align-top">
                            {esc.task_code ? (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="font-mono text-[13px] font-bold text-[#5425CB] bg-[#EDE7F7] px-2.5 py-0.5 rounded-md border border-[#DCD5E8]">
                                    {esc.task_code}
                                  </span>
                                  {esc.category && (
                                    <span className="text-[12px] font-bold text-[#5C5270] bg-[#F3F0F8] px-2 py-0.5 rounded border border-[#E1DBEA] uppercase tracking-wide">
                                      {esc.category.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[14.5px] font-semibold text-[#1E162B] leading-snug line-clamp-2" title={esc.task_title}>
                                  {esc.task_title || 'General Task'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[14px] text-slate-400 italic">No linked HR task</span>
                            )}
                          </td>

                          {/* 4. Escalation Level */}
                          <td className="py-6 px-6 align-top">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-md text-[13px] font-bold border ${levelInfo.badgeClass}`}
                              >
                                {levelInfo.label}
                              </span>
                            </div>
                          </td>

                          {/* 5. Escalation Ownership (Raised By / Raised On + Assigned To) */}
                          <td className="py-6 px-6 align-top">
                            <div className="mb-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#716D7D]">Raised By</div>
                              <div className="text-[14px] font-semibold text-[#1E162B]">
                                {esc.escalated_by_name || 'HR Staff'}
                              </div>
                              <div className="text-[12px] text-[#716D7D]">
                                {formatDateDisplay(esc.created_at)}
                              </div>
                            </div>
                            <div className="pt-1.5 border-t border-[#EAE6F2]">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#716D7D]">Assigned To</div>
                              <div className="text-[14px] font-semibold text-[#1E162B] flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[#5C5270] shrink-0" />
                                <span className="truncate">{esc.escalated_to_name || 'Unassigned'}</span>
                              </div>
                              <div className="text-[12px] text-[#716D7D] pl-5">
                                {esc.escalated_to_role_name || 'Designated Owner'}
                              </div>
                            </div>
                          </td>

                          {/* 6. Status */}
                          <td className="py-6 px-6 align-top">
                            {isOpen ? (
                              <Badge variant="danger" dot size="md">
                                OPEN
                              </Badge>
                            ) : isResolved ? (
                              <Badge variant="success" dot size="md">
                                RESOLVED
                              </Badge>
                            ) : (
                              <Badge variant="lavender" dot size="md">
                                {esc.status}
                              </Badge>
                            )}
                          </td>

                          {/* 7. Actions */}
                          <td
                            className="py-6 px-6 align-top text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDetailEscalation(esc)}
                                title="View escalation details"
                                className="text-[14px] font-bold h-10 px-3.5 whitespace-nowrap"
                              >
                                View Details
                              </Button>

                              {canResolve && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[14px] font-bold h-10 px-3.5 whitespace-nowrap shadow-sm"
                                  onClick={() => handleOpenResolveModal(esc)}
                                  title="Resolve this escalation"
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!escLoading && escTotalPages > 1 && (
              <div className="p-4 border-t border-app-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FBF9FD]/50">
                <span className="text-[14px] text-[#625A70]">
                  Showing page <span className="font-semibold text-[#292238]">{escPage}</span> of{' '}
                  <span className="font-semibold text-[#292238]">{escTotalPages}</span> ({escTotal} total records)
                </span>
                <Pagination currentPage={escPage} totalPages={escTotalPages} onPageChange={setEscPage} />
              </div>
            )}
          </div>

          {/* Mobile Card View for Escalations */}
          <div className="block lg:hidden space-y-3">
            {escLoading ? (
              <div className="p-12 text-center text-[#625A70] bg-white rounded-xl border border-app-border">
                <ShieldAlert className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5425CB]" />
                <p className="text-sm">Loading escalations...</p>
              </div>
            ) : escalations.length === 0 ? (
              <div className="p-8 text-center text-[#625A70] bg-white rounded-xl border border-app-border">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-sm text-[#292238]">No escalations found</p>
              </div>
            ) : (
              escalations.map((esc) => {
                const isOpen = esc.status === 'OPEN';
                const canResolve = isOpen && canResolveEscalation(esc);
                const levelInfo = getEscalationLevelInfo(esc.escalation_level);

                return (
                  <div
                    key={esc.id}
                    className="bg-white p-4 rounded-xl border border-app-border shadow-sm space-y-3"
                    onClick={() => setDetailEscalation(esc)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-[#5425CB]">
                            {esc.task_code || 'TSK-0000'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${levelInfo.badgeClass}`}>
                            {levelInfo.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#292238] mt-1">
                          {esc.task_title || 'General Task'}
                        </h4>
                      </div>
                      <div>
                        {isOpen ? (
                          <Badge variant="danger" dot size="sm">
                            OPEN
                          </Badge>
                        ) : (
                          <Badge variant="success" dot size="sm">
                            {esc.status}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-[#292238] bg-slate-50 p-2.5 rounded-lg border border-app-border/60">
                      <p className="font-medium text-[#625A70] mb-0.5">
                        Employee: {esc.employee_name} ({esc.employee_code})
                      </p>
                      <p className="text-xs text-[#292238] font-medium mt-1 leading-relaxed">{esc.reason}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-app-border/60">
                      <div>
                        <span className="text-[#625A70] text-[11px] block">Assigned To</span>
                        <span className="font-medium text-[#292238]">{esc.escalated_to_name || 'Unassigned'}</span>
                        <span className="text-[10px] text-[#625A70] block">{esc.escalated_to_role_name || 'Assignee'}</span>
                      </div>
                      <div>
                        <span className="text-[#625A70] text-[11px] block">Raised On</span>
                        <span className="text-[#292238] font-medium">{formatDateDisplay(esc.created_at)}</span>
                        <span className="text-[10px] text-[#625A70] block">By: {esc.escalated_by_name || 'HR Staff'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm" onClick={() => setDetailEscalation(esc)}>
                        Details
                      </Button>
                      {canResolve && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleOpenResolveModal(esc)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {!escLoading && escTotalPages > 1 && (
              <div className="p-3 bg-white rounded-xl border border-app-border flex items-center justify-between">
                <span className="text-xs text-[#625A70]">
                  Page {escPage} of {escTotalPages}
                </span>
                <Pagination currentPage={escPage} totalPages={escTotalPages} onPageChange={setEscPage} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Follow-up Details Slide-over / Modal (Redesigned Structured Inspection) */}
      {/* ------------------------------------------------------------------ */}
      {detailFollowUp && (
        <Modal
          isOpen={!!detailFollowUp}
          onClose={() => setDetailFollowUp(null)}
          title={`Follow-up Details — FU #${detailFollowUp.id}`}
          maxWidth="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              <div className="text-[13px] text-[#625A70]">
                Created on {formatDateDisplay(detailFollowUp.created_at)}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="md" onClick={() => setDetailFollowUp(null)}>
                  Close
                </Button>
                {!detailFollowUp.response_received && isManagerOrAbove && (
                  <Button
                    variant="primary"
                    size="md"
                    className="bg-[#5425CB] hover:bg-[#431DA3] text-white"
                    onClick={() => {
                      const item = detailFollowUp;
                      setDetailFollowUp(null);
                      handleOpenResponseModal(item);
                    }}
                  >
                    Record Response
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-[15px]">
            {/* Status & Timing Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FBF9FD] p-4 rounded-xl border border-app-border">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[13px] font-bold text-[#625A70] uppercase tracking-wider">Status:</span>
                {detailFollowUp.response_received ? (
                  detailFollowUp.response_notes && detailFollowUp.response_notes.includes('[COMPLETE') ? (
                    <Badge variant="success" dot size="md">
                      Resolved
                    </Badge>
                  ) : (
                    <Badge variant="success" dot size="md">
                      Response Received
                    </Badge>
                  )
                ) : detailFollowUp.is_overdue ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="danger" dot size="md">
                      Overdue
                    </Badge>
                    <span className="sr-only">Pending Response</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="warning" dot size="md">
                      Awaiting Response
                    </Badge>
                    <span className="sr-only">Pending Response</span>
                  </div>
                )}
              </div>
              <div className="text-[13px] font-semibold text-[#292238] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#625A70]" />
                {detailFollowUp.response_received ? (
                  <span>Last Contact: {formatDateDisplay(detailFollowUp.follow_up_date)} (Next: Not scheduled)</span>
                ) : (
                  <span>Next Due: {formatDateDisplay(detailFollowUp.follow_up_date)}</span>
                )}
              </div>
            </div>

            {/* Related Employee & Related Task info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-app-border bg-white shadow-xs space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#625A70] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#5425CB]" />
                  Related Employee
                </div>
                <div className="font-bold text-[15px] sm:text-[16px] text-[#292238]">
                  {detailFollowUp.employee_name || 'Employee'}
                </div>
                <div className="text-[13px] text-[#625A70] flex items-center gap-2">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[12px]">
                    {detailFollowUp.employee_code || 'EMP-0000'}
                  </span>
                  {detailFollowUp.department_name && (
                    <span className="flex items-center gap-1 text-[#625A70]">
                      <Building2 className="w-3.5 h-3.5" />
                      {detailFollowUp.department_name}
                    </span>
                  )}
                </div>
                {detailFollowUp.employee_id && (
                  <div className="pt-1">
                    <Link
                      to={`/employees/${detailFollowUp.employee_id}`}
                      className="text-[13px] text-[#5425CB] hover:underline font-semibold inline-flex items-center gap-1.5"
                    >
                      View Employee Profile
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-app-border bg-white shadow-xs space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#625A70] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5425CB]" />
                  Related Task
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] font-bold text-[#5425CB]">
                    {detailFollowUp.task_code || 'TSK-0000'}
                  </span>
                  {detailFollowUp.category && (
                    <span className="text-[11px] font-semibold text-[#625A70] bg-[#FBF9FD] px-2 py-0.5 rounded border border-app-border uppercase tracking-wide">
                      {detailFollowUp.category.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="text-[14px] sm:text-[15px] font-semibold text-[#292238] line-clamp-2 leading-snug">
                  {detailFollowUp.task_title || 'General Task'}
                </div>
                <div className="pt-1">
                  <Link
                    to={`/action-center?search=${detailFollowUp.task_code || ''}`}
                    className="text-[13px] text-[#5425CB] hover:underline font-semibold inline-flex items-center gap-1.5"
                  >
                    Open in Task Management
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* People Involved & Scheduling Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-app-border/80">
                <span className="text-[#625A70] block font-medium text-[13px]">Waiting for Response From</span>
                <span className="font-semibold text-[15px] text-[#292238] mt-1 block">
                  {detailFollowUp.target_name || 'Designated Owner'}
                </span>
                <span className="text-[12px] text-[#625A70] block">
                  {detailFollowUp.target_role_name || 'Task Owner'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-app-border/80">
                <span className="text-[#625A70] block font-medium text-[13px]">Scheduled By</span>
                <span className="font-semibold text-[15px] text-[#292238] mt-1 block">
                  {detailFollowUp.initiator_name || 'HR Operations'}
                </span>
                <span className="text-[12px] text-[#625A70] block">
                  {detailFollowUp.initiator_role_name || 'HR Operations'}
                </span>
              </div>
            </div>

            {/* Original Instructions / Notes */}
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wider text-[#625A70] mb-2">
                Follow-up Notes & Instructions
              </label>
              <div className="p-4 bg-white border border-app-border rounded-xl text-[14px] sm:text-[15px] text-[#292238] whitespace-pre-wrap leading-relaxed shadow-xs">
                {detailFollowUp.notes}
              </div>
            </div>

            {/* Recorded Response Details (if present) */}
            {detailFollowUp.response_received && (
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Recorded Response Details
                </label>
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-[14px] sm:text-[15px] text-[#292238] whitespace-pre-wrap leading-relaxed">
                  {detailFollowUp.response_notes || 'Response received and verified.'}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. Record Response Modal */}
      {/* ------------------------------------------------------------------ */}
      {isResponseModalOpen && actionTargetFollowUp && (
        <Modal
          isOpen={isResponseModalOpen}
          onClose={() => setIsResponseModalOpen(false)}
          title={`Record Response — ${actionTargetFollowUp.task_code || 'Follow-up'}`}
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsResponseModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA3] text-white"
                onClick={handleSubmitResponse}
              >
                {isSubmitting ? (
                  <Clock className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Save Response
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitResponse} className="space-y-4.5 text-[15px]">
            <div className="bg-[#FBF9FD] p-3.5 rounded-xl border border-app-border text-[13px] space-y-1.5">
              <div className="font-semibold text-[#292238]">
                Employee: {actionTargetFollowUp.employee_name} ({actionTargetFollowUp.employee_code})
              </div>
              <div className="text-[#625A70]">
                Task: <span className="font-mono text-[#5425CB] font-semibold">{actionTargetFollowUp.task_code}</span> —{' '}
                {actionTargetFollowUp.task_title}
              </div>
              <div className="text-[#625A70]">
                Waiting for: <span className="font-semibold text-[#292238]">{actionTargetFollowUp.target_name}</span> ({actionTargetFollowUp.target_role_name || 'Task Owner'})
              </div>
            </div>

            <div>
              <Select
                label="Action to Record"
                options={[
                  { value: 'ACKNOWLEDGE', label: 'Response Received & Confirmed' },
                  { value: 'RESCHEDULE', label: 'Schedule Another Follow-up (Reschedule)' },
                  { value: 'COMPLETE', label: 'Mark Follow-up as Completed' },
                  { value: 'CANCEL', label: 'Cancel Follow-up (No Longer Required)' },
                ]}
                value={responseForm.action}
                onChange={(e) =>
                  setResponseForm({ ...responseForm, action: e.target.value as any })
                }
              />
            </div>

            {responseForm.action === 'RESCHEDULE' && (
              <div>
                <Input
                  label="New Follow-up Date"
                  type="date"
                  required
                  value={responseForm.rescheduled_date}
                  onChange={(e) =>
                    setResponseForm({ ...responseForm, rescheduled_date: e.target.value })
                  }
                />
              </div>
            )}

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Response Details / Notes <span className="text-rose-600">*</span>
              </label>
              <textarea
                className="w-full h-28 p-3.5 text-[15px] bg-white border border-[#E1DBEA] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all text-[#292238]"
                placeholder="Record the feedback, progress update, call notes, or reason for rescheduling..."
                value={responseForm.response_notes}
                onChange={(e) =>
                  setResponseForm({ ...responseForm, response_notes: e.target.value })
                }
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. Schedule New Follow-up Modal */}
      {/* ------------------------------------------------------------------ */}
      {isNewFollowUpOpen && (
        <Modal
          isOpen={isNewFollowUpOpen}
          onClose={() => setIsNewFollowUpOpen(false)}
          title="Schedule a Follow-up"
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsNewFollowUpOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA3] text-white"
                onClick={handleCreateFollowUp}
              >
                {isSubmitting ? (
                  <Clock className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                Schedule
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateFollowUp} className="space-y-4.5 text-[15px]">
            <div>
              <Select
                label="Related Employee"
                options={[
                  { value: '', label: 'Select an employee...' },
                  ...employeesList.map((emp) => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name} (${emp.employee_code})`,
                  })),
                ]}
                value={newFuForm.employee_id}
                onChange={(e) => {
                  const empId = e.target.value;
                  setNewFuForm({ ...newFuForm, employee_id: empId, task_id: '' });
                  if (empId) {
                    fetchTasksForEmployee(Number(empId));
                  } else {
                    setModalTasks([]);
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Related Task <span className="text-rose-600">*</span>
              </label>
              {loadingTasks ? (
                <div className="p-3 text-[14px] text-[#625A70] flex items-center gap-2 bg-slate-50 rounded-xl border border-app-border">
                  <Clock className="w-4 h-4 animate-spin text-[#5425CB]" />
                  Loading active tasks for selected employee...
                </div>
              ) : (
                <Select
                  options={[
                    {
                      value: '',
                      label: newFuForm.employee_id
                        ? modalTasks.length > 0
                          ? 'Select an active task...'
                          : 'No active tasks are available for this employee.'
                        : 'Select an employee first...',
                    },
                    ...modalTasks.map((t) => ({
                      value: String(t.id),
                      label: `${t.task_code} — ${t.title} (${t.status})`,
                    })),
                  ]}
                  value={newFuForm.task_id}
                  disabled={!newFuForm.employee_id || modalTasks.length === 0}
                  onChange={(e) => {
                    const taskId = e.target.value;
                    const selectedTask = modalTasks.find((t) => String(t.id) === taskId);
                    setNewFuForm({
                      ...newFuForm,
                      task_id: taskId,
                      target_user_id: selectedTask?.owner_id ? String(selectedTask.owner_id) : newFuForm.target_user_id,
                    });
                  }}
                />
              )}
              {newFuForm.employee_id && !loadingTasks && modalTasks.length === 0 && (
                <p className="text-[12px] text-amber-700 mt-1">
                  This employee currently has no active tasks requiring follow-up. Completed tasks cannot be followed up.
                </p>
              )}
            </div>

            <div>
              <Select
                label="Waiting for Response From"
                options={[
                  { value: '', label: 'Select person (defaults to task owner)...' },
                  ...systemUsers.map((u) => ({
                    value: String(u.id),
                    label: `${u.full_name} (${u.role?.role_name || 'Staff'})`,
                  })),
                ]}
                value={newFuForm.target_user_id}
                onChange={(e) => setNewFuForm({ ...newFuForm, target_user_id: e.target.value })}
              />
            </div>

            <div>
              <Input
                label="Follow-up Date"
                type="date"
                required
                value={newFuForm.follow_up_date}
                onChange={(e) => setNewFuForm({ ...newFuForm, follow_up_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Notes & Instructions <span className="text-rose-600">*</span>
              </label>
              <textarea
                className="w-full h-24 p-3.5 text-[15px] bg-white border border-[#E1DBEA] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all text-[#292238]"
                placeholder="State what response is needed, questions to follow up on, or required deliverables..."
                value={newFuForm.notes}
                onChange={(e) => setNewFuForm({ ...newFuForm, notes: e.target.value })}
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. Escalation Details Slide-over / Modal (Redesigned Structured Inspection) */}
      {/* ------------------------------------------------------------------ */}
      {detailEscalation && (
        <Modal
          isOpen={!!detailEscalation}
          onClose={() => setDetailEscalation(null)}
          title={`Escalation Details — Level ${detailEscalation.escalation_level}`}
          maxWidth="lg"
          footer={
            <div className="flex justify-between items-center w-full">
              <div className="text-[13px] text-[#625A70]">
                Escalated on {formatDateDisplay(detailEscalation.created_at)}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="md" onClick={() => setDetailEscalation(null)}>
                  Close
                </Button>
                {detailEscalation.status === 'OPEN' && canResolveEscalation(detailEscalation) && (
                  <Button
                    variant="primary"
                    size="md"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const item = detailEscalation;
                      setDetailEscalation(null);
                      handleOpenResolveModal(item);
                    }}
                  >
                    Resolve Escalation
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5 text-[15px]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FBF9FD] p-4 rounded-xl border border-app-border">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[13px] font-bold text-[#625A70] uppercase tracking-wider">Severity:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-bold border ${
                    getEscalationLevelInfo(detailEscalation.escalation_level).badgeClass
                  }`}
                >
                  {getEscalationLevelInfo(detailEscalation.escalation_level).label}
                </span>
                <span className="text-[13px] font-bold text-[#625A70] uppercase tracking-wider ml-2">Status:</span>
                {detailEscalation.status === 'OPEN' ? (
                  <Badge variant="danger" dot size="md">
                    OPEN
                  </Badge>
                ) : (
                  <Badge variant="success" dot size="md">
                    {detailEscalation.status}
                  </Badge>
                )}
              </div>
              <div className="text-[13px] font-semibold text-[#292238]">
                ID: ESC-{detailEscalation.id}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-app-border bg-white shadow-xs space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#625A70] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#5425CB]" />
                  Related Employee
                </div>
                <div className="font-bold text-[15px] sm:text-[16px] text-[#292238]">
                  {detailEscalation.employee_name || 'Employee'}
                </div>
                <div className="text-[13px] text-[#625A70] flex items-center gap-2">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[12px]">
                    {detailEscalation.employee_code || 'EMP-0000'}
                  </span>
                  {detailEscalation.department_name && (
                    <span className="flex items-center gap-1 text-[#625A70]">
                      <Building2 className="w-3.5 h-3.5" />
                      {detailEscalation.department_name}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-app-border bg-white shadow-xs space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#625A70] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5425CB]" />
                  Related HR Task
                </div>
                {detailEscalation.task_code ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[13px] font-bold text-[#5425CB]">
                        {detailEscalation.task_code}
                      </span>
                      {detailEscalation.category && (
                        <span className="text-[11px] font-semibold text-[#625A70] bg-[#FBF9FD] px-2 py-0.5 rounded border border-app-border uppercase tracking-wide">
                          {detailEscalation.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] sm:text-[15px] font-semibold text-[#292238] line-clamp-2 leading-snug">
                      {detailEscalation.task_title || 'General Task'}
                    </div>
                  </>
                ) : (
                  <div className="text-[14px] text-slate-400 italic">No linked HR task</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-app-border/80">
                <span className="text-[#625A70] block font-medium text-[13px]">Assigned To (Responsible for Resolution)</span>
                <span className="font-semibold text-[15px] text-[#292238] mt-1 block">
                  {detailEscalation.escalated_to_name || 'Assigned Recipient'}
                </span>
                <span className="text-[12px] text-[#625A70] block">
                  {detailEscalation.escalated_to_role_name || 'Assignee'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-app-border/80">
                <span className="text-[#625A70] block font-medium text-[13px]">Escalated By</span>
                <span className="font-semibold text-[15px] text-[#292238] mt-1 block">
                  {detailEscalation.escalated_by_name || 'HR Staff'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wider text-[#625A70] mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Escalation Reason & Context
              </label>
              <div className="p-4 bg-rose-50/40 border border-rose-200 rounded-xl text-[14px] sm:text-[15px] text-[#292238] whitespace-pre-wrap leading-relaxed">
                {detailEscalation.reason}
              </div>
            </div>

            {detailEscalation.resolution_notes && (
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Resolution Remarks
                </label>
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-[14px] sm:text-[15px] text-[#292238] whitespace-pre-wrap leading-relaxed">
                  {detailEscalation.resolution_notes}
                </div>
                {detailEscalation.resolved_at && (
                  <div className="text-[13px] text-[#625A70] mt-1.5 pl-1">
                    Resolved at: {formatDateDisplay(detailEscalation.resolved_at)}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. Resolve Escalation Modal */}
      {/* ------------------------------------------------------------------ */}
      {isResolveOpen && actionTargetEscalation && (
        <Modal
          isOpen={isResolveOpen}
          onClose={() => setIsResolveOpen(false)}
          title={`Resolve Escalation — Level ${actionTargetEscalation.escalation_level}`}
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsResolveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSubmitResolve}
              >
                {isSubmitting ? (
                  <Clock className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Confirm Resolution
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitResolve} className="space-y-4.5 text-[15px]">
            <div className="bg-[#FBF9FD] p-3.5 rounded-xl border border-app-border text-[13px] space-y-1.5">
              <div className="font-semibold text-[#292238]">
                Employee: {actionTargetEscalation.employee_name} ({actionTargetEscalation.employee_code})
              </div>
              <div className="text-[#625A70]">
                Task: <span className="font-mono text-[#5425CB] font-semibold">{actionTargetEscalation.task_code}</span> —{' '}
                {actionTargetEscalation.task_title}
              </div>
              <div className="text-[#625A70] italic">
                Reason: "{actionTargetEscalation.reason}"
              </div>
            </div>

            <div>
              <Select
                label="Resolution Outcome"
                options={[
                  { value: 'RESOLVED', label: 'RESOLVED (Blocker cleared / deliverables confirmed)' },
                  { value: 'ACKNOWLEDGED', label: 'ACKNOWLEDGED (Under active management review)' },
                ]}
                value={resolveForm.status}
                onChange={(e) =>
                  setResolveForm({ ...resolveForm, status: e.target.value as any })
                }
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Resolution Remarks <span className="text-rose-600">* (min 5 chars)</span>
              </label>
              <textarea
                className="w-full h-28 p-3.5 text-[15px] bg-white border border-[#E1DBEA] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all text-[#292238]"
                placeholder="State the resolution steps taken, deliverables verified, or instructions provided..."
                value={resolveForm.resolution_notes}
                onChange={(e) =>
                  setResolveForm({ ...resolveForm, resolution_notes: e.target.value })
                }
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. Raise Escalation Modal */}
      {/* ------------------------------------------------------------------ */}
      {isNewEscalateOpen && (
        <Modal
          isOpen={isNewEscalateOpen}
          onClose={() => setIsNewEscalateOpen(false)}
          title="Raise Operational Escalation"
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="md"
                disabled={isSubmitting}
                onClick={() => setIsNewEscalateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleCreateEscalation}
              >
                {isSubmitting ? (
                  <Clock className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <ShieldAlert className="w-4 h-4 mr-1.5" />
                )}
                Submit Escalation
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateEscalation} className="space-y-4.5 text-[15px]">
            <div>
              <Select
                label="Related Employee"
                options={[
                  { value: '', label: 'Select an employee...' },
                  ...employeesList.map((emp) => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name} (${emp.employee_code})`,
                  })),
                ]}
                value={newEscForm.employee_id}
                onChange={(e) => {
                  const empId = e.target.value;
                  setNewEscForm({ ...newEscForm, employee_id: empId, task_id: '' });
                  if (empId) {
                    fetchTasksForEmployee(Number(empId));
                  } else {
                    setModalTasks([]);
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Related Task <span className="text-rose-600">*</span>
              </label>
              {loadingTasks ? (
                <div className="p-3 text-[14px] text-[#625A70] flex items-center gap-2 bg-slate-50 rounded-xl border border-app-border">
                  <Clock className="w-4 h-4 animate-spin text-[#5425CB]" />
                  Loading active tasks for selected employee...
                </div>
              ) : (
                <Select
                  options={[
                    {
                      value: '',
                      label: newEscForm.employee_id
                        ? modalTasks.length > 0
                          ? 'Select an active task to escalate...'
                          : 'No active tasks are available for this employee.'
                        : 'Select an employee first...',
                    },
                    ...modalTasks.map((t) => ({
                      value: String(t.id),
                      label: `${t.task_code} — ${t.title} (${t.status})`,
                    })),
                  ]}
                  value={newEscForm.task_id}
                  disabled={!newEscForm.employee_id || modalTasks.length === 0}
                  onChange={(e) => setNewEscForm({ ...newEscForm, task_id: e.target.value })}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Select
                  label="Escalation Level"
                  options={[
                    { value: 1, label: 'Level 1 (Reporting Manager)' },
                    { value: 2, label: 'Level 2 (HR Operations Manager)' },
                    { value: 3, label: 'Level 3 (HR Director / Admin)' },
                  ]}
                  value={newEscForm.escalation_level}
                  onChange={(e) =>
                    setNewEscForm({ ...newEscForm, escalation_level: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <Select
                  label="Responsible Recipient"
                  options={[
                    { value: '', label: 'Select responsible person...' },
                    ...systemUsers.map((u) => ({
                      value: String(u.id),
                      label: `${u.full_name} (${u.role?.role_name || 'Staff'})`,
                    })),
                  ]}
                  value={newEscForm.escalated_to_user_id}
                  onChange={(e) =>
                    setNewEscForm({ ...newEscForm, escalated_to_user_id: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#292238] mb-1.5">
                Escalation Reason <span className="text-rose-600">* (min 5 chars)</span>
              </label>
              <textarea
                className="w-full h-28 p-3.5 text-[15px] bg-white border border-[#E1DBEA] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all text-[#292238]"
                placeholder="State why this task cannot proceed normally, the blocker, and the specific intervention required..."
                value={newEscForm.reason}
                onChange={(e) => setNewEscForm({ ...newEscForm, reason: e.target.value })}
                required
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
