import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmployeesPage } from '../pages/employees/EmployeesPage';
import { EmployeeProfilePage } from '../pages/employees/EmployeeProfilePage';
import { employeeApi } from '../api/employeeApi';
import * as AuthContext from '../context/AuthContext';
import { Role } from '../types/auth';
import {
  Employee,
  EmployeeProfile,
  EmployeeFilterOptions,
} from '../types/employee';

vi.mock('../api/employeeApi');
vi.mock('../context/AuthContext');

const mockAdminRole: Role = {
  id: 1,
  role_code: 'ADMIN',
  role_name: 'Administrator',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockExecutiveRole: Role = {
  id: 3,
  role_code: 'HR_EXECUTIVE',
  role_name: 'HR Executive',
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
};

const mockEmployees: Employee[] = [
  {
    id: 101,
    employee_code: 'EMP-00101',
    first_name: 'Aditi',
    last_name: 'Sharma',
    email: 'aditi.sharma@auratech.in',
    phone_number: '+91 98765 10101',
    department_id: 2,
    department_name: 'Engineering',
    designation: 'Senior Backend Engineer',
    location: 'Bengaluru',
    employment_status: 'CONFIRMED',
    date_of_joining: '2024-02-15',
    manager_id: 1,
    manager_name: 'Rajesh Kumar',
    current_lifecycle_stage: null,
    created_at: '2024-02-15T00:00:00',
    updated_at: '2024-02-15T00:00:00',
  },
  {
    id: 102,
    employee_code: 'EMP-00102',
    first_name: 'Rohan',
    last_name: 'Mehta',
    email: 'rohan.mehta@auratech.in',
    phone_number: '+91 98765 10102',
    department_id: 3,
    department_name: 'Product',
    designation: 'Product Manager',
    location: 'Hyderabad',
    employment_status: 'PROBATION',
    date_of_joining: '2026-09-01',
    manager_id: 2,
    manager_name: 'Priya Nair',
    current_lifecycle_stage: 'PROBATION',
    created_at: '2026-09-01T00:00:00',
    updated_at: '2026-09-01T00:00:00',
  },
];

const mockFilterOptions: EmployeeFilterOptions = {
  designations: ['Product Manager', 'Senior Backend Engineer'],
  managers: [
    { id: 1, name: 'Rajesh Kumar', designation: 'Engineering Director' },
    { id: 2, name: 'Priya Nair', designation: 'VP of Product' },
  ],
  departments: [
    { id: 2, name: 'Engineering' },
    { id: 3, name: 'Product' },
  ],
  employment_statuses: ['ACTIVE', 'CONFIRMED', 'NOTICE_PERIOD', 'PROBATION', 'RESIGNED'],
};

const mockProfile: EmployeeProfile = {
  employee: mockEmployees[0],
  current_lifecycle_stage: 'CONFIRMED',
  lifecycle_history: [
    {
      id: 1,
      employee_id: 101,
      current_stage: 'CONFIRMED',
      stage_start_date: '2024-05-15',
      stage_target_date: '2024-05-15',
      stage_status: 'COMPLETED',
      notes: 'Confirmation approved',
      created_at: '2024-05-15T00:00:00',
    },
  ],
  onboarding: {
    id: 1,
    employee_id: 101,
    start_date: '2024-02-15',
    target_completion_date: '2024-03-15',
    it_asset_status: 'DELIVERED',
    bgv_status: 'VERIFIED',
    orientation_completed: true,
    overall_status: 'COMPLETED',
  },
  onboarding_checklist: [],
  probation: {
    id: 1,
    employee_id: 101,
    probation_start_date: '2024-02-15',
    probation_end_date: '2024-05-15',
    status: 'COMPLETED',
  },
  confirmation: {
    id: 1,
    probation_record_id: 1,
    employee_id: 101,
    confirmation_due_date: '2024-05-15',
    effective_confirmation_date: '2024-05-15',
    confirmation_letter_issued: true,
    status: 'CONFIRMED',
  },
  documents: [
    {
      id: 1,
      employee_id: 101,
      requirement_id: 1,
      document_name: 'aadhaar_card.pdf',
      file_path: '/docs/101/aadhaar.pdf',
      submission_date: '2024-02-16',
      status: 'VERIFIED',
      requirement_name: 'Government Photo ID',
    },
  ],
  performance_reviews: [
    {
      id: 1,
      employee_id: 101,
      review_cycle: 'FY2025-Q4',
      reviewer_id: 1,
      self_review_status: 'COMPLETED',
      manager_review_status: 'COMPLETED',
      rating: 4.5,
      review_submission_deadline: '2025-12-31',
      status: 'COMPLETED',
    },
  ],
  offboarding: null,
  hr_tasks: [
    {
      id: 501,
      task_code: 'TSK-00501',
      title: 'Annual Performance Appraisal Review',
      category: 'PERFORMANCE',
      priority: 'HIGH',
      status: 'COMPLETED',
      due_date: '2025-12-31',
      owner_id: 1,
      owner_name: 'Rajesh Kumar',
      is_subject: true,
      link_path: '/performance',
    },
  ],
  assigned_tasks: [],
  tasks: [],
  pending_actions: [],
  activity_history: [
    {
      id: 1001,
      action: 'STATUS_CHANGE',
      entity_type: 'EMPLOYEE',
      entity_id: 101,
      user_id: 1,
      user_name: 'Rajesh Kumar',
      details: { from: 'PROBATION', to: 'CONFIRMED' },
      created_at: '2024-05-15T10:00:00',
    },
  ],
  can_edit: true,
};

describe('EmployeesPage (Directory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeeApi.getFilterOptions).mockResolvedValue(mockFilterOptions);
    vi.mocked(employeeApi.listEmployees).mockResolvedValue({
      items: mockEmployees,
      total: 2,
      page: 1,
      size: 12,
      pages: 1,
      pagination: {
        page: 1,
        size: 12,
        total: 2,
        total_pages: 1,
      },
    });
  });

  it('renders directory heading, subtitle and employee cards for ADMIN', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@auratech.in', full_name: 'Aditi Rao', role: mockAdminRole, is_active: true } as any,
      isAuthenticated: true,
      isLoading: false,
      token: 'admin-token',
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/employees']}>
        <Routes>
          <Route path="/employees" element={<EmployeesPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Employee Directory')).toBeInTheDocument();
    expect(screen.getByText(/Find employee information/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/of 2 employees/i)).toBeInTheDocument();
      expect(screen.getByText('Aditi Sharma')).toBeInTheDocument();
      expect(screen.getByText('EMP-00101')).toBeInTheDocument();
      expect(screen.getAllByText('Senior Backend Engineer').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
      expect(screen.getByText('EMP-00102')).toBeInTheDocument();
    });

    // Check primary action "Add Employee" visible to ADMIN
    expect(screen.getByRole('button', { name: /Add Employee/i })).toBeInTheDocument();

    // Verify lifecycle indicator when applicable (Rohan Mehta is Under Probation)
    expect(screen.getByText(/Under Probation/i)).toBeInTheDocument();
  });

  it('hides "Add Employee" button and Edit action for HR_EXECUTIVE', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 3, email: 'kavita.iyer@auratech.in', full_name: 'Kavita Iyer', role: mockExecutiveRole, is_active: true } as any,
      isAuthenticated: true,
      isLoading: false,
      token: 'exec-token',
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/employees']}>
        <Routes>
          <Route path="/employees" element={<EmployeesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aditi Sharma')).toBeInTheDocument();
    });

    // "Add Employee" should NOT be rendered for HR_EXECUTIVE
    expect(screen.queryByRole('button', { name: /Add Employee/i })).not.toBeInTheDocument();

    // "Edit" action should NOT be visible on cards for HR_EXECUTIVE
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
  });
});

describe('EmployeeProfilePage (Centralized Profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeeApi.getFilterOptions).mockResolvedValue(mockFilterOptions);
    vi.mocked(employeeApi.getEmployeeProfile).mockResolvedValue(mockProfile);
  });

  it('renders employee profile header, employment details, 6 lifecycle processes, and audit log', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 1, email: 'admin@auratech.in', full_name: 'Aditi Rao', role: mockAdminRole, is_active: true } as any,
      isAuthenticated: true,
      isLoading: false,
      token: 'admin-token',
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/employees/101']}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Aditi Sharma')).toBeInTheDocument();
      expect(screen.getAllByText('EMP-00101').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Confirmed Full-Time')).toBeInTheDocument();
      expect(screen.getByText('aditi.sharma@auratech.in')).toBeInTheDocument();
    });

    // Check tabs
    expect(screen.getByText(/Employment Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Lifecycle Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Actions & Tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Documents & Compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/Activity Log/i)).toBeInTheDocument();

    // Click on Lifecycle Journey tab
    fireEvent.click(screen.getByText(/Lifecycle Journey/i));
    expect(screen.getByText(/1. Onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Probation/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/4. Documentation/i)).toBeInTheDocument();
    expect(screen.getByText(/5. Performance Reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/6. Offboarding/i)).toBeInTheDocument();

    // Click on Activity Log tab
    fireEvent.click(screen.getByText(/Activity Log/i));
    expect(screen.getByText(/STATUS_CHANGE — EMPLOYEE/i)).toBeInTheDocument();
  });
});
