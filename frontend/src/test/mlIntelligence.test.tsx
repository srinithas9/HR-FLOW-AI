import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MLIntelligencePage } from '../pages/ml-intelligence/MLIntelligencePage';
import { mlIntelligenceApi } from '../api/mlIntelligenceApi';

vi.mock('../api/mlIntelligenceApi', () => ({
  mlIntelligenceApi: {
    getOverview: vi.fn(),
    getBottlenecks: vi.fn(),
    listTasks: vi.fn(),
    getTaskAssessment: vi.fn(),
    updateTaskPriority: vi.fn(),
  },
}));

const mockOverview = {
  high_risk_tasks: 37,
  needs_attention: 55,
  overdue_tasks: 24,
  upcoming_at_risk_deadlines: 22,
  total_active_tasks: 262,
  last_updated: '2026-11-10T06:00:00Z',
};

const mockBottlenecks = {
  categories: [
    {
      id: 'WAITING_RESPONSE',
      name: 'Awaiting Responses',
      count: 14,
      description: 'Follow-ups sent with no response.',
      filter_key: 'WAITING_RESPONSE',
    },
    {
      id: 'PENDING_DEPENDENCY',
      name: 'Prerequisite Blockers',
      count: 12,
      description: 'Tasks waiting on prior dependent operational activities.',
      filter_key: 'PENDING_DEPENDENCY',
    },
  ],
  total_bottlenecked_tasks: 26,
};

const mockTasks = {
  items: [
    {
      task_id: 101,
      task_code: 'TSK-0101',
      title: 'Collect Joining Form 11 for Priya Sharma',
      category: 'ONBOARDING',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      due_date: '2026-11-12',
      days_remaining: 2,
      is_overdue: false,
      overdue_days: 0,
      assignee: {
        id: 1,
        full_name: 'Kavita Iyer',
        email: 'kavita.iyer@auratech.in',
        role: 'HR Executive',
      },
      employee: {
        id: 50,
        full_name: 'Priya Sharma',
        employee_code: 'EMP-0050',
      },
      delay_probability: 0.421,
      risk_level: 'HIGH',
      hr_attention_priority: 'CRITICAL',
      main_concern: 'Due in 2d; blocked by prerequisite task',
      bottlenecks: ['PENDING_DEPENDENCY'],
      active_blockers_count: 1,
      follow_ups_count: 0,
      escalations_count: 0,
    },
  ],
  total: 1,
  page: 1,
  size: 20,
  total_pages: 1,
};

const mockAssessment = {
  task_id: 101,
  task_code: 'TSK-0101',
  title: 'Collect Joining Form 11 for Priya Sharma',
  category: 'ONBOARDING',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  due_date: '2026-11-12',
  days_remaining: 2,
  is_overdue: false,
  overdue_days: 0,
  assignee: {
    id: 1,
    full_name: 'Kavita Iyer',
    email: 'kavita.iyer@auratech.in',
    role: 'HR Executive',
  },
  employee: {
    id: 50,
    full_name: 'Priya Sharma',
    employee_code: 'EMP-0050',
  },
  model_prediction: {
    delay_probability: 0.421,
    risk_level: 'HIGH',
    model_version: 'v2.1.0-phase7a',
    advisory_note: 'Decision-support indicator calculated from historical execution patterns.',
    contributing_factors: [
      {
        factor: 'days_remaining=2',
        effect: 'Imminent deadline increases risk',
        impact: 0.04,
      },
    ],
  },
  hr_attention_priority: 'CRITICAL',
  hr_attention_rule: 'Deadline is in 2 day(s) but prerequisite task is still incomplete.',
  main_concern: 'Due in 2d; blocked by prerequisite task',
  operational_facts: {
    dependencies: [
      {
        id: 99,
        task_code: 'TSK-0099',
        title: 'Background Verification',
        status: 'IN_PROGRESS',
        owner_name: 'External Vendor',
      },
    ],
    follow_ups: [],
    escalations: [],
    owner_workload: {
      active_tasks_count: 14,
      historical_delay_rate: 0.18,
    },
  },
  observations: ['Target deadline is in 2 calendar days.'],
  suggested_next_steps: ['Expedite prerequisite task TSK-0099.'],
  available_actions: {
    task_url: '/tasks?taskId=101',
    follow_ups_url: '/follow-ups?taskId=101',
    can_escalate: true,
    can_prioritise: false,
  },
};

describe('MLIntelligencePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mlIntelligenceApi.getOverview as any).mockResolvedValue(mockOverview);
    (mlIntelligenceApi.getBottlenecks as any).mockResolvedValue(mockBottlenecks);
    (mlIntelligenceApi.listTasks as any).mockResolvedValue(mockTasks);
    (mlIntelligenceApi.getTaskAssessment as any).mockResolvedValue(mockAssessment);
  });

  it('renders overview KPI metric cards and verified bottlenecks', async () => {
    render(
      <MemoryRouter>
        <MLIntelligencePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ML Intelligence — Task Delay Risk Prediction')).toBeInTheDocument();
      expect(screen.getByText('High Delay-Risk Tasks')).toBeInTheDocument();
      expect(screen.getByText('37')).toBeInTheDocument();
      expect(screen.getByText('Urgent Attention Needed')).toBeInTheDocument();
      expect(screen.getByText('55')).toBeInTheDocument();
      expect(screen.getByText('Overdue Operational Tasks')).toBeInTheDocument();
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(screen.getByText('Upcoming At-Risk (≤7d)')).toBeInTheDocument();
      expect(screen.getByText('22')).toBeInTheDocument();
    });

    // Check bottleneck cards
    expect(screen.getByText('Awaiting Responses')).toBeInTheDocument();
    expect(screen.getByText('Prerequisite Blockers')).toBeInTheDocument();
  });

  it('renders tasks at risk table with live records', async () => {
    render(
      <MemoryRouter>
        <MLIntelligencePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TSK-0101')).toBeInTheDocument();
      expect(screen.getByText('Collect Joining Form 11 for Priya Sharma')).toBeInTheDocument();
      expect(screen.getAllByText('Critical Attention').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/42\.1%/)).toBeInTheDocument();
    });
  });

  it('opens task assessment drawer when assess button is clicked', async () => {
    render(
      <MemoryRouter>
        <MLIntelligencePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TSK-0101')).toBeInTheDocument();
    });

    const assessBtn = screen.getByText('Assess');
    fireEvent.click(assessBtn);

    await waitFor(() => {
      expect(screen.getByText('Operational Priority Rationale')).toBeInTheDocument();
      expect(
        screen.getByText('Deadline is in 2 day(s) but prerequisite task is still incomplete.')
      ).toBeInTheDocument();
      expect(screen.getByText('Estimated Task Delay Risk')).toBeInTheDocument();
      expect(screen.getByText('Background Verification')).toBeInTheDocument();
      expect(screen.getByText('Expedite prerequisite task TSK-0099.')).toBeInTheDocument();
      expect(screen.getByText('Open in Tasks')).toBeInTheDocument();
    });
  });
});
