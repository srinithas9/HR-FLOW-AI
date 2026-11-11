import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { dashboardApi } from '../api/dashboardApi';
import { departmentApi } from '../api/departmentApi';
import * as AuthContext from '../context/AuthContext';
import { Role } from '../types/auth';
import { DashboardOverviewResponse, MilestoneItem, ActivityItem, CopilotOperationalSummary, AttentionItem } from '../types/dashboard';

vi.mock('../api/dashboardApi');
vi.mock('../api/departmentApi');
vi.mock('../context/AuthContext');
vi.mock('../api/copilotApi', () => ({
  copilotApi: {
    getDailyBriefing: vi.fn().mockResolvedValue(null),
  },
}));

const mockAdminRole: Role = {
  id: 1,
  role_code: 'ADMIN',
  role_name: 'Administrator',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockReportingManagerRole: Role = {
  id: 4,
  role_code: 'REPORTING_MANAGER',
  role_name: 'Reporting Manager',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockOverviewData: DashboardOverviewResponse = {
  operational_date: '2026-11-09T00:00:00',
  user_role: 'ADMIN',
  department_id: null,
  total_attention_count: 3,
  kpis: {
    total_employees: 194,
    new_joiners_this_month: 4,
    exits_this_month: 2,
    pending_hr_actions: 268,
    active_employees: 194,
    open_tasks: 268,
    overdue_tasks: 37,
    tasks_due_next_7_days: 18,
  },
  lifecycle: {
    onboarding_active: 4,
    probation_active: 10,
    confirmation_pending: 5,
    documentation_pending: 0,
    performance_reviews_in_progress: 0,
    offboarding_in_progress: 8,
  },
  daily_briefing: [
    {
      id: 'briefing-1',
      headline: '37 HR operational tasks are currently overdue.',
      description: 'These tasks have passed their scheduled completion date and require immediate resolution or deadline extension.',
      process: 'Task Management',
      action_label: 'View Overdue Tasks',
      link_path: '/tasks?overdue=true',
      severity: 'HIGH',
    },
    {
      id: 'briefing-2',
      headline: '10 employee probation reviews are currently active.',
      description: 'Assessments and manager feedback are required to determine confirmation decisions.',
      process: 'Probation',
      action_label: 'View Probation',
      link_path: '/lifecycle/probation',
      severity: 'MEDIUM',
    },
  ],
  attention_required: [
    {
      id: 'task-101',
      entity_id: 101,
      category: 'OVERDUE_TASK',
      severity: 'HIGH',
      title: 'Submit Compliance Documents',
      employee_id: 12,
      employee_name: 'Vikram Mehta',
      employee_code: 'EMP-0012',
      department_name: 'Software Engineering',
      workflow_status: 'IN_PROGRESS',
      due_date: '2026-10-15',
      days_overdue: 25,
      action_required: 'Immediate completion required',
      link_path: '/tasks?highlight=101',
    },
    {
      id: 'prob-191',
      entity_id: 191,
      category: 'OVERDUE_REVIEW',
      severity: 'HIGH',
      title: 'Probation Review: Priya Sharma',
      employee_id: 191,
      employee_name: 'Priya Sharma',
      employee_code: 'EMP-0191',
      department_name: 'Marketing',
      workflow_status: 'UNDER_REVIEW',
      due_date: '2026-10-20',
      days_overdue: 20,
      action_required: 'Manager review overdue',
      link_path: '/lifecycle/probation?id=191',
    },
    {
      id: 'offb-201',
      entity_id: 201,
      category: 'PENDING_CLEARANCE',
      severity: 'MEDIUM',
      title: 'IT Asset Return: Rahul Verma',
      employee_id: 201,
      employee_name: 'Rahul Verma',
      employee_code: 'EMP-0201',
      department_name: 'Finance',
      workflow_status: 'IN_PROGRESS',
      due_date: '2026-12-13',
      days_overdue: 0,
      action_required: 'Clearance hold pending return',
      link_path: '/lifecycle/offboarding?id=201',
    },
  ],
};

const mockMilestones: MilestoneItem[] = [
  {
    id: 'm-1',
    milestone_type: 'ONBOARDING_COMPLETION',
    title: 'Onboarding 30-Day Checkpoint',
    employee_id: 15,
    employee_name: 'Ananya Rao',
    employee_code: 'EMP-0015',
    department_name: 'Engineering',
    target_date: '2026-11-15',
    days_remaining: 6,
    status: 'SCHEDULED',
    link_path: '/lifecycle/onboarding?id=15',
  },
  {
    id: 'm-2',
    milestone_type: 'PROBATION_END',
    title: 'Probation End Date',
    employee_id: 22,
    employee_name: 'Rohan Gupta',
    employee_code: 'EMP-0022',
    department_name: 'Marketing',
    target_date: '2026-11-20',
    days_remaining: 11,
    status: 'IN_PROGRESS',
    link_path: '/lifecycle/probation?id=22',
  },
];

const mockActivities: ActivityItem[] = [
  {
    id: 1,
    entity_type: 'TASK',
    entity_id: 123,
    action: 'REASSIGN_TASK',
    action_label: 'Task Reassigned',
    actor_id: 2,
    actor_name: 'Kavita Iyer',
    employee_name: 'Amit Singh',
    details: { task_code: 'TSK-00123' },
    created_at: '2026-11-09T10:15:00',
    formatted_time: '10:15 AM',
  },
  {
    id: 2,
    entity_type: 'CONFIRMATION',
    entity_id: 45,
    action: 'APPROVE_CONFIRMATION',
    action_label: 'Confirmation Approved',
    actor_id: 3,
    actor_name: 'Pooja Nair',
    employee_name: 'Neha Patel',
    details: { confirmation_code: 'CONF-00045' },
    created_at: '2026-11-09T09:30:00',
    formatted_time: '09:30 AM',
  },
];

const mockCopilotSummary: CopilotOperationalSummary = {
  id: 120,
  title: 'Weekly Executive Briefing',
  summary_type: 'OPERATIONAL_RETROSPECTIVE',
  target_role: 'ADMIN',
  period_start: '2026-11-02',
  period_end: '2026-11-09',
  executive_summary: 'Overall operations stable. 37 tasks are overdue requiring priority escalation. 8 offboarding clearance items are pending.',
  key_metrics: {
    total_open_tasks: 268,
    overdue_count: 37,
  },
  critical_bottlenecks: [
    '37 tasks are overdue out of 268 open tasks',
    '8 offboarding clearance holds remain active',
  ],
  action_items: [
    'Trigger automated follow-ups for high-priority overdue tasks',
    'Expedite IT asset return clearance for upcoming exits',
  ],
  generated_at: '2026-11-09T08:00:00',
};

describe('HR Flow AI — Overview Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(dashboardApi.getOverview).mockResolvedValue(mockOverviewData);
    vi.mocked(dashboardApi.getUpcomingMilestones).mockResolvedValue(mockMilestones);
    vi.mocked(dashboardApi.getRecentActivities).mockResolvedValue(mockActivities);
    vi.mocked(dashboardApi.getCopilotSummary).mockResolvedValue(mockCopilotSummary);
    vi.mocked(departmentApi.listDepartments).mockResolvedValue([
      { id: 1, department_code: 'ENG', name: 'Software Engineering', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 2, department_code: 'MKT', name: 'Marketing', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);

    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 1,
        email: 'admin@auratech.in',
        full_name: 'Aditi Rao',
        role_id: 1,
        role: mockAdminRole,
        is_active: true,
      },
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });
  });

  it('renders all six core dashboard sections in frozen order', async () => {
    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Section 1: Welcome Greeting Banner (First Name only, no role badge)
    await waitFor(() => {
      expect(screen.getByText(/Aditi/i)).toBeInTheDocument();
    });

    // Section 2: Four KPIs
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('194')).toBeInTheDocument();
    expect(screen.getByText('New Joiners This Month')).toBeInTheDocument();
    expect(screen.getByText('Exits This Month')).toBeInTheDocument();
    expect(screen.getByText('Pending HR Actions')).toBeInTheDocument();
    expect(screen.getAllByText('268').length).toBeGreaterThanOrEqual(1);

    // Six lifecycle stages rendered
    expect(screen.getByText('Employee Lifecycle Pipeline')).toBeInTheDocument();
    expect(screen.getAllByText('Onboarding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Probation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confirmation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Documentation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Performance Reviews').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Offboarding').length).toBeGreaterThanOrEqual(1);

    // Section 4: Attention Required
    expect(screen.getByText('Attention Required')).toBeInTheDocument();
    expect(screen.getByText(/Submit Compliance Documents/i)).toBeInTheDocument();
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Open/i }).length).toBeGreaterThanOrEqual(1);

    // Section 5: Upcoming Milestones (Card-based Layout)
    expect(screen.getByText('Upcoming Milestones')).toBeInTheDocument();
    expect(screen.getByText('Ananya Rao')).toBeInTheDocument();
    expect(screen.queryByText('Recent HR Activities')).not.toBeInTheDocument();

    // Section 6: HR Daily Briefing
    expect(screen.getByText('HR Daily Briefing')).toBeInTheDocument();
    expect(screen.getByText(/37 HR operational tasks are currently overdue/i)).toBeInTheDocument();
  });

  it('renders clean fallback for HR Daily Briefing when no briefing items exist', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: {
        id: 4,
        email: 'manager@auratech.in',
        full_name: 'Rajesh Kumar',
        role_id: 4,
        role: mockReportingManagerRole,
        is_active: true,
      },
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    vi.mocked(dashboardApi.getOverview).mockResolvedValueOnce({
      ...mockOverviewData,
      daily_briefing: [],
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Rajesh/i)).toBeInTheDocument();
    });

    // Fallback message
    expect(
      screen.getByText(/No additional HR insights at the moment. Your current HR activities are shown above./i)
    ).toBeInTheDocument();
  });

  it('allows filtering by department for Admin and re-fetches metrics', async () => {
    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by department/i })).toBeInTheDocument();
    });

    const deptSelect = screen.getByRole('combobox', { name: /filter by department/i });
    fireEvent.change(deptSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(dashboardApi.getOverview).toHaveBeenCalledWith(1);
    });
  });

  it('displays pagination and navigates pages when Attention Required has > 10 items', async () => {
    // Generate 20 mock overdue tasks
    const manyTasks: AttentionItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `task-${200 + i}`,
      entity_id: 200 + i,
      category: 'OVERDUE_TASK',
      severity: 'HIGH' as const,
      title: `Overdue Task ${i + 1}`,
      employee_id: 10 + i,
      employee_name: `Employee ${i + 1}`,
      employee_code: `EMP-0${i + 10}`,
      department_name: 'Software Engineering',
      workflow_status: 'IN_PROGRESS',
      due_date: '2026-10-15',
      days_overdue: 10 + i,
      action_required: 'Immediate action',
      link_path: `/tasks?highlight=${200 + i}`,
    }));

    vi.mocked(dashboardApi.getOverview).mockResolvedValueOnce({
      ...mockOverviewData,
      total_attention_count: 20,
      attention_required: manyTasks,
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/matching records/i)).toBeInTheDocument();
    });

    // Check pagination status: "Showing 1 to 10 of 20 matching records"
    expect(screen.getByText(/matching records/i)).toBeInTheDocument();
    expect(screen.getByText('Complete Overdue Task 1')).toBeInTheDocument();
    expect(screen.queryByText('Complete Overdue Task 15')).not.toBeInTheDocument();

    // Click Next page
    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    fireEvent.click(nextBtn);

    // Verify page 2 is visible
    expect(screen.getByText('Complete Overdue Task 15')).toBeInTheDocument();
    expect(screen.getByText('Complete Overdue Task 20')).toBeInTheDocument();
    expect(screen.queryByText('Complete Overdue Task 1')).not.toBeInTheDocument();

    // Click Previous page
    const prevBtn = screen.getByRole('button', { name: /Previous page/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText('Complete Overdue Task 1')).toBeInTheDocument();

    // Switch to Overdue Tasks tab
    fireEvent.click(screen.getByRole('button', { name: /^Overdue Tasks/i }));
    expect(screen.getByText('Complete Overdue Task 1')).toBeInTheDocument();
  });
});
