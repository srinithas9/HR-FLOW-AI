import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LifecyclePage } from '../pages/lifecycle/LifecyclePage';
import { useAuth } from '../hooks/useAuth';
import { lifecycleApi } from '../api/lifecycleApi';

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/lifecycleApi', () => ({
  lifecycleApi: {
    getOverview: vi.fn(),
    listOnboarding: vi.fn(),
    listProbation: vi.fn(),
    listConfirmation: vi.fn(),
    listDocuments: vi.fn(),
    listPerformanceReviews: vi.fn(),
    listPerformanceCycles: vi.fn(),
    listOffboarding: vi.fn(),
    listTemplates: vi.fn(),
    getCalendarEvents: vi.fn(),
  },
}));

describe('LifecyclePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useAuth as any).mockReturnValue({
      user: {
        id: 1,
        full_name: 'Neha Saxena',
        email: 'neha.saxena@auratech.in',
        role: { role_code: 'ADMIN', role_name: 'Administrator' },
      },
    });

    (lifecycleApi.getOverview as any).mockResolvedValue({
      total_active_employees: 200,
      onboarding_active: 4,
      probation_active: 15,
      confirmation_pending: 5,
      performance_reviews_in_progress: 0,
      offboarding_in_progress: 8,
      confirmed_employees: 185,
      process_cards: [
        {
          stage: 'ONBOARDING',
          title: 'Onboarding',
          description: 'Coordinate new hire joining...',
          primary_count: 4,
          primary_label: 'In Progress',
          secondary_count: 196,
          secondary_label: 'Completed',
          action_required_count: 4,
          action_required_label: 'Action Required',
        },
        {
          stage: 'PROBATION',
          title: 'Probation',
          description: 'Track 90-day evaluation milestones...',
          primary_count: 15,
          primary_label: 'Under Review',
          secondary_count: 185,
          secondary_label: 'Confirmed',
          action_required_count: 5,
          action_required_label: 'Review Due Soon',
        },
        {
          stage: 'CONFIRMATION',
          title: 'Confirmation',
          description: 'Conduct manager approvals...',
          primary_count: 5,
          primary_label: 'Pending Decision',
          secondary_count: 185,
          secondary_label: 'Confirmed',
          action_required_count: 5,
          action_required_label: 'Action Required',
        },
        {
          stage: 'DOCUMENTATION',
          title: 'Documentation',
          description: 'Collect and verify compliance records...',
          primary_count: 1200,
          primary_label: 'Verified Docs',
          secondary_count: 1200,
          secondary_label: 'Total Documents',
          action_required_count: 0,
          action_required_label: 'Requires Verification',
        },
        {
          stage: 'PERFORMANCE',
          title: 'Performance Reviews',
          description: 'Manage appraisal cycles...',
          primary_count: 0,
          primary_label: 'Active Reviews',
          secondary_count: 600,
          secondary_label: 'Completed',
          action_required_count: 0,
          action_required_label: 'Reviews Pending',
        },
        {
          stage: 'OFFBOARDING',
          title: 'Offboarding',
          description: 'Manage exit clearances...',
          primary_count: 8,
          primary_label: 'In Progress',
          secondary_count: 6,
          secondary_label: 'Completed',
          action_required_count: 8,
          action_required_label: 'Clearance Pending',
        },
      ],
    });

    (lifecycleApi.listOnboarding as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listProbation as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listConfirmation as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listDocuments as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listPerformanceReviews as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listPerformanceCycles as any).mockResolvedValue(['FY24-H2', 'FY24-H1']);
    (lifecycleApi.listOffboarding as any).mockResolvedValue({
      items: [],
      pagination: { total: 0, page: 1, size: 15, total_pages: 1 },
    });
    (lifecycleApi.listTemplates as any).mockResolvedValue([]);
    (lifecycleApi.getCalendarEvents as any).mockResolvedValue([]);
  });

  it('renders the main heading, subtitle and defaults to Onboarding on /lifecycle', async () => {
    render(
      <MemoryRouter initialEntries={['/lifecycle']}>
        <Routes>
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/lifecycle/:tab" element={<LifecyclePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Employee Lifecycle')).toBeInTheDocument();
    expect(
      screen.getByText('Manage employee onboarding, probation, reviews, documentation, confirmations and exits in one place.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(lifecycleApi.listOnboarding).toHaveBeenCalled();
    });

    // Check that Overview process cards are NOT present
    expect(screen.queryByText('View Onboarding')).not.toBeInTheDocument();
  });

  it('renders exactly the six lifecycle workspace tabs in order and excludes Overview and removed features', async () => {
    render(
      <MemoryRouter initialEntries={['/lifecycle/onboarding']}>
        <Routes>
          <Route path="/lifecycle/:tab" element={<LifecyclePage />} />
        </Routes>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Lifecycle Workspaces' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Onboarding',
      'Documentation',
      'Probation',
      'Confirmation',
      'Performance Reviews',
      'Offboarding',
    ]);

    // Overview and removed features must not be in the navigation or anywhere on the page
    expect(within(nav).queryByText('Overview')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Templates')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Calendar')).not.toBeInTheDocument();
    expect(screen.queryByText('Lifecycle Templates')).not.toBeInTheDocument();
    expect(screen.queryByText('Lifecycle Calendar')).not.toBeInTheDocument();
  });

  it('navigates between the six workspaces when tabs are clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/lifecycle/onboarding']}>
        <Routes>
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/lifecycle/:tab" element={<LifecyclePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(lifecycleApi.listOnboarding).toHaveBeenCalled();
    });

    const nav = screen.getByRole('navigation', { name: 'Lifecycle Workspaces' });
    fireEvent.click(within(nav).getByText('Probation'));

    await waitFor(() => {
      expect(lifecycleApi.listProbation).toHaveBeenCalled();
    });
  });
});
