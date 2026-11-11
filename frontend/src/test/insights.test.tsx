import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HROperationsInsightsPage } from '../pages/insights/HROperationsInsightsPage';
import { analyticsApi } from '../api/analyticsApi';
import { mlIntelligenceApi } from '../api/mlIntelligenceApi';
import { departmentApi } from '../api/departmentApi';
import * as AuthContext from '../context/AuthContext';

vi.mock('../api/analyticsApi');
vi.mock('../api/mlIntelligenceApi');
vi.mock('../api/departmentApi');
vi.mock('../context/AuthContext');

// Mock ResponsiveContainer for Recharts in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 800, height: 300 }}>{children}</div>,
  };
});

describe('HR Operations Insights Page Component', () => {
  const mockAnalyticsData = {
    reporting_period: '12m',
    period_start: '2025-11-10',
    period_end: '2026-11-10',
    last_refreshed_at: '2026-11-10T12:00:00Z',
    kpis: {
      activities_completed: 1236,
      on_time_completion_rate: 79.9,
      median_completion_time_days: 6.0,
      late_completions: 259,
      total_eligible: 1236,
    },
    on_time_by_process: [
      { process_key: 'ONBOARDING', process_name: 'Onboarding', completed_count: 450, on_time_count: 360, late_count: 90, on_time_percentage: 80.0 },
      { process_key: 'PROBATION', process_name: 'Probation', completed_count: 300, on_time_count: 240, late_count: 60, on_time_percentage: 80.0 },
      { process_key: 'CONFIRMATION', process_name: 'Confirmation', completed_count: 100, on_time_count: 85, late_count: 15, on_time_percentage: 85.0 },
      { process_key: 'DOCUMENTATION', process_name: 'Documentation', completed_count: 200, on_time_count: 150, late_count: 50, on_time_percentage: 75.0 },
      { process_key: 'PERFORMANCE', process_name: 'Performance Reviews', completed_count: 150, on_time_count: 120, late_count: 30, on_time_percentage: 80.0 },
      { process_key: 'OFFBOARDING', process_name: 'Offboarding', completed_count: 36, on_time_count: 27, late_count: 9, on_time_percentage: 75.0 },
    ],
    monthly_trend: [
      { month: '2026-08', month_label: 'Aug 2026', completed: 110, late: 20, on_time: 90, on_time_percentage: 81.8 },
      { month: '2026-09', month_label: 'Sep 2026', completed: 95, late: 18, on_time: 77, on_time_percentage: 81.1 },
      { month: '2026-10', month_label: 'Oct 2026', completed: 105, late: 22, on_time: 83, on_time_percentage: 79.0 },
    ],
    turnaround_by_process: [
      { process_key: 'ONBOARDING', process_name: 'Onboarding', median_days: 2.0, unit: 'days', sample_size: 450 },
      { process_key: 'PROBATION', process_name: 'Probation', median_days: 6.0, unit: 'days', sample_size: 300 },
      { process_key: 'CONFIRMATION', process_name: 'Confirmation', median_days: 1.0, unit: 'days', sample_size: 100 },
      { process_key: 'DOCUMENTATION', process_name: 'Documentation', median_days: 7.0, unit: 'days', sample_size: 200 },
      { process_key: 'PERFORMANCE', process_name: 'Performance Reviews', median_days: 13.0, unit: 'days', sample_size: 150 },
      { process_key: 'OFFBOARDING', process_name: 'Offboarding', median_days: 2.0, unit: 'days', sample_size: 36 },
    ],
    delay_reasons: [
      { reason: 'Pending prerequisite completion', affected_activities: 20, percentage: 90.9 },
      { reason: 'Vendor dependency requires extra preparation time.', affected_activities: 2, percentage: 9.1 },
    ],
    observations: [
      {
        id: 'obs-1',
        category: 'Process Adherence',
        title: 'Documentation has lowest on-time completion (75%)',
        observation: 'Documentation recorded 50 late completions out of 200 total completed activities (75.0% on-time).',
        metric_or_process: 'Documentation',
        why_it_matters: 'Delayed documentation activities create compliance friction.',
        recommended_action: 'Inspect statutory verification backlog.',
        severity: 'warning',
        action_filter: { process: 'DOCUMENTATION', status: 'LATE' },
      },
    ],
  };

  const mockMlOverview = {
    high_risk_tasks: 2,
    medium_risk_tasks: 3,
    low_risk_tasks: 5,
    needs_attention: 4,
    overdue_tasks: 1,
    upcoming_at_risk_deadlines: 2,
    total_active_tasks: 10,
    last_updated: '2026-11-10T12:00:00Z',
  };

  const mockHighTasks = [
    {
      task_id: 101,
      task_code: 'TSK-00101',
      title: 'Submit Form 16 KYC Credentials',
      category: 'DOCUMENTATION',
      priority: 'HIGH',
      status: 'BLOCKED',
      due_date: '2026-11-12',
      days_remaining: 2,
      is_overdue: false,
      overdue_days: 0,
      assignee: { id: 1, full_name: 'Priya Sharma', email: 'priya@auratech.in', role: 'HR Coordinator' },
      employee: { id: 201, full_name: 'Rohan Mehra', employee_code: 'EMP-0201' },
      delay_probability: 0.88,
      risk_level: 'HIGH' as const,
      hr_attention_priority: 'CRITICAL' as const,
      main_concern: 'Awaiting candidate identity document submission',
      bottlenecks: ['WAITING_RESPONSE', 'PENDING_DEPENDENCY'],
      active_blockers_count: 1,
      follow_ups_count: 2,
      escalations_count: 0,
    },
  ];

  const mockMedTasks = [
    {
      task_id: 102,
      task_code: 'TSK-00102',
      title: 'Conduct Mid-Probation Manager Feedback',
      category: 'PROBATION',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      due_date: '2026-11-15',
      days_remaining: 5,
      is_overdue: false,
      overdue_days: 0,
      assignee: { id: 2, full_name: 'Vikram Seth', email: 'vikram@auratech.in', role: 'HR Specialist' },
      employee: { id: 202, full_name: 'Ananya Verma', employee_code: 'EMP-0202' },
      delay_probability: 0.45,
      risk_level: 'MEDIUM' as const,
      hr_attention_priority: 'NEEDS_ATTENTION' as const,
      main_concern: 'Manager review pending',
      bottlenecks: ['WAITING_RESPONSE'],
      active_blockers_count: 0,
      follow_ups_count: 1,
      escalations_count: 0,
    },
  ];

  const mockLowTasks = [
    {
      task_id: 103,
      task_code: 'TSK-00103',
      title: 'Dispatch Welcome Kit',
      category: 'ONBOARDING',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      due_date: '2026-11-20',
      days_remaining: 10,
      is_overdue: false,
      overdue_days: 0,
      assignee: { id: 1, full_name: 'Priya Sharma', email: 'priya@auratech.in', role: 'HR Coordinator' },
      employee: { id: 203, full_name: 'Karan Joshi', employee_code: 'EMP-0203' },
      delay_probability: 0.08,
      risk_level: 'LOW' as const,
      hr_attention_priority: 'MONITOR' as const,
      main_concern: 'Kit dispatch underway',
      bottlenecks: [],
      active_blockers_count: 0,
      follow_ups_count: 0,
      escalations_count: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'admin@auratech.com',
        full_name: 'Admin User',
        role_id: 1,
        role: { id: 1, role_code: 'ADMIN', role_name: 'System Admin', is_active: true, created_at: '', updated_at: '' },
        employee_id: 1,
        is_active: true,
        last_login_at: '',
        created_at: '',
      },
      isAuthenticated: true,
      isLoading: false,
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      error: null,
    });

    (departmentApi.listDepartments as any).mockResolvedValue([
      { id: 1, name: 'Engineering', department_code: 'ENG', employee_count: 50 },
      { id: 2, name: 'HR', department_code: 'HR', employee_count: 10 },
    ]);

    (analyticsApi.getPerformance as any).mockResolvedValue(mockAnalyticsData);
    (mlIntelligenceApi.getOverview as any).mockResolvedValue(mockMlOverview);
    (mlIntelligenceApi.listTasks as any).mockImplementation(({ risk_level }: any) => {
      if (risk_level === 'HIGH') return Promise.resolve({ items: mockHighTasks, total: 1, page: 1, size: 50, total_pages: 1 });
      if (risk_level === 'MEDIUM') return Promise.resolve({ items: mockMedTasks, total: 1, page: 1, size: 50, total_pages: 1 });
      if (risk_level === 'LOW') return Promise.resolve({ items: mockLowTasks, total: 1, page: 1, size: 50, total_pages: 1 });
      return Promise.resolve({ items: [], total: 0, page: 1, size: 50, total_pages: 1 });
    });
  });

  it('renders page header and both main sections in correct frozen hierarchy', async () => {
    render(
      <MemoryRouter>
        <HROperationsInsightsPage />
      </MemoryRouter>
    );

    // Title and Subtitle
    expect(screen.getByText('HR Operations Insights')).toBeInTheDocument();
    expect(
      screen.getByText('Understand HR performance, identify delays and decide what needs attention.')
    ).toBeInTheDocument();

    // Section 1 Heading
    expect(screen.getByText('Operational Performance')).toBeInTheDocument();

    // Section 2 Heading
    expect(screen.getByText('Task Delay Risk & Priorities')).toBeInTheDocument();

    // Wait for analytics data to populate
    await waitFor(() => {
      expect(screen.getByText('1236')).toBeInTheDocument(); // Activities Completed
      expect(screen.getByText('79.9%')).toBeInTheDocument(); // On-time rate
      expect(screen.getByText('6')).toBeInTheDocument(); // Median days
      expect(screen.getByText('259')).toBeInTheDocument(); // Late completions
    });
  });

  it('renders all 4 operational performance charts and interpretation section', async () => {
    render(
      <MemoryRouter>
        <HROperationsInsightsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Chart 1: On-Time Completion by Process
      expect(screen.getByText('On-Time Completion by Process')).toBeInTheDocument();

      // Chart 2: Monthly Completion Trends
      expect(screen.getByText('Monthly Completion Trends')).toBeInTheDocument();

      // Chart 3: Time Taken to Complete Each HR Process
      expect(screen.getByText('Time Taken to Complete Each HR Process')).toBeInTheDocument();

      // Chart 4: Why HR Activities Are Delayed
      expect(screen.getByText('Why HR Activities Are Delayed')).toBeInTheDocument();

      // Section: What Needs Attention?
      expect(screen.getByText('What Needs Attention?')).toBeInTheDocument();
      expect(screen.getByText('Documentation has lowest on-time completion (75%)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Recommended Next Step/i })).toBeInTheDocument();
    });
  });

  it('renders Section 2 with 3 risk indicators, High Risk selected by default', async () => {
    render(
      <MemoryRouter>
        <HROperationsInsightsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 3 Risk Summary Indicators
      expect(screen.getByText('High Risk')).toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      expect(screen.getByText('Low Risk')).toBeInTheDocument();

      // High Risk selected by default showing TSK-00101
      expect(screen.getByText('TSK-00101')).toBeInTheDocument();
      expect(screen.getByText('Submit Form 16 KYC Credentials')).toBeInTheDocument();
      expect(screen.getByText(/88.0%/)).toBeInTheDocument(); // Probability gauge
    });
  });

  it('allows clicking Medium and Low risk indicators to filter tasks immediately', async () => {
    render(
      <MemoryRouter>
        <HROperationsInsightsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TSK-00101')).toBeInTheDocument();
    });

    // Medium Risk task should initially not be in the High Risk view
    expect(screen.queryByText('TSK-00102')).not.toBeInTheDocument();

    // Click Medium Risk indicator button
    const medBtn = screen.getByRole('button', { name: /Medium Risk/i });
    fireEvent.click(medBtn);

    // Medium Risk task should now be visible
    await waitFor(() => {
      expect(screen.getByText('TSK-00102')).toBeInTheDocument();
      expect(screen.getByText('Conduct Mid-Probation Manager Feedback')).toBeInTheDocument();
    });

    // Click Low Risk indicator button
    const lowBtn = screen.getByRole('button', { name: /Low Risk/i });
    fireEvent.click(lowBtn);

    // Low Risk task should now be visible
    await waitFor(() => {
      expect(screen.getByText('TSK-00103')).toBeInTheDocument();
      expect(screen.getByText('Dispatch Welcome Kit')).toBeInTheDocument();
    });
  });

  it('opens task assessment drawer when Review button is clicked', async () => {
    const mockAssessment = {
      task_id: 101,
      task_code: 'TSK-00101',
      title: 'Submit Form 16 KYC Credentials',
      category: 'DOCUMENTATION',
      priority: 'HIGH',
      status: 'BLOCKED',
      due_date: '2026-11-12',
      days_remaining: 2,
      is_overdue: false,
      overdue_days: 0,
      assignee: { id: 1, full_name: 'Priya Sharma', email: 'priya@auratech.in' },
      employee: { id: 201, full_name: 'Rohan Mehra', employee_code: 'EMP-0201' },
      prerequisites: [
        { id: 99, task_code: 'TSK-00099', title: 'Issue Offer Letter', status: 'COMPLETED', owner_name: 'Admin' },
      ],
      assignee_workload: { active_tasks_count: 5, historical_delay_rate: 0.22 },
      model_prediction: {
        delay_probability: 0.88,
        risk_level: 'HIGH' as const,
        model_version: 'v2.1.0-phase7a',
        advisory_note: 'Advisory estimation',
        contributing_factors: [{ factor: 'Workload Pressure', effect: 'INCREASES_RISK', impact: 0.15 }],
      },
      recent_follow_ups: [],
      escalations: [],
      suggested_action: 'Escalate to hiring manager to expedite candidate response.',
    };

    (mlIntelligenceApi.getTaskAssessment as any).mockResolvedValue(mockAssessment);

    render(
      <MemoryRouter>
        <HROperationsInsightsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TSK-00101')).toBeInTheDocument();
    });

    const reviewBtn = screen.getAllByRole('button', { name: /^review$/i })[0];
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText('Task Operational Assessment')).toBeInTheDocument();
      expect(screen.getByText('Model Prediction Details')).toBeInTheDocument();
      expect(screen.getByText('Verified Operational Facts')).toBeInTheDocument();
      expect(screen.getByText('Suggested HR Action')).toBeInTheDocument();
      expect(screen.getByText('Escalate to hiring manager to expedite candidate response.')).toBeInTheDocument();
    });
  });
});
