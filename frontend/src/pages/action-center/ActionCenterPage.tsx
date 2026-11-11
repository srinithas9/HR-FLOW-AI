import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  User,
  MessageSquare,
  Trash2,
  Ban,
  CornerUpLeft,
  Users,
  CheckCheck,
  Send,
} from 'lucide-react';
import { taskApi, TaskFilterParams } from '../../api/taskApi';
import { userApi, UserItem } from '../../api/userApi';
import { employeeApi } from '../../api/employeeApi';
import { TaskItem, TaskDetail, TaskOverviewMetrics, TaskTemplate } from '../../types/task';
import { Employee } from '../../types/employee';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';

export type PrimaryView = 'MY_TASKS' | 'TEAM_TASKS' | 'ALL_TASKS' | 'COMPLETED';

export const ActionCenterPage: React.FC = () => {
  const { user } = useAuth();
  const roleCode = user?.role?.role_code;
  const isAdminOrHR = roleCode === 'ADMIN' || roleCode === 'HR_MANAGER' || roleCode === 'HR_EXECUTIVE';
  const isSuperAdminOrHRManager = roleCode === 'ADMIN' || roleCode === 'HR_MANAGER';

  // Overview metrics state
  const [metrics, setMetrics] = useState<TaskOverviewMetrics | null>(null);

  // Primary Navigation View (Default: MY_TASKS or restored from session)
  const [primaryView, setPrimaryView] = useState<PrimaryView>(() => {
    try {
      const saved = sessionStorage.getItem('hrflow_action_center_view') as PrimaryView;
      if (saved && ['MY_TASKS', 'TEAM_TASKS', 'ALL_TASKS', 'COMPLETED'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'MY_TASKS';
  });

  // Task listing state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Collapsible sections for My Tasks view
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overdue: false,
    due_today: false,
    upcoming: false,
    blocked: false,
    no_due_date: false,
  });

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Filters state
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dueWindowFilter, setDueWindowFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('due_date');
  const [sortOrder, setSortOrder] = useState<string>('asc');

  // Supporting lookup data
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);

  // Selected task & detail drawer
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'dependencies' | 'comments' | 'ml'>('details');

  // Action Modals State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  // Action & Form states
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'ONBOARDING',
    priority: 'MEDIUM',
    start_date: '',
  });

  const [createForm, setCreateForm] = useState({
    title: '',
    employee_id: '',
    category: 'ONBOARDING',
    owner_id: '',
    priority: 'MEDIUM',
    due_date: '',
    description: '',
    template_id: '',
    prerequisite_task_id: '',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'IN_PROGRESS',
    reason: '',
    override_dependencies: false,
    override_reason: '',
  });

  const [reassignForm, setReassignForm] = useState({
    new_owner_id: 0,
    reason: '',
  });

  const [deadlineForm, setDeadlineForm] = useState({
    new_due_date: '',
    reason: '',
  });

  const [cancelReason, setCancelReason] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('');

  // Load Overview Metrics
  const loadOverview = useCallback(async () => {
    try {
      const data = await taskApi.getOverview();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load task overview', err);
    }
  }, []);

  // Load Tasks List based on PrimaryView & Filters
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: TaskFilterParams = {
        page: currentPage,
        size: primaryView === 'MY_TASKS' ? 100 : 10,
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        due_window: dueWindowFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        view: primaryView,
      };

      if (primaryView === 'MY_TASKS') {
        params.active_only = true;
        if (user?.id) {
          params.owner_id = user.id;
        }
      } else if (primaryView === 'TEAM_TASKS') {
        params.active_only = true;
      } else if (primaryView === 'ALL_TASKS') {
        params.active_only = true;
      } else if (primaryView === 'COMPLETED') {
        // Query completed / cancelled tasks
        params.status = statusFilter || 'COMPLETED,CANCELLED';
      }

      const res = await taskApi.listTasks(params);
      setTasks(res.items);
      const total = res.pagination?.total ?? res.total ?? 0;
      const pages = res.pagination?.total_pages ?? res.pages ?? 1;
      setTotalCount(total);
      setTotalPages(pages);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    search,
    categoryFilter,
    priorityFilter,
    statusFilter,
    dueWindowFilter,
    primaryView,
    sortBy,
    sortOrder,
    user?.id,
  ]);

  // Load Task Detail Drawer - Always reset to Details tab
  const openTaskDetail = async (taskId: number) => {
    setSelectedTaskId(taskId);
    setActiveTab('details');
    setDrawerLoading(true);
    setActionError(null);
    setCommentInput('');
    try {
      const detail = await taskApi.getTaskDetail(taskId);
      setTaskDetail(detail);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Failed to retrieve task details.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeTaskDetail = () => {
    setSelectedTaskId(null);
    setTaskDetail(null);
    setActiveTab('details');
    setCommentInput('');
  };

  // Initial lookup loading & URL taskId param handling (safe in and out of router)
  useEffect(() => {
    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search);
      const taskId = params.get('taskId') || params.get('task_id') || params.get('highlight');
      if (taskId) {
        const parsedId = Number(taskId);
        if (!isNaN(parsedId) && parsedId > 0) {
          setPrimaryView('ALL_TASKS');
          openTaskDetail(parsedId);
        }
      }
    } catch {
      // Safe fallback
    }
  }, []);

  useEffect(() => {
    loadOverview();
    taskApi.listTemplates().then(setTemplates).catch(console.error);
    employeeApi.listEmployees({ size: 100 }).then((res) => setEmployees(res.items)).catch(console.error);
    userApi.listUsers({ size: 100, is_active: true }).then((res) => setUsersList(res.items)).catch(console.error);
  }, [loadOverview]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Primary view change handler with session persistence
  const handlePrimaryViewChange = (view: PrimaryView) => {
    setPrimaryView(view);
    try {
      sessionStorage.setItem('hrflow_action_center_view', view);
    } catch {}
    setCurrentPage(1);
    setStatusFilter('');
    setDueWindowFilter('');
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setPriorityFilter('');
    setStatusFilter('');
    setDueWindowFilter('');
    setPrimaryView('MY_TASKS');
    try {
      sessionStorage.setItem('hrflow_action_center_view', 'MY_TASKS');
    } catch {}
    setCurrentPage(1);
    setSortBy('due_date');
    setSortOrder('asc');
  };

  // Handle template selection in Add Task
  const handleTemplateChange = (tmplId: string) => {
    setCreateForm((prev) => {
      if (!tmplId) return { ...prev, template_id: '' };
      const selected = templates.find((t) => t.id === Number(tmplId));
      if (!selected) return { ...prev, template_id: tmplId };
      return {
        ...prev,
        template_id: tmplId,
        category: selected.category,
        priority: selected.default_priority,
        description: selected.description || prev.description,
        title: prev.title || selected.name,
      };
    });
  };

  // Handle Create Task submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!createForm.title.trim()) {
      setActionError('Task title is required.');
      return;
    }
    if (!createForm.employee_id) {
      setActionError('Please select an associated employee.');
      return;
    }
    if (!createForm.due_date) {
      setActionError('Due date is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await taskApi.createTask({
        employee_id: Number(createForm.employee_id),
        category: createForm.category,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        priority: createForm.priority,
        due_date: createForm.due_date,
        owner_id: createForm.owner_id ? Number(createForm.owner_id) : undefined,
        template_id: createForm.template_id ? Number(createForm.template_id) : undefined,
        prerequisite_task_ids: createForm.prerequisite_task_id ? [Number(createForm.prerequisite_task_id)] : undefined,
      });

      setIsCreateOpen(false);
      const isAssignedToOther = createForm.owner_id && Number(createForm.owner_id) !== user?.id;
      if (isAssignedToOther) {
        const ownerObj = usersList.find((u) => u.id === Number(createForm.owner_id));
        setActionSuccess(`Task ${created.task_code} created and assigned to ${ownerObj?.full_name || 'team member'}. View it in Team Tasks.`);
      } else {
        setActionSuccess(`Task ${created.task_code} successfully created and added to your tasks.`);
      }
      setCreateForm({
        title: '',
        employee_id: '',
        category: 'ONBOARDING',
        owner_id: '',
        priority: 'MEDIUM',
        due_date: '',
        description: '',
        template_id: '',
        prerequisite_task_id: '',
      });
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Task Modal
  const openEditModal = (task?: TaskItem | TaskDetail) => {
    const t = task || taskDetail;
    if (!t) return;
    setSelectedTaskId(t.id);
    setEditForm({
      title: t.title,
      description: t.description || '',
      category: t.category,
      priority: t.priority,
      start_date: (t as any).start_date ? String((t as any).start_date).split('T')[0] : '',
    });
    setIsEditModalOpen(true);
  };

  // Handle Edit Task submission
  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    if (!editForm.title.trim()) {
      setActionError('Task title cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await taskApi.updateTask(selectedTaskId, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        category: editForm.category,
        priority: editForm.priority,
        start_date: editForm.start_date || undefined,
      });
      setTaskDetail(updated);
      setIsEditModalOpen(false);
      setActionSuccess('Task details updated successfully.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Start Task action
  const handleStartTask = async (taskIdToStart?: number) => {
    const id = taskIdToStart || selectedTaskId;
    if (!id) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.updateStatus(id, {
        status: 'IN_PROGRESS',
        reason: 'Task started by user.',
      });
      if (selectedTaskId === id) {
        setTaskDetail(updated);
      }
      setActionSuccess('Task started and marked In Progress.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to start task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Update submission
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.updateStatus(selectedTaskId, {
        status: statusForm.status,
        reason: statusForm.reason.trim() || undefined,
        override_dependencies: statusForm.override_dependencies,
        override_reason: statusForm.override_reason.trim() || undefined,
      });
      setTaskDetail(updated);
      setIsStatusModalOpen(false);
      setActionSuccess(`Task status updated to ${statusForm.status}.`);
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update task status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick mark complete action
  const handleQuickMarkComplete = async (taskIdToComplete?: number, taskItem?: TaskItem) => {
    const id = taskIdToComplete || selectedTaskId;
    if (!id) return;

    // Check if task is blocked
    const isBlocked = taskItem ? taskItem.status === 'BLOCKED' : taskDetail?.is_blocked;
    if (isBlocked) {
      setSelectedTaskId(id);
      setStatusForm({
        status: 'COMPLETED',
        reason: 'Marking complete.',
        override_dependencies: false,
        override_reason: '',
      });
      setIsStatusModalOpen(true);
      return;
    }

    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.updateStatus(id, {
        status: 'COMPLETED',
        reason: 'Marked complete by user.',
      });
      if (selectedTaskId === id) {
        setTaskDetail(updated);
      }
      setActionSuccess('Task marked as completed.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to complete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reassign submission
  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    if (!reassignForm.new_owner_id) {
      setActionError('Please select a valid new owner.');
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.reassignOwner(selectedTaskId, {
        new_owner_id: Number(reassignForm.new_owner_id),
        reason: reassignForm.reason.trim() || undefined,
      });
      setTaskDetail(updated);
      setIsReassignModalOpen(false);
      setActionSuccess('Task successfully reassigned.');
      loadTasks();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reassign task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Due Date extension submission
  const handleExtendDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    if (!deadlineForm.new_due_date) {
      setActionError('Please select a valid new due date.');
      return;
    }
    if (!deadlineForm.reason || deadlineForm.reason.trim().length < 5) {
      setActionError('A clear audit reason (minimum 5 characters) is required.');
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.extendDeadline(selectedTaskId, {
        new_due_date: deadlineForm.new_due_date,
        reason: deadlineForm.reason.trim(),
      });
      setTaskDetail(updated);
      setIsDeadlineModalOpen(false);
      setActionSuccess('Task due date successfully updated.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to update due date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Snooze helper
  const handleQuickSnooze = (days: number) => {
    const baseDate = taskDetail?.due_date ? new Date(taskDetail.due_date) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const dateStr = baseDate.toISOString().split('T')[0];
    setDeadlineForm({
      new_due_date: dateStr,
      reason: `Snoozed by +${days} day(s) for operational scheduling.`,
    });
  };

  // Handle Cancel Task
  const handleCancelTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    if (!cancelReason.trim()) {
      setActionError('Please provide a mandatory cancellation reason.');
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.updateStatus(selectedTaskId, {
        status: 'CANCELLED',
        reason: `Cancelled: ${cancelReason.trim()}`,
      });
      setTaskDetail(updated);
      setIsCancelModalOpen(false);
      setCancelReason('');
      setActionSuccess('Task cancelled and archived.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to cancel task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reopen Task
  const handleReopenTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    if (!reopenReason.trim()) {
      setActionError('Please provide a reason for reopening this task.');
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await taskApi.reopenTask(selectedTaskId, reopenReason.trim());
      setTaskDetail(updated);
      setIsReopenModalOpen(false);
      setReopenReason('');
      setActionSuccess('Task reopened and moved to active work.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to reopen task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Task
  const handleDeleteTask = async () => {
    if (!selectedTaskId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await taskApi.deleteTask(selectedTaskId);
      setIsDeleteModalOpen(false);
      closeTaskDetail();
      setActionSuccess('Task permanently removed.');
      loadTasks();
      loadOverview();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to delete task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !commentInput.trim()) return;
    setIsPostingComment(true);
    setActionError(null);
    try {
      await taskApi.addComment(selectedTaskId, commentInput.trim());
      setCommentInput('');
      // Reload task detail to reflect new comment immediately
      const detail = await taskApi.getTaskDetail(selectedTaskId);
      setTaskDetail(detail);
      setActionSuccess('Comment posted.');
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Format category to friendly label
  const formatCategoryLabel = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'ONBOARDING':
        return 'Onboarding';
      case 'PROBATION':
        return 'Probation';
      case 'CONFIRMATION':
        return 'Confirmation';
      case 'COMPLIANCE':
      case 'DOCUMENTATION':
        return 'Documentation';
      case 'PERFORMANCE':
        return 'Performance';
      case 'OFFBOARDING':
        return 'Offboarding';
      default:
        return category || 'General';
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="brand">In Progress</Badge>;
      case 'BLOCKED':
        return <Badge variant="lavender">Blocked</Badge>;
      case 'DELAYED':
        return <Badge variant="warning">Delayed</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="neutral">Pending</Badge>;
    }
  };

  // Render Priority Badge with operational meaning
  const renderPriorityBadge = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] sm:text-[13px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] sm:text-[13px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] sm:text-[13px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  // Format Due Date with Overdue / Days Remaining calculation
  const renderDueDateCell = (task: TaskItem) => {
    if (!task.due_date) {
      return <span className="text-[13px] text-[#625A70] italic">No due date</span>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (task.status === 'COMPLETED') {
      return (
        <div>
          <span className="text-[14px] text-[#292238] font-medium">{task.due_date}</span>
          {task.completed_at && (
            <div className="text-[12px] sm:text-[13px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </div>
          )}
        </div>
      );
    }

    if (task.status === 'CANCELLED') {
      return (
        <div>
          <span className="text-[14px] text-[#625A70] line-through font-medium">{task.due_date}</span>
          <div className="text-[12px] text-slate-500 font-medium">Cancelled</div>
        </div>
      );
    }

    if (task.is_overdue || diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return (
        <div>
          <div className="text-[14px] font-bold text-rose-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Overdue
          </div>
          <div className="text-[12px] sm:text-[13px] text-rose-600 font-medium">
            {overdueDays} day{overdueDays !== 1 ? 's' : ''} past due ({task.due_date})
          </div>
        </div>
      );
    }

    if (diffDays === 0) {
      return (
        <div>
          <div className="text-[14px] font-bold text-amber-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Due Today
          </div>
          <div className="text-[12px] sm:text-[13px] text-[#625A70]">{task.due_date}</div>
        </div>
      );
    }

    if (diffDays <= 7) {
      return (
        <div>
          <span className="text-[14px] font-semibold text-amber-800">{task.due_date}</span>
          <div className="text-[12px] sm:text-[13px] text-amber-700 font-medium">in {diffDays} days</div>
        </div>
      );
    }

    return (
      <div>
        <span className="text-[14px] text-[#292238] font-medium">{task.due_date}</span>
        <div className="text-[12px] sm:text-[13px] text-[#625A70]">in {diffDays} days</div>
      </div>
    );
  };

  // Grouping tasks for My Tasks view into 5 clear sections
  const groupedMyTasks = useMemo(() => {
    if (primaryView !== 'MY_TASKS') {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue: TaskItem[] = [];
    const dueToday: TaskItem[] = [];
    const upcoming: TaskItem[] = [];
    const blocked: TaskItem[] = [];
    const noDueDate: TaskItem[] = [];

    tasks.forEach((t) => {
      if (t.status === 'BLOCKED') {
        blocked.push(t);
        return;
      }

      if (!t.due_date) {
        noDueDate.push(t);
        return;
      }

      const d = new Date(t.due_date);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (t.is_overdue || diff < 0) {
        overdue.push(t);
      } else if (diff === 0) {
        dueToday.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { overdue, dueToday, upcoming, blocked, noDueDate };
  }, [primaryView, tasks]);

  // Section Header Component for My Tasks
  const SectionHeader: React.FC<{
    title: string;
    count: number;
    sectionKey: string;
    variant: 'danger' | 'warning' | 'brand' | 'purple' | 'neutral';
    subtitle?: string;
  }> = ({ title, count, sectionKey, variant, subtitle }) => {
    const isCollapsed = collapsedSections[sectionKey];
    const badgeStyles = {
      danger: 'bg-rose-100 text-rose-800 border-rose-200',
      warning: 'bg-amber-100 text-amber-800 border-amber-200',
      brand: 'bg-[#EDE7F7] text-[#5425CB] border-[#DCD5E8]',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    }[variant];

    const containerStyles = {
      danger: 'bg-rose-50/90 hover:bg-rose-100/80 border-b border-rose-200',
      warning: 'bg-amber-50/80 hover:bg-amber-100/70 border-b border-amber-200',
      brand: 'bg-[#FBF9FD] hover:bg-[#F4EFFB] border-b border-[#E1DBEA]',
      purple: 'bg-[#F9F7FC] hover:bg-[#F2EDF9] border-b border-[#E1DBEA]',
      neutral: 'bg-slate-50/80 hover:bg-slate-100/70 border-b border-slate-200',
    }[variant];

    return (
      <div
        onClick={() => toggleSection(sectionKey)}
        className={`flex items-center justify-between p-3.5 cursor-pointer transition-colors select-none ${containerStyles}`}
      >
        <div className="flex items-center gap-2.5">
          {isCollapsed ? (
            <ChevronRight className={`w-4 h-4 ${variant === 'danger' ? 'text-rose-600' : 'text-[#625A70]'}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${variant === 'danger' ? 'text-rose-600' : 'text-[#625A70]'}`} />
          )}
          <h3 className="text-[15px] sm:text-[16px] font-bold flex items-center gap-2">
            {variant === 'danger' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className={variant === 'danger' ? 'text-rose-950 font-extrabold' : 'text-[#292238]'}>{title}</span>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
              {count}
            </span>
          </h3>
          {subtitle && (
            <span className={`text-[13px] hidden sm:inline ${variant === 'danger' ? 'text-rose-700 font-medium' : 'text-[#625A70]'}`}>
              · {subtitle}
            </span>
          )}
        </div>
        <span className={`text-[13px] font-medium ${variant === 'danger' ? 'text-rose-700 font-semibold' : 'text-[#625A70]'}`}>
          {isCollapsed ? 'Show' : 'Hide'}
        </span>
      </div>
    );
  };

  // Render a task row
  const renderTaskRow = (task: TaskItem) => (
    <tr
      key={task.id}
      className="hover:bg-[#FBF9FD] transition-colors cursor-pointer group"
      onClick={() => openTaskDetail(task.id)}
    >
      {/* Column 1: Task */}
      <td className="py-4 px-4">
        <div className="text-[15px] sm:text-[16px] font-semibold text-[#292238] group-hover:text-[#5425CB] transition-colors leading-snug">
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-[12px] font-semibold text-[#5425CB] bg-[#EDE7F7] px-2 py-0.5 rounded-md border border-[#DCD5E8]">
            {task.task_code}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium bg-slate-100 text-[#625A70]">
            {formatCategoryLabel(task.category)}
          </span>
          {task.deadline_extension_count > 0 && (
            <span className="text-[12px] text-amber-700 font-medium">
              Extended {task.deadline_extension_count}x
            </span>
          )}
        </div>
      </td>

      {/* Column 2: Employee */}
      <td className="py-4 px-4">
        <div className="text-[14px] sm:text-[15px] font-semibold text-[#292238]">
          {task.employee_name || '—'}
        </div>
        <div className="text-[13px] text-[#625A70] mt-0.5">
          {task.employee_code}
          {task.department_name ? ` • ${task.department_name}` : ''}
        </div>
      </td>

      {/* Column 3: Assigned To */}
      <td className="py-4 px-4">
        <div className="text-[14px] font-semibold text-[#292238] flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#EDE7F7] text-[#5425CB] text-[11px] flex items-center justify-center font-bold">
            {task.owner_name ? task.owner_name.charAt(0) : 'U'}
          </div>
          <span>{task.owner_name || 'Unassigned'}</span>
        </div>
      </td>

      {/* Column 4: Priority */}
      <td className="py-4 px-4">{renderPriorityBadge(task.priority)}</td>

      {/* Column 5: Status */}
      <td className="py-4 px-4">{renderStatusBadge(task.status)}</td>

      {/* Column 6: Due Date */}
      <td className="py-4 px-4">{renderDueDateCell(task)}</td>

      {/* Column 7: Actions */}
      <td className="py-4.5 px-5 text-right whitespace-nowrap min-w-[240px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2 shrink-0">
          {task.status === 'PENDING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStartTask(task.id)}
              leftIcon={<Clock className="w-4 h-4 text-[#5425CB] shrink-0" />}
              className="text-[#5425CB] bg-[#EDE7FF] hover:bg-[#DCD0FF] border-[#DCD0FF] text-[14px] font-bold h-9 px-3.5 min-w-[84px] shrink-0"
              title="Start Task (In Progress)"
            >
              Start
            </Button>
          )}
          {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickMarkComplete(task.id, task)}
              leftIcon={<CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />}
              className="text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-[14px] font-bold h-9 px-3.5 min-w-[88px] shrink-0 shadow-2xs"
              title="Mark as Done"
            >
              Done
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTaskDetail(task.id)}
            className="text-[14px] font-bold h-9 px-3.5 min-w-[108px] shrink-0 text-[#1E162B] bg-white border border-[#DCD5E8] hover:border-[#5425CB] hover:bg-[#FAF8FE]"
          >
            View Details
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-extrabold tracking-tight text-[#1E162B]">
            Task Management
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5C5270] mt-1 font-medium">Your HR work, organised in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdminOrHR && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-2 min-w-[130px] h-10 px-5 shadow-sm bg-[#5425CB] hover:bg-[#431DA7] text-white text-[14px] sm:text-[15px] font-semibold rounded-xl"
            >
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Global Feedback Alerts */}
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

      {/* 2. Primary Navigation Views & Workload Context */}
      <div className="bg-white rounded-xl border border-[#E2DBEB] shadow-[0_2px_12px_rgba(49,35,75,0.06)] p-4 space-y-4">
        {/* Row 1: Primary View Tabs & Workload Counters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-[#F0EBF8] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePrimaryViewChange('MY_TASKS')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-2 ${
                primaryView === 'MY_TASKS'
                  ? 'bg-[#5425CB] text-white shadow-sm'
                  : 'bg-[#FBF9FD] text-[#625A70] hover:bg-[#EDE7F7] hover:text-[#5425CB]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Tasks</span>
            </button>

            <button
              onClick={() => handlePrimaryViewChange('TEAM_TASKS')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-2 ${
                primaryView === 'TEAM_TASKS'
                  ? 'bg-[#5425CB] text-white shadow-sm'
                  : 'bg-[#FBF9FD] text-[#625A70] hover:bg-[#EDE7F7] hover:text-[#5425CB]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Tasks</span>
            </button>

            <button
              onClick={() => handlePrimaryViewChange('ALL_TASKS')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-2 ${
                primaryView === 'ALL_TASKS'
                  ? 'bg-[#5425CB] text-white shadow-sm'
                  : 'bg-[#FBF9FD] text-[#625A70] hover:bg-[#EDE7F7] hover:text-[#5425CB]'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>All Tasks</span>
            </button>

            <button
              onClick={() => handlePrimaryViewChange('COMPLETED')}
              className={`px-4 py-2 rounded-xl text-[14px] font-semibold transition-all flex items-center gap-2 ${
                primaryView === 'COMPLETED'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-[#FBF9FD] text-[#625A70] hover:bg-slate-100 hover:text-[#292238]'
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              <span>Completed / History</span>
            </button>
          </div>

          {/* Operational Metrics Badges Strip (Clean, Uncluttered) */}
          <div className="flex flex-wrap items-center gap-3 text-[13px] font-medium text-[#625A70]">
            <span className="flex items-center gap-1.5 bg-[#FBF9FD] px-2.5 py-1 rounded-lg border border-[#E1DBEA]">
              <span className="w-2 h-2 rounded-full bg-[#5425CB]" />
              Active: <strong className="text-[#292238] font-bold">{metrics?.active_tasks ?? '—'}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              Overdue: <strong className="font-bold">{metrics?.overdue_tasks ?? '—'}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-800">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              Blocked: <strong className="font-bold">{metrics?.blocked_tasks ?? '—'}</strong>
            </span>
            <span className="text-[12px] sm:text-[13px] text-[#625A70] ml-1">
              Showing <strong className="text-[#292238] font-semibold">{tasks.length}</strong> of{' '}
              <strong className="text-[#292238] font-semibold">{totalCount}</strong>
            </span>
          </div>
        </div>

        {/* Row 2: Search & Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
          {/* Search Field */}
          <div className="lg:col-span-2">
            <Input
              placeholder="Search tasks or employees..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-[#625A70]" />}
              className="w-full text-[14px]"
            />
          </div>

          {/* HR Process Filter */}
          <div>
            <Select
              options={[
                { value: '', label: 'All HR Processes' },
                { value: 'ONBOARDING', label: 'Onboarding' },
                { value: 'PROBATION', label: 'Probation' },
                { value: 'CONFIRMATION', label: 'Confirmation' },
                { value: 'COMPLIANCE', label: 'Documentation' },
                { value: 'PERFORMANCE', label: 'Performance' },
                { value: 'OFFBOARDING', label: 'Offboarding' },
              ]}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Priority Filter */}
          <div>
            <Select
              options={[
                { value: '', label: 'All Priorities' },
                { value: 'HIGH', label: 'High Priority' },
                { value: 'MEDIUM', label: 'Medium Priority' },
                { value: 'LOW', label: 'Low Priority' },
              ]}
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Due Window Filter / Clear Button */}
          <div className="flex items-center gap-2">
            {primaryView !== 'MY_TASKS' ? (
              <Select
                options={[
                  { value: '', label: 'All Due Dates' },
                  { value: 'TODAY', label: 'Due Today' },
                  { value: 'NEXT_7_DAYS', label: 'Due in 7 Days' },
                  { value: 'OVERDUE', label: 'Overdue' },
                ]}
                value={dueWindowFilter}
                onChange={(e) => {
                  setDueWindowFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            ) : (
              (search || categoryFilter || priorityFilter || statusFilter) && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleResetFilters}
                  className="w-full text-[14px] font-semibold text-[#625A70] hover:text-[#5425CB]"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Clear Filters
                </Button>
              )
            )}
            {primaryView !== 'MY_TASKS' &&
              (search || categoryFilter || priorityFilter || statusFilter || dueWindowFilter) && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleResetFilters}
                  className="text-[14px] font-semibold text-[#625A70] hover:text-[#5425CB] px-3"
                  title="Clear Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* 3. Task Content Area */}
      <div className="bg-white rounded-xl border border-[#E1DBEA] shadow-[0_2px_12px_rgba(49,35,75,0.06)] overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[#625A70]">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#5425CB]" />
            <p className="text-[15px] font-medium">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-700">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
            <p className="font-semibold text-[15px]">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={loadTasks}>
              Try Again
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center text-[#625A70]">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-lg font-bold text-[#292238]">No active tasks found</h3>
            <p className="text-[14px] text-[#625A70] mt-1.5 max-w-sm mx-auto leading-relaxed">
              You're all caught up, or try changing your filters to see more tasks.
            </p>
            {(search || categoryFilter || priorityFilter || statusFilter || dueWindowFilter) && (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4">
                Reset Filters
              </Button>
            )}
          </div>
        ) : primaryView === 'MY_TASKS' && groupedMyTasks ? (
          /* =========================================================================
             A. MY TASKS: 5 COLLAPSIBLE DUE-DATE SECTIONS
             ========================================================================= */
          <div className="divide-y divide-[#E1DBEA]">
            {/* Section 1: Overdue */}
            <div className="border-b border-[#E1DBEA]">
              <SectionHeader
                title="Overdue Tasks"
                count={groupedMyTasks.overdue.length}
                sectionKey="overdue"
                variant="danger"
                subtitle="Immediate action required"
              />
              {!collapsedSections.overdue && (
                <div className="overflow-x-auto">
                  {groupedMyTasks.overdue.length === 0 ? (
                    <div className="p-6 text-center text-[14px] text-[#625A70]">
                      No overdue tasks. All caught up!
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-[#F0EBF8] text-[14px]">
                        {groupedMyTasks.overdue.map(renderTaskRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Due Today */}
            <div className="border-b border-[#E1DBEA]">
              <SectionHeader
                title="Due Today"
                count={groupedMyTasks.dueToday.length}
                sectionKey="due_today"
                variant="warning"
                subtitle="Complete before end of business"
              />
              {!collapsedSections.due_today && (
                <div className="overflow-x-auto">
                  {groupedMyTasks.dueToday.length === 0 ? (
                    <div className="p-6 text-center text-[14px] text-[#625A70]">
                      No tasks due today.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-[#F0EBF8] text-[14px]">
                        {groupedMyTasks.dueToday.map(renderTaskRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Upcoming */}
            <div className="border-b border-[#E1DBEA]">
              <SectionHeader
                title="Upcoming"
                count={groupedMyTasks.upcoming.length}
                sectionKey="upcoming"
                variant="brand"
                subtitle="Scheduled for future dates"
              />
              {!collapsedSections.upcoming && (
                <div className="overflow-x-auto">
                  {groupedMyTasks.upcoming.length === 0 ? (
                    <div className="p-6 text-center text-[14px] text-[#625A70]">
                      No upcoming tasks scheduled.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-[#F0EBF8] text-[14px]">
                        {groupedMyTasks.upcoming.map(renderTaskRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Waiting on Others / Blocked */}
            <div className="border-b border-[#E1DBEA]">
              <SectionHeader
                title="Waiting on Others / Blocked"
                count={groupedMyTasks.blocked.length}
                sectionKey="blocked"
                variant="purple"
                subtitle="Waiting for prerequisite tasks"
              />
              {!collapsedSections.blocked && (
                <div className="overflow-x-auto">
                  {groupedMyTasks.blocked.length === 0 ? (
                    <div className="p-6 text-center text-[14px] text-[#625A70]">
                      No tasks currently blocked by dependencies.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-[#F0EBF8] text-[14px]">
                        {groupedMyTasks.blocked.map(renderTaskRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Section 5: No Due Date */}
            <div>
              <SectionHeader
                title="No Due Date"
                count={groupedMyTasks.noDueDate.length}
                sectionKey="no_due_date"
                variant="neutral"
                subtitle="Routine activities without strict deadlines"
              />
              {!collapsedSections.no_due_date && (
                <div className="overflow-x-auto">
                  {groupedMyTasks.noDueDate.length === 0 ? (
                    <div className="p-6 text-center text-[14px] text-[#625A70]">
                      No unscheduled tasks.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-[#F0EBF8] text-[14px]">
                        {groupedMyTasks.noDueDate.map(renderTaskRow)}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================================
             B. TEAM TASKS / ALL TASKS / COMPLETED: STANDARD TABLE VIEW
             ========================================================================= */
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DBEB] bg-[#F7F5FB] text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-[#5C5270] h-14">
                    <th className="py-4.5 px-5 w-[30%]">Task</th>
                    <th className="py-4.5 px-5 w-[18%]">Employee</th>
                    <th className="py-4.5 px-5 w-[16%]">Assigned To</th>
                    <th className="py-4.5 px-5 w-[10%]">Priority</th>
                    <th className="py-4.5 px-5 w-[11%]">Status</th>
                    <th className="py-4.5 px-5 w-[11%]">Due Date</th>
                    <th className="py-4.5 px-5 text-right min-w-[240px] whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBF8] text-[15px] sm:text-[16px]">
                  {tasks.map(renderTaskRow)}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-[#E1DBEA]">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-[#FBF9FD] transition-colors space-y-2.5"
                  onClick={() => openTaskDetail(task.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium bg-[#EDE7F7] text-[#5425CB]">
                      {formatCategoryLabel(task.category)}
                    </span>
                    {renderStatusBadge(task.status)}
                  </div>

                  <h4 className="font-semibold text-[15px] text-[#292238] leading-snug">{task.title}</h4>

                  <div className="text-[13px] text-[#625A70] flex items-center justify-between">
                    <span>
                      For: <strong className="text-[#292238] font-semibold">{task.employee_name}</strong>
                    </span>
                    <span>{renderPriorityBadge(task.priority)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#F0EBF8] text-[13px]">
                    <div>{renderDueDateCell(task)}</div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTaskDetail(task.id);
                      }}
                      className="text-[13px] font-semibold"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="p-4 border-t border-[#E1DBEA] flex items-center justify-between">
                <span className="text-[14px] text-[#625A70]">
                  Page <strong className="text-[#292238] font-semibold">{currentPage}</strong> of{' '}
                  <strong className="text-[#292238] font-semibold">{totalPages}</strong>
                </span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Task Details Right Drawer (Desktop) / Slide-over (Mobile) */}
      {selectedTaskId && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={closeTaskDetail}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen sm:max-w-2xl bg-white shadow-2xl flex flex-col border-l border-[#E1DBEA]">
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#E1DBEA] bg-[#FBF9FD] flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-[#5425CB] bg-[#EDE7F7] px-2.5 py-0.5 rounded-md border border-[#DCD5E8]">
                      {taskDetail?.task_code || 'TSK'}
                    </span>
                    {taskDetail && renderStatusBadge(taskDetail.status)}
                    {taskDetail && renderPriorityBadge(taskDetail.priority)}
                  </div>
                  <h3 className="text-xl sm:text-[22px] font-bold text-[#292238] leading-snug">
                    {taskDetail?.title || 'Loading task...'}
                  </h3>
                  {taskDetail && (
                    <p className="text-[14px] text-[#625A70]">
                      Associated with{' '}
                      <strong className="text-[#292238] font-semibold">{taskDetail.employee_name}</strong> (
                      {taskDetail.employee_code})
                    </p>
                  )}
                </div>
                <button
                  onClick={closeTaskDetail}
                  className="p-1.5 rounded-lg text-[#625A70] hover:text-[#292238] hover:bg-[#EDE7F7] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Navigation Tabs - Resets to Details on Every Task Open */}
              <div className="px-6 border-b border-[#E1DBEA] flex items-center gap-6 bg-white">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-3 text-[14px] font-bold transition-colors border-b-2 ${
                    activeTab === 'details'
                      ? 'border-[#5425CB] text-[#5425CB]'
                      : 'border-transparent text-[#625A70] hover:text-[#292238]'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('dependencies')}
                  className={`py-3 text-[14px] font-bold transition-colors border-b-2 ${
                    activeTab === 'dependencies'
                      ? 'border-[#5425CB] text-[#5425CB]'
                      : 'border-transparent text-[#625A70] hover:text-[#292238]'
                  }`}
                >
                  Dependencies (
                  {(taskDetail?.prerequisites?.length || 0) + (taskDetail?.successors?.length || 0)})
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-3 text-[14px] font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'comments'
                      ? 'border-[#5425CB] text-[#5425CB]'
                      : 'border-transparent text-[#625A70] hover:text-[#292238]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Comments & Activity ({(taskDetail?.comments?.length || 0) + (taskDetail?.status_history?.length || 0)})
                </button>
                <button
                  onClick={() => setActiveTab('ml')}
                  className={`py-3 text-[14px] font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'ml'
                      ? 'border-[#5425CB] text-[#5425CB]'
                      : 'border-transparent text-[#625A70] hover:text-[#292238]'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Delay Insights
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {drawerLoading ? (
                  <div className="py-20 text-center text-[#625A70]">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#5425CB]" />
                    <p className="text-[15px] font-medium">Loading task details...</p>
                  </div>
                ) : taskDetail ? (
                  <>
                    {/* Contextual Warning Alerts */}
                    {taskDetail.is_overdue && taskDetail.status !== 'COMPLETED' && taskDetail.status !== 'CANCELLED' && (
                      <Alert variant="error">
                        <strong>Overdue Task:</strong> This task passed its scheduled due date ({taskDetail.due_date}).
                        Please complete, reassign, or reschedule with an audit reason.
                      </Alert>
                    )}

                    {taskDetail.is_blocked && (
                      <Alert variant="warning">
                        <strong>Waiting on Others:</strong> This task cannot be finalized until prerequisite task(s)
                        are completed:{' '}
                        {taskDetail.blocking_prerequisites.map((b) => `${b.title} (${b.task_code})`).join(', ')}.
                      </Alert>
                    )}

                    {/* Tab 1: Details */}
                    {activeTab === 'details' && (
                      <div className="space-y-4">
                        {/* Description */}
                        {taskDetail.description && (
                          <div className="bg-[#FBF9FD] p-4 rounded-xl border border-[#E1DBEA] text-[14px] sm:text-[15px] text-[#292238] leading-relaxed">
                            <span className="font-semibold block text-[#625A70] mb-1.5 text-[13px] uppercase tracking-wider">
                              Description & Instructions:
                            </span>
                            {taskDetail.description}
                          </div>
                        )}

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-3 text-[14px]">
                          <div className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white">
                            <span className="text-[#625A70] block font-medium text-[13px]">Associated Employee</span>
                            <span className="font-bold text-[#292238] block mt-1 text-[15px]">
                              {taskDetail.employee_name}
                            </span>
                            <span className="text-[13px] text-[#625A70]">
                              {taskDetail.employee_code} • {taskDetail.department_name || 'Organization'}
                            </span>
                          </div>

                          <div className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white">
                            <span className="text-[#625A70] block font-medium text-[13px]">Assigned Owner</span>
                            <span className="font-bold text-[#292238] block mt-1 text-[15px]">
                              {taskDetail.owner_name || 'Unassigned'}
                            </span>
                            <span className="text-[13px] text-[#625A70]">Responsible Assignee</span>
                          </div>

                          <div className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white">
                            <span className="text-[#625A70] block font-medium text-[13px]">HR Lifecycle Stage</span>
                            <span className="font-bold text-[#292238] block mt-1 text-[15px]">
                              {formatCategoryLabel(taskDetail.category)}
                            </span>
                            {taskDetail.template_name && (
                              <span className="text-[13px] text-[#625A70] block truncate">
                                Preset: {taskDetail.template_name}
                              </span>
                            )}
                          </div>

                          <div className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white">
                            <span className="text-[#625A70] block font-medium text-[13px]">Due Date</span>
                            <span
                              className={`font-bold block mt-1 text-[15px] ${
                                taskDetail.is_overdue ? 'text-rose-700' : 'text-[#292238]'
                              }`}
                            >
                              {taskDetail.due_date || 'None'}
                            </span>
                            {taskDetail.deadline_extension_count > 0 && (
                              <span className="text-[13px] text-amber-700 font-semibold block">
                                Rescheduled {taskDetail.deadline_extension_count} time(s)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dates & Timeline */}
                        <div className="border border-[#E1DBEA] rounded-xl p-4 bg-white text-[14px] space-y-2">
                          <div className="flex justify-between text-[#625A70]">
                            <span>Task Created:</span>
                            <span className="font-semibold text-[#292238]">
                              {taskDetail.created_at ? taskDetail.created_at.split('T')[0] : '—'}
                            </span>
                          </div>
                          {taskDetail.completed_at && (
                            <div className="flex justify-between text-[#625A70]">
                              <span>Completed At:</span>
                              <span className="font-semibold text-emerald-700">
                                {taskDetail.completed_at.replace('T', ' ').substring(0, 16)}
                              </span>
                            </div>
                          )}
                          {taskDetail.last_deadline_change_reason && (
                            <div className="flex justify-between text-[#625A70]">
                              <span>Last Reschedule Reason:</span>
                              <span className="font-semibold text-[#292238] max-w-xs text-right">
                                {taskDetail.last_deadline_change_reason}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Dependencies */}
                    {activeTab === 'dependencies' && (
                      <div className="space-y-5 text-[14px]">
                        <div className="space-y-2.5">
                          <h4 className="font-bold text-[#625A70] uppercase tracking-wider text-[12px] sm:text-[13px]">
                            Must Be Completed First (Prerequisites)
                          </h4>
                          {taskDetail.prerequisites.length === 0 ? (
                            <p className="text-[#625A70] bg-[#FBF9FD] p-3.5 rounded-xl border border-[#E1DBEA]">
                              No prerequisite tasks configured.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {taskDetail.prerequisites.map((dep) => (
                                <div
                                  key={dep.id}
                                  className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-[#292238] text-[15px]">
                                      {dep.prerequisite_title} ({dep.prerequisite_task_code})
                                    </div>
                                    <div className="text-[13px] text-[#625A70] mt-0.5">
                                      Owner: {dep.prerequisite_owner_name || 'Unassigned'} • Due:{' '}
                                      {dep.prerequisite_due_date || '—'}
                                    </div>
                                  </div>
                                  <div>{renderStatusBadge(dep.prerequisite_status || 'PENDING')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2.5 pt-2">
                          <h4 className="font-bold text-[#625A70] uppercase tracking-wider text-[12px] sm:text-[13px]">
                            Waiting For This Task (Downstream Work)
                          </h4>
                          {taskDetail.successors.length === 0 ? (
                            <p className="text-[#625A70] bg-[#FBF9FD] p-3.5 rounded-xl border border-[#E1DBEA]">
                              No other tasks depend on this task.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {taskDetail.successors.map((succ) => (
                                <div
                                  key={succ.id}
                                  className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-[#292238] text-[15px]">
                                      {succ.dependent_title} ({succ.dependent_task_code})
                                    </div>
                                  </div>
                                  <div>{renderStatusBadge(succ.dependent_status || 'PENDING')}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Comments & Activity */}
                    {activeTab === 'comments' && (
                      <div className="space-y-5 text-[14px]">
                        {/* Add Comment Input Form */}
                        <form onSubmit={handleAddComment} className="p-4 rounded-xl bg-[#FBF9FD] border border-[#E1DBEA] space-y-2.5">
                          <label className="block text-[13px] font-bold text-[#292238]">
                            Add Note or Comment
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Type a comment or operational update regarding this task..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            className="w-full text-[14px] p-3 rounded-lg border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
                          />
                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              size="sm"
                              type="submit"
                              disabled={!commentInput.trim() || isPostingComment}
                              leftIcon={<Send className="w-3.5 h-3.5" />}
                              className="bg-[#5425CB] text-white font-semibold text-[13px]"
                            >
                              {isPostingComment ? 'Posting...' : 'Post Comment'}
                            </Button>
                          </div>
                        </form>

                        {/* Chronological Activity & Comments Timeline */}
                        <div className="space-y-3.5">
                          <h4 className="font-bold text-[#625A70] uppercase tracking-wider text-[12px] sm:text-[13px]">
                            Activity & Comment History
                          </h4>

                          {/* Render Comments */}
                          {taskDetail.comments && taskDetail.comments.length > 0 && (
                            <div className="space-y-2.5">
                              {taskDetail.comments.map((comm) => (
                                <div
                                  key={comm.id}
                                  className="p-3.5 rounded-xl border border-[#DCD5E8] bg-[#FBF9FD] space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-[13px]">
                                    <span className="font-bold text-[#5425CB] flex items-center gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {comm.author_name}
                                    </span>
                                    <span className="text-[#625A70]">
                                      {comm.created_at ? comm.created_at.replace('T', ' ').substring(0, 16) : ''}
                                    </span>
                                  </div>
                                  <p className="text-[14px] text-[#292238] whitespace-pre-wrap">{comm.comment}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Render Status History */}
                          {taskDetail.status_history && taskDetail.status_history.length > 0 ? (
                            <div className="space-y-2.5">
                              {taskDetail.status_history.map((hist) => (
                                <div
                                  key={hist.id}
                                  className="p-3.5 rounded-xl border border-[#E1DBEA] bg-white space-y-1"
                                >
                                  <div className="flex items-center justify-between text-[13px]">
                                    <span className="font-semibold text-[#292238]">
                                      {hist.changed_by_name || 'System / Coordinator'}
                                    </span>
                                    <span className="text-[#625A70]">
                                      {hist.changed_at ? hist.changed_at.replace('T', ' ').substring(0, 16) : '—'}
                                    </span>
                                  </div>
                                  <div className="text-[13px] text-[#625A70]">
                                    Changed status from <span className="font-semibold text-[#292238]">{hist.old_status}</span> to{' '}
                                    <span className="font-semibold text-[#5425CB]">{hist.new_status}</span>
                                  </div>
                                  {hist.change_reason && (
                                    <div className="text-[13px] text-[#292238] bg-[#FBF9FD] p-2 rounded border border-[#F0EBF8]">
                                      "{hist.change_reason}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            (!taskDetail.comments || taskDetail.comments.length === 0) && (
                              <p className="text-[14px] text-[#625A70] bg-[#FBF9FD] p-4 rounded-xl border border-[#E1DBEA] text-center">
                                No activity or comments recorded yet.
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 4: Delay Insights */}
                    {activeTab === 'ml' && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-[14px] text-amber-900 leading-relaxed">
                          <strong>Advisory Notice:</strong> Experimental estimate based on available task
                          information. Intended for HR planning only and not a confirmed delay.
                        </div>

                        {taskDetail.shadow_prediction ? (
                          <div className="p-5 rounded-xl border border-[#E1DBEA] bg-white space-y-3.5 text-[14px]">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#292238] text-[16px]">
                                Delay Likelihood Assessment
                              </span>
                              <Badge
                                variant={
                                  taskDetail.shadow_prediction.risk_level === 'HIGH'
                                    ? 'warning'
                                    : taskDetail.shadow_prediction.risk_level === 'MEDIUM'
                                    ? 'brand'
                                    : 'neutral'
                                }
                              >
                                {taskDetail.shadow_prediction.risk_level} RISK
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between font-semibold text-[#292238]">
                                <span>Predicted Delay Probability:</span>
                                <span>
                                  {Math.round(taskDetail.shadow_prediction.delay_probability * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    taskDetail.shadow_prediction.risk_level === 'HIGH'
                                      ? 'bg-rose-500'
                                      : taskDetail.shadow_prediction.risk_level === 'MEDIUM'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{
                                    width: `${Math.round(
                                      taskDetail.shadow_prediction.delay_probability * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {taskDetail.shadow_prediction.contributing_factors &&
                              taskDetail.shadow_prediction.contributing_factors.length > 0 && (
                                <div className="pt-2.5 border-t border-[#F0EBF8]">
                                  <span className="font-semibold block text-[#292238] mb-1.5 text-[14px]">
                                    Contributing Factors:
                                  </span>
                                  <ul className="space-y-1.5">
                                    {taskDetail.shadow_prediction.contributing_factors.map((f, i) => (
                                      <li key={i} className="text-[13px] text-[#625A70] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#5425CB]" />
                                        <span>
                                          <strong className="text-[#292238]">{f.factor}:</strong> {f.effect}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-[#FBF9FD] rounded-xl border border-[#E1DBEA] text-[14px] text-[#625A70]">
                            <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-[#292238]">No delay prediction available</p>
                            <p className="text-[13px] text-[#625A70] mt-1">
                              Task parameters are within standard baseline thresholds.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Drawer Footer Actions */}
              {taskDetail && (
                <div className="p-5 border-t border-[#E1DBEA] bg-[#FBF9FD] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {taskDetail.status !== 'COMPLETED' && taskDetail.status !== 'CANCELLED' ? (
                      <>
                        {taskDetail.status === 'PENDING' && (
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => handleStartTask()}
                            className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
                          >
                            Start Task
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => handleQuickMarkComplete()}
                          leftIcon={<CheckCircle2 className="w-4.5 h-4.5 shrink-0" />}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5"
                        >
                          Mark Done
                        </Button>

                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => openEditModal()}
                          className="font-semibold"
                        >
                          Edit Details
                        </Button>

                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => {
                            setDeadlineForm({ new_due_date: taskDetail.due_date || '', reason: '' });
                            setIsDeadlineModalOpen(true);
                          }}
                          className="font-semibold"
                        >
                          <Clock className="w-4 h-4 mr-1.5 text-[#5425CB]" />
                          Edit Due Date / Reschedule
                        </Button>

                        {isAdminOrHR && (
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={() => {
                              setReassignForm({ new_owner_id: taskDetail.owner_id, reason: '' });
                              setIsReassignModalOpen(true);
                            }}
                            className="font-semibold"
                          >
                            <User className="w-4 h-4 mr-1.5 text-[#5425CB]" />
                            Reassign
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => {
                            setStatusForm({
                              status: taskDetail.status,
                              reason: '',
                              override_dependencies: false,
                              override_reason: '',
                            });
                            setIsStatusModalOpen(true);
                          }}
                          className="font-semibold"
                        >
                          Update Status
                        </Button>

                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setCancelReason('');
                            setIsCancelModalOpen(true);
                          }}
                          className="text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold"
                        >
                          <Ban className="w-4 h-4 mr-1.5" />
                          Cancel
                        </Button>

                        {/* Eligible for deletion if manual (no template_id) */}
                        {!taskDetail.template_id && (
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
                            title="Delete manual task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      /* Completed or Cancelled Tasks: Reopen option */
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => {
                          setReopenReason('');
                          setIsReopenModalOpen(true);
                        }}
                        className="bg-[#5425CB] text-white font-semibold"
                      >
                        <CornerUpLeft className="w-4 h-4 mr-1.5" />
                        Reopen Task
                      </Button>
                    )}
                  </div>

                  <Button variant="outline" size="md" onClick={closeTaskDetail} className="font-semibold">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Simplified "Add Task" Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Add Task"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateTask} className="space-y-4.5">
            {/* Task Template Preset Picker */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Use Standard Task Template <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select standard template (or create custom task)' },
                  ...templates.map((t) => ({
                    value: String(t.id),
                    label: `[${formatCategoryLabel(t.category)}] ${t.name}`,
                  })),
                ]}
                value={createForm.template_id}
                onChange={(e) => handleTemplateChange(e.target.value)}
              />
            </div>

            {/* Task Title (Mandatory) */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                placeholder="e.g. Conduct Day-1 Buddy Introduction"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                required
              />
            </div>

            {/* Employee (Mandatory) */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Associated Employee <span className="text-rose-600">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select employee...' },
                  ...employees.map((emp) => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name} (${emp.employee_code})`,
                  })),
                ]}
                value={createForm.employee_id}
                onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* HR Process (Mandatory) */}
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process <span className="text-rose-600">*</span>
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  required
                />
              </div>

              {/* Priority with clear guidelines */}
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">Priority</label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High (Urgent / Blocks payroll or compliance)' },
                    { value: 'MEDIUM', label: 'Medium (Standard operational activity)' },
                    { value: 'LOW', label: 'Low (Routine non-blocking task)' },
                  ]}
                  value={createForm.priority}
                  onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Assigned To (Owner) */}
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">Assigned To</label>
                <Select
                  options={[
                    { value: '', label: `Assign to me (${user?.full_name || 'Current User'})` },
                    ...usersList.map((u) => ({
                      value: String(u.id),
                      label: `${u.full_name} (${u.role?.role_name || 'Staff'})`,
                    })),
                  ]}
                  value={createForm.owner_id}
                  onChange={(e) => setCreateForm({ ...createForm, owner_id: e.target.value })}
                />
              </div>

              {/* Due Date (Mandatory) */}
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Due Date <span className="text-rose-600">*</span>
                </label>
                <Input
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Provide helpful context or checklist notes for this task..."
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            {/* Optional Prerequisite Task */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Must be completed after task <span className="font-normal text-[#625A70]">(Optional Prerequisite)</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'None (Can start immediately)' },
                  ...tasks
                    .filter((t) => t.status !== 'COMPLETED')
                    .map((t) => ({
                      value: String(t.id),
                      label: `${t.task_code}: ${t.title} (${t.employee_name})`,
                    })),
                ]}
                value={createForm.prerequisite_task_id}
                onChange={(e) => setCreateForm({ ...createForm, prerequisite_task_id: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#E1DBEA]">
              <Button variant="outline" size="md" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                className="bg-[#5425CB] text-white"
              >
                {isSubmitting ? 'Creating Task...' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Update Status Modal */}
      {isStatusModalOpen && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title="Update Task Status"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateStatus} className="space-y-4.5">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">Target Status</label>
              <Select
                options={[
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'BLOCKED', label: 'Blocked' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Status Change Note <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                placeholder="Reason or operational status note..."
                value={statusForm.reason}
                onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
              />
            </div>

            {/* Dependency Override for Admins/HR */}
            {taskDetail?.is_blocked && statusForm.status === 'COMPLETED' && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
                <span className="font-bold text-rose-800 text-[14px] block">
                  Mandatory Prerequisite Task(s) Incomplete
                </span>
                <p className="text-[13px] text-rose-700 leading-relaxed">
                  Prerequisites are still open. Authorized administrators may execute an override with justification.
                </p>
                {isSuperAdminOrHRManager && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-[14px] text-rose-900">
                      <input
                        type="checkbox"
                        checked={statusForm.override_dependencies}
                        onChange={(e) =>
                          setStatusForm({ ...statusForm, override_dependencies: e.target.checked })
                        }
                        className="rounded text-[#5425CB] w-4 h-4"
                      />
                      <span>Authorize Dependency Override</span>
                    </label>
                    {statusForm.override_dependencies && (
                      <Input
                        placeholder="Mandatory override reason for audit log..."
                        value={statusForm.override_reason}
                        onChange={(e) =>
                          setStatusForm({ ...statusForm, override_reason: e.target.value })
                        }
                        required
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#E1DBEA]">
              <Button
                variant="outline"
                size="md"
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                className="bg-[#5425CB] text-white"
              >
                {isSubmitting ? 'Saving...' : 'Update Status'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Reassign Owner Modal */}
      {isReassignModalOpen && (
        <Modal
          isOpen={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          title="Reassign Task"
          maxWidth="md"
        >
          <form onSubmit={handleReassign} className="space-y-4.5">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">New Task Owner</label>
              <Select
                options={[
                  { value: '0', label: 'Select new owner...' },
                  ...usersList.map((u) => ({
                    value: String(u.id),
                    label: `${u.full_name} (${u.role?.role_name || 'Staff'})`,
                  })),
                ]}
                value={String(reassignForm.new_owner_id)}
                onChange={(e) => setReassignForm({ ...reassignForm, new_owner_id: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Reassignment Reason <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                placeholder="e.g. Workload rebalancing or role transfer..."
                value={reassignForm.reason}
                onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#E1DBEA]">
              <Button
                variant="outline"
                size="md"
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                className="bg-[#5425CB] text-white"
              >
                {isSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. Reschedule / Snooze Modal */}
      {isDeadlineModalOpen && (
        <Modal
          isOpen={isDeadlineModalOpen}
          onClose={() => setIsDeadlineModalOpen(false)}
          title="Edit Due Date / Reschedule"
          maxWidth="md"
        >
          <form onSubmit={handleExtendDeadline} className="space-y-4.5">
            {/* Quick Snooze Shortcuts */}
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Quick Snooze Options
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSnooze(1)}
                  className="text-[13px] font-semibold text-[#5425CB] border-[#DCD5E8]"
                >
                  +1 Day
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSnooze(3)}
                  className="text-[13px] font-semibold text-[#5425CB] border-[#DCD5E8]"
                >
                  +3 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSnooze(7)}
                  className="text-[13px] font-semibold text-[#5425CB] border-[#DCD5E8]"
                >
                  +1 Week
                </Button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">New Due Date</label>
              <Input
                type="date"
                value={deadlineForm.new_due_date}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, new_due_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Reason for Rescheduling <span className="text-rose-600">*</span>
              </label>
              <Input
                placeholder="Audit explanation (minimum 5 characters)..."
                value={deadlineForm.reason}
                onChange={(e) => setDeadlineForm({ ...deadlineForm, reason: e.target.value })}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#E1DBEA]">
              <Button
                variant="outline"
                size="md"
                type="button"
                onClick={() => setIsDeadlineModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting}
                className="bg-[#5425CB] text-white"
              >
                {isSubmitting ? 'Updating...' : 'Update Due Date'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 9. Cancel Task Modal */}
      {isCancelModalOpen && (
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title="Cancel Task"
          maxWidth="md"
        >
          <form onSubmit={handleCancelTask} className="space-y-4">
            <p className="text-[14px] text-[#625A70]">
              Cancelling this task will archive it and remove it from pending queues. A clear operational
              reason is mandatory for audit logging.
            </p>
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Cancellation Reason <span className="text-rose-600">*</span>
              </label>
              <Input
                placeholder="e.g. Employee requested start-date change; superseded by new flow..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1DBEA]">
              <Button variant="outline" size="md" type="button" onClick={() => setIsCancelModalOpen(false)}>
                Go Back
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting || !cancelReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. Reopen Task Modal */}
      {isReopenModalOpen && (
        <Modal
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          title="Reopen Task"
          maxWidth="md"
        >
          <form onSubmit={handleReopenTask} className="space-y-4">
            <p className="text-[14px] text-[#625A70]">
              Reopening will move this task back to In Progress and re-activate it in the assigned owner's queue.
            </p>
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Reason for Reopening <span className="text-rose-600">*</span>
              </label>
              <Input
                placeholder="e.g. Incomplete verification found on audit review..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1DBEA]">
              <Button variant="outline" size="md" type="button" onClick={() => setIsReopenModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={isSubmitting || !reopenReason.trim()}
                className="bg-[#5425CB] text-white font-semibold"
              >
                {isSubmitting ? 'Reopening...' : 'Confirm Reopen'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Task Details"
          maxWidth="lg"
        >
          <form onSubmit={handleEditTask} className="space-y-4">
            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Task Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  HR Process
                </label>
                <Select
                  options={[
                    { value: 'ONBOARDING', label: 'Onboarding' },
                    { value: 'PROBATION', label: 'Probation' },
                    { value: 'CONFIRMATION', label: 'Confirmation' },
                    { value: 'COMPLIANCE', label: 'Documentation' },
                    { value: 'PERFORMANCE', label: 'Performance' },
                    { value: 'OFFBOARDING', label: 'Offboarding' },
                  ]}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                  Priority
                </label>
                <Select
                  options={[
                    { value: 'HIGH', label: 'High Priority' },
                    { value: 'MEDIUM', label: 'Medium Priority' },
                    { value: 'LOW', label: 'Low Priority' },
                  ]}
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Start Date <span className="font-normal text-[#625A70]">(Optional)</span>
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-[14px] text-[#292238] mb-1.5">
                Description / Action Instructions
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full text-[15px] p-3 rounded-xl border border-[#E1DBEA] focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] text-[#292238]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0EBF8]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="bg-[#5425CB] hover:bg-[#431DA7] text-white font-semibold"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 11. Delete Task Confirmation Modal (Manual Tasks Only) */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Task"
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-[14px] text-[#625A70]">
              Are you sure you want to permanently delete this task? This action cannot be undone. Only manually
              created tasks that are not completed can be deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1DBEA]">
              <Button variant="outline" size="md" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleDeleteTask}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Task'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
