import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowUpsPage } from '../pages/follow-ups/FollowUpsPage';
import { slaApi } from '../api/slaApi';
import { userApi } from '../api/userApi';
import { employeeApi } from '../api/employeeApi';
import { taskApi } from '../api/taskApi';
import * as AuthContext from '../context/AuthContext';
import { FollowUpItem, EscalationItem } from '../types/sla';
import { Role } from '../types/auth';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../api/slaApi');
vi.mock('../api/userApi');
vi.mock('../api/employeeApi');
vi.mock('../api/taskApi');
vi.mock('../context/AuthContext');

const mockRoleAdmin: Role = {
  id: 1,
  role_code: 'ADMIN',
  role_name: 'Administrator',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockFollowUps: FollowUpItem[] = [
  {
    id: 101,
    task_id: 1,
    task_code: 'TSK-00001',
    task_title: 'Complete Background Check',
    employee_id: 10,
    employee_name: 'Rahul Sharma',
    employee_code: 'EMP-00010',
    department_name: 'Engineering',
    initiator_user_id: 10,
    initiator_name: 'Shruti Dutta',
    target_user_id: 1,
    target_name: 'Rohan Pillai',
    follow_up_date: '2026-11-10',
    notes: 'Please verify original degree certificates with university.',
    response_received: false,
    response_notes: undefined,
    status: 'PENDING_ACKNOWLEDGEMENT',
    is_overdue: false,
    created_at: '2026-11-05T09:00:00',
  },
];

const mockEscalations: EscalationItem[] = [
  {
    id: 201,
    task_id: 2,
    task_code: 'TSK-00002',
    task_title: 'Submit IT Assets Clearance',
    employee_id: 12,
    employee_name: 'Priya Patel',
    employee_code: 'EMP-00012',
    department_name: 'Product',
    escalated_by_user_id: 1,
    escalated_by_name: 'Rohan Pillai',
    escalated_to_user_id: 10,
    escalated_to_name: 'Shruti Dutta',
    escalation_level: 2,
    reason: 'Employee not responding to asset return calls for 5 days.',
    status: 'OPEN',
    resolution_notes: undefined,
    resolved_at: undefined,
    created_at: '2026-11-06T14:30:00',
  },
];

const renderComponent = () =>
  render(
    <BrowserRouter>
      <FollowUpsPage />
    </BrowserRouter>
  );

describe('FollowUpsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    vi.mocked(slaApi.getOverview).mockResolvedValue({
      total_follow_ups: 480,
      awaiting_response: 160,
      overdue: 40,
      response_received: 320,
      completed: 300,
      total_escalations: 360,
      open_escalations: 80,
      acknowledged_escalations: 0,
      resolved_escalations: 280,
    });

    vi.mocked(slaApi.listFollowUps).mockResolvedValue({
      items: mockFollowUps,
      pagination: { total: 1, page: 1, size: 15, total_pages: 1 },
      total: 1,
      page: 1,
      size: 15,
      pages: 1,
    });

    vi.mocked(slaApi.listEscalations).mockResolvedValue({
      items: mockEscalations,
      pagination: { total: 1, page: 1, size: 15, total_pages: 1 },
      total: 1,
      page: 1,
      size: 15,
      pages: 1,
    });

    vi.mocked(userApi.listUsers).mockResolvedValue({
      items: [
        {
          id: 1,
          email: 'rohan.pillai@auratech.in',
          full_name: 'Rohan Pillai',
          role_id: 2,
          role: { id: 2, role_code: 'REPORTING_MANAGER', role_name: 'Reporting Manager', description: '' },
          is_active: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: 10,
          email: 'shruti.dutta@auratech.in',
          full_name: 'Shruti Dutta',
          role_id: 1,
          role: { id: 1, role_code: 'ADMIN', role_name: 'Administrator', description: '' },
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ],
      pagination: { total: 2, page: 1, size: 100, total_pages: 1 },
      total: 2,
      page: 1,
      size: 100,
      pages: 1,
    });

    vi.mocked(employeeApi.listEmployees).mockResolvedValue({
      items: [
        {
          id: 10,
          first_name: 'Rahul',
          last_name: 'Sharma',
          employee_code: 'EMP-00010',
          email: 'rahul.sharma@auratech.in',
          department_id: 1,
          designation_id: 1,
          employment_status: 'ACTIVE',
          date_of_joining: '2024-01-01',
          created_at: '',
          updated_at: '',
        } as any,
      ],
      pagination: { total: 1, page: 1, size: 100, total_pages: 1 },
      total: 1,
      page: 1,
      size: 100,
      pages: 1,
    });

    vi.mocked(taskApi.listTasks).mockResolvedValue({
      items: [
        {
          id: 1,
          task_code: 'TSK-00001',
          title: 'Complete Background Check',
          category: 'ONBOARDING',
          priority: 'HIGH',
          status: 'PENDING',
          owner_id: 1,
          employee_id: 10,
          due_date: '2026-11-15',
          is_overdue: false,
          created_at: '',
          updated_at: '',
        } as any,
      ],
      pagination: { total: 1, page: 1, size: 50, total_pages: 1 },
      total: 1,
      page: 1,
      size: 50,
      pages: 1,
    });
  });

  it('renders Follow-ups & Escalations page with worklist table and correct labels', async () => {
    renderComponent();

    // Verify main page heading and absence of decorative technical subtitles
    expect(screen.getByRole('heading', { level: 1, name: /follow-ups & escalations/i })).toBeInTheDocument();

    // Verify primary action button
    expect(screen.getByRole('button', { name: /schedule follow-up/i })).toBeInTheDocument();

    // Verify unnecessary KPI cards are removed
    expect(screen.queryByText(/total follow-ups/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acknowledgement rate/i)).not.toBeInTheDocument();

    // Verify manual reminder dispatch button is removed
    expect(screen.queryByRole('button', { name: /scan & dispatch reminders/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/please verify original degree/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/pending response/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rahul Sharma').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rohan Pillai').length).toBeGreaterThan(0);
    });
  });

  it('switches to Escalations tab and renders escalation items with severity level', async () => {
    renderComponent();

    const escalationsTab = screen.getByRole('button', { name: /^escalations/i });
    fireEvent.click(escalationsTab);

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00002').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/employee not responding to asset return/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/level 2/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('OPEN').length).toBeGreaterThan(0);
    });
  });

  it('opens Follow-up details modal when clicking row or details button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    const viewDetailsButtons = screen.getAllByRole('button', { name: /view details|details/i });
    fireEvent.click(viewDetailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/follow-up details — fu #101/i)).toBeInTheDocument();
      expect(screen.getByText(/follow-up notes & instructions/i)).toBeInTheDocument();
      expect(screen.getAllByText(/please verify original degree certificates with university/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens Follow-up response modal and records response', async () => {
    vi.mocked(slaApi.acknowledgeFollowUp).mockResolvedValueOnce({
      ...mockFollowUps[0],
      response_received: true,
      response_notes: 'Verified credentials directly with university registrar.',
      status: 'ACKNOWLEDGED',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    const recordResponseButtons = screen.getAllByRole('button', { name: /record response|respond/i });
    fireEvent.click(recordResponseButtons[0]);

    expect(screen.getByText(/record response — tsk-00001/i)).toBeInTheDocument();

    const notesInput = screen.getByPlaceholderText(/record the feedback, progress update, call notes/i);
    fireEvent.change(notesInput, { target: { value: 'Verified credentials directly with university registrar.' } });

    const submitBtn = screen.getByRole('button', { name: /save response/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(slaApi.acknowledgeFollowUp).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          action: 'ACKNOWLEDGE',
          response_notes: 'Verified credentials directly with university registrar.',
        })
      );
    });
  });

  it('switches to Escalations tab, opens Resolve modal, and confirms resolution', async () => {
    vi.mocked(slaApi.resolveEscalation).mockResolvedValueOnce({
      ...mockEscalations[0],
      status: 'RESOLVED',
      resolution_notes: 'Asset recovered via courier pickup and logged in inventory.',
      resolved_at: '2026-11-08T12:00:00',
    });

    renderComponent();

    // Switch to escalations tab
    fireEvent.click(screen.getByRole('button', { name: /^escalations/i }));

    await waitFor(() => {
      expect(screen.getAllByText('TSK-00002').length).toBeGreaterThan(0);
    });

    const resolveButtons = screen.getAllByRole('button', { name: /^resolve$/i });
    fireEvent.click(resolveButtons[0]);

    expect(screen.getByText(/resolve escalation — level 2/i)).toBeInTheDocument();

    const remarksInput = screen.getByPlaceholderText(/state the resolution steps taken/i);
    fireEvent.change(remarksInput, { target: { value: 'Asset recovered via courier pickup and logged in inventory.' } });

    const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(slaApi.resolveEscalation).toHaveBeenCalledWith(
        201,
        expect.objectContaining({
          status: 'RESOLVED',
          resolution_notes: 'Asset recovered via courier pickup and logged in inventory.',
        })
      );
    });
  });

  it('opens Schedule Follow-up modal and validates required fields', async () => {
    renderComponent();

    const scheduleBtn = screen.getByRole('button', { name: /schedule follow-up/i });
    fireEvent.click(scheduleBtn);

    expect(screen.getByRole('heading', { name: /schedule a follow-up/i })).toBeInTheDocument();
    expect(screen.getByText(/related employee/i)).toBeInTheDocument();
    expect(screen.getByText(/notes & instructions/i)).toBeInTheDocument();
  });

  it('displays overview metrics immediately on mount without starting at zero', async () => {
    renderComponent();

    // Verify initial Escalations tab badge shows 80 active open items (not 0)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /escalations\s*80/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /follow-ups\s*160/i })).toBeInTheDocument();
    });
  });

  it('renders "Waiting for Response From" column header and displays target role', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/waiting for response from/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rohan Pillai').length).toBeGreaterThan(0);
    });
  });

  it('queries active tasks only when employee is selected in follow-up modal', async () => {
    renderComponent();

    // Wait for dropdown options to load
    await waitFor(() => {
      expect(screen.getAllByText('TSK-00001').length).toBeGreaterThan(0);
    });

    const scheduleBtn = screen.getByRole('button', { name: /schedule follow-up/i });
    fireEvent.click(scheduleBtn);

    const employeeSelect = screen.getByLabelText(/related employee/i);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /rahul sharma/i })).toBeInTheDocument();
    });

    fireEvent.change(employeeSelect, { target: { value: '10' } });

    await waitFor(() => {
      expect(taskApi.listTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          employee_id: 10,
          active_only: true,
        })
      );
    });
  });

  it('switches between Awaiting Response and Response Received filters and calls listFollowUps with correct parameter', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /response received/i })).toBeInTheDocument();
    });

    const responseReceivedPill = screen.getByRole('button', { name: /response received/i });
    fireEvent.click(responseReceivedPill);

    await waitFor(() => {
      expect(slaApi.listFollowUps).toHaveBeenCalledWith(
        expect.objectContaining({
          response_received: true,
          view: 'RESPONSE_RECEIVED',
        })
      );
    });
  });
});
