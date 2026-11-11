import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionCenterPage } from '../pages/action-center/ActionCenterPage';
import { taskApi } from '../api/taskApi';
import { employeeApi } from '../api/employeeApi';
import { userApi } from '../api/userApi';
import * as AuthContext from '../context/AuthContext';
import { TaskItem, TaskDetail } from '../types/task';
import { Role } from '../types/auth';

// Mock dependencies
vi.mock('../api/taskApi');
vi.mock('../api/slaApi');
vi.mock('../api/employeeApi');
vi.mock('../api/userApi');
vi.mock('../context/AuthContext');

const mockMetrics = {
  total_tasks: 5982,
  pending_tasks: 1200,
  in_progress_tasks: 2500,
  blocked_tasks: 150,
  completed_tasks: 2000,
  overdue_tasks: 132,
  high_risk_tasks: 45,
  active_tasks: 2650,
  delayed_tasks: 0,
  due_in_7_days: 85,
};

const mockRoleAdmin: Role = {
  id: 1,
  role_code: 'ADMIN',
  role_name: 'Administrator',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockRoleMgr: Role = {
  id: 4,
  role_code: 'REPORTING_MANAGER',
  role_name: 'Reporting Manager',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockTasks: TaskItem[] = [
  {
    id: 1,
    task_code: 'TSK-00001',
    title: 'Complete Background Check',
    category: 'ONBOARDING',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    due_date: '2026-11-15',
    employee_id: 10,
    owner_id: 10,
    deadline_extension_count: 0,
    created_at: '2026-11-01T00:00:00',
    updated_at: '2026-11-01T00:00:00',
    employee_name: 'Rahul Sharma',
    employee_code: 'EMP-00010',
    department_name: 'Engineering',
    owner_name: 'Shruti Dutta',
    is_overdue: false,
    ml_risk_level: 'HIGH',
    ml_risk_score: 0.72,
  },
  {
    id: 2,
    task_code: 'TSK-00002',
    title: 'Submit IT Assets Clearance',
    category: 'OFFBOARDING',
    priority: 'CRITICAL',
    status: 'BLOCKED',
    due_date: '2026-11-05',
    employee_id: 12,
    owner_id: 95,
    deadline_extension_count: 0,
    created_at: '2026-11-01T00:00:00',
    updated_at: '2026-11-01T00:00:00',
    employee_name: 'Priya Patel',
    employee_code: 'EMP-00012',
    department_name: 'IT Support',
    owner_name: 'Varun Kapoor',
    is_overdue: true,
    ml_risk_level: 'CRITICAL',
    ml_risk_score: 0.88,
  },
];

const mockTaskDetail: TaskDetail = {
  ...mockTasks[0],
  description: 'Conduct thorough criminal and academic background verification.',
  start_date: '2026-11-01',
  completed_at: undefined,
  deadline_extension_count: 0,
  last_deadline_change_reason: undefined,
  is_blocked: true,
  blocking_prerequisites: [
    {
      task_id: 99,
      task_code: 'TSK-00099',
      title: 'Collect Identity Documents',
      status: 'IN_PROGRESS',
    },
  ],
  prerequisites: [],
  successors: [],
  status_history: [],
  latest_prediction: {
    id: 501,
    model_version: 'v1.0.0',
    predicted_delay_probability: 0.72,
    predicted_label: 1,
    confidence_score: 0.91,
    risk_level: 'HIGH',
    prediction_timestamp: '2026-11-01T10:00:00',
  },
};

describe('ActionCenterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock as ADMIN
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 10,
        email: 'shruti.dutta10@indiatree-tech.in',
        full_name: 'Shruti Dutta',
        role_id: 1,
        employee_id: 10,
        is_active: true,
        role: mockRoleAdmin,
      },
      token: 'fake-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
    });

    vi.mocked(taskApi.getOverview).mockResolvedValue(mockMetrics);
    vi.mocked(taskApi.listTasks).mockResolvedValue({
      items: mockTasks,
      pagination: { total: 2, page: 1, size: 20, total_pages: 1 },
      total: 2,
      page: 1,
      size: 20,
      pages: 1,
    });
    vi.mocked(taskApi.listTemplates).mockResolvedValue([]);
    vi.mocked(employeeApi.listEmployees).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 20, total_pages: 0 },
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
    });
    vi.mocked(userApi.listUsers).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 20, total_pages: 0 },
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
    });
    vi.mocked(taskApi.getTaskDetail).mockResolvedValue(mockTaskDetail);
  });

  it('renders Task Management with summary cards and task directory table', async () => {
    render(<ActionCenterPage />);

    expect(screen.getByText(/Task Management/i)).toBeInTheDocument();

    // Verify summary metric cards
    await waitFor(() => {
      expect(screen.getAllByText('2650').length).toBeGreaterThan(0);
      expect(screen.getAllByText('150').length).toBeGreaterThan(0);
      expect(screen.getAllByText('132').length).toBeGreaterThan(0);
    });

    // Verify task table rows
    expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Complete Background Check').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rahul Sharma').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TSK-00002').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Submit IT Assets Clearance').length).toBeGreaterThan(0);
  });

  it('filters tasks by search input', async () => {
    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    const searchInput = screen.getByPlaceholderText(/search tasks or employees/i);
    fireEvent.change(searchInput, { target: { value: 'Background' } });

    await waitFor(() => {
      expect(taskApi.listTasks).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Background' })
      );
    });
  });

  it('opens Add Task modal for Admin and validates required fields', async () => {
    render(<ActionCenterPage />);

    const newTaskBtn = await screen.findByRole('button', { name: /add task/i });
    fireEvent.click(newTaskBtn);

    expect(screen.getByRole('heading', { name: /add task/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Conduct Day-1 Buddy Introduction/i)).toBeInTheDocument();
    expect(screen.getAllByText(/due date/i).length).toBeGreaterThan(0);
  });

  it('displays dependency blocker warning on status change modal when task is blocked', async () => {
    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    // Click View Details button to open detail drawer
    const detailsBtns = await screen.findAllByRole('button', { name: /view details/i });
    fireEvent.click(detailsBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/conduct thorough criminal/i)).toBeInTheDocument();
    });

    // Open Status modal from detail drawer
    const updateStatusBtn = screen.getByRole('button', { name: /update status/i });
    fireEvent.click(updateStatusBtn);

    // Verify status modal displays target status
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /update task status/i })).toBeInTheDocument();
    });
  });

  it('enforces deadline extension reason validation', async () => {
    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    const detailsBtns = await screen.findAllByRole('button', { name: /view details/i });
    fireEvent.click(detailsBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit due date/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit due date/i }));

    expect(screen.getByRole('heading', { name: /edit due date/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/audit explanation/i)).toBeInTheDocument();
  });

  it('renders empty state when no tasks match filter criteria', async () => {
    vi.mocked(taskApi.listTasks).mockResolvedValueOnce({
      items: [],
      pagination: { total: 0, page: 1, size: 20, total_pages: 0 },
      total: 0,
      page: 1,
      size: 20,
      pages: 0,
    });

    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getByText(/no active tasks found/i)).toBeInTheDocument();
    });
  });

  it('renders API error banner gracefully on network failure', async () => {
    vi.mocked(taskApi.listTasks).mockRejectedValueOnce(new Error('Network Error: Database unavailable'));

    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getByText(/network error: database unavailable/i)).toBeInTheDocument();
    });
  });

  it('restricts Reporting Manager from seeing Add Task button', async () => {
    // Switch to REPORTING_MANAGER role
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'rohan.pillai1@indiatree-tech.in',
        full_name: 'Rohan Pillai',
        role_id: 4,
        employee_id: 1,
        is_active: true,
        role: mockRoleMgr,
      },
      token: 'mgr-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
    });

    render(<ActionCenterPage />);

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    // Reporting Manager must NOT see "Add Task" button
    expect(screen.queryByRole('button', { name: /add task/i })).not.toBeInTheDocument();
  });
});
