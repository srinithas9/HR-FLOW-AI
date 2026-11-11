import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import * as AuthContext from '../context/AuthContext';
import { Role, RoleCode } from '../types/auth';

vi.mock('../context/AuthContext');

const createMockRole = (roleCode: RoleCode, roleName: string): Role => ({
  id: roleCode === 'ADMIN' ? 1 : roleCode === 'HR_MANAGER' ? 2 : roleCode === 'HR_EXECUTIVE' ? 3 : 4,
  role_code: roleCode,
  role_name: roleName,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
});

const mockLogout = vi.fn();

const setupAuthMock = (roleCode: RoleCode, roleName: string) => {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: {
      id: 10,
      email: `${roleCode.toLowerCase()}@auratech.com`,
      full_name: `${roleName} User`,
      role_id: 1,
      role: createMockRole(roleCode, roleName),
      employee_id: 101,
      is_active: true,
      last_login_at: '2026-11-09T08:00:00',
      created_at: '2026-01-01T00:00:00',
    },
    isAuthenticated: true,
    isLoading: false,
    token: 'mock-jwt-token',
    login: vi.fn(),
    logout: mockLogout,
    clearError: vi.fn(),
    error: null,
  });
};

describe('Sidebar Component & Consolidated Navigation Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required 7 navigation entries for ADMIN role', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    // 1. HR Dashboard
    expect(screen.getAllByText('HR Dashboard').length).toBeGreaterThanOrEqual(1);

    // 2. Employee Management
    expect(screen.getByText('Employee Management')).toBeInTheDocument();

    // 3. Employee Lifecycle
    expect(screen.getAllByText('Employee Lifecycle').length).toBeGreaterThanOrEqual(1);

    // 4. Task Management
    expect(screen.getByText('Task Management')).toBeInTheDocument();

    // 5. Follow-ups & Escalations
    expect(screen.getByText('Follow-ups & Escalations')).toBeInTheDocument();

    // 6. HR Insights & Assistance (expandable parent)
    expect(screen.getAllByText('HR Insights & Assistance').length).toBeGreaterThanOrEqual(1);

    // 7. Administration & User Administration (ADMIN only)
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('User Administration')).toBeInTheDocument();

    // 8. Settings
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Verification of removed items:
    // A. My Daily Actions must be removed
    expect(screen.queryByText('My Daily Actions')).not.toBeInTheDocument();

    // B. Standalone duplicate entries removed
    expect(screen.queryByText('ML Intelligence')).not.toBeInTheDocument();
    expect(screen.queryByText('Operational Analytics')).not.toBeInTheDocument();

    // User details in footer
    expect(screen.getByText('System Admin User')).toBeInTheDocument();
    expect(screen.getByText('System Admin')).toBeInTheDocument();
  });

  it('renders consolidated navigation for HR_MANAGER role', () => {
    setupAuthMock('HR_MANAGER', 'HR Manager');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('HR Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Employee Management')).toBeInTheDocument();
    expect(screen.getAllByText('Employee Lifecycle').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Task Management')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups & Escalations')).toBeInTheDocument();
    expect(screen.getAllByText('HR Insights & Assistance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Removed / RBAC restricted entries
    expect(screen.queryByText('My Daily Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('User Administration')).not.toBeInTheDocument();
  });

  it('renders consolidated navigation for HR_EXECUTIVE role', () => {
    setupAuthMock('HR_EXECUTIVE', 'HR Executive');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('HR Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Employee Management')).toBeInTheDocument();
    expect(screen.getAllByText('Employee Lifecycle').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Task Management')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups & Escalations')).toBeInTheDocument();
    expect(screen.getAllByText('HR Insights & Assistance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();

    expect(screen.queryByText('My Daily Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('User Administration')).not.toBeInTheDocument();
  });

  it('renders consolidated navigation for REPORTING_MANAGER role', () => {
    setupAuthMock('REPORTING_MANAGER', 'Reporting Manager');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('HR Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Employee Management')).toBeInTheDocument();
    expect(screen.getAllByText('Employee Lifecycle').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Task Management')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups & Escalations')).toBeInTheDocument();
    expect(screen.getAllByText('HR Insights & Assistance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // CRITICAL RBAC GUARDS:
    expect(screen.queryByText('My Daily Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('User Administration')).not.toBeInTheDocument();
  });

  it('expands and collapses the HR Insights & Assistance accordion revealing both child pages', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    // Click HR Insights & Assistance accordion button
    const insightsBtn = screen.getByRole('button', { name: /hr insights & assistance/i });
    fireEvent.click(insightsBtn);

    // Both child pages must appear as sibling entries
    expect(screen.getByText('HR Operations Insights')).toBeInTheDocument();
    expect(screen.getByText('HR Operations Copilot')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(insightsBtn);
    expect(screen.queryByText('HR Operations Insights')).not.toBeInTheDocument();
    expect(screen.queryByText('HR Operations Copilot')).not.toBeInTheDocument();
  });

  it('auto-expands HR Insights & Assistance when on /insights canonical route', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/insights']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('HR Operations Insights')).toBeInTheDocument();
    expect(screen.getByText('HR Operations Copilot')).toBeInTheDocument();
  });

  it('expands and collapses the Employee Lifecycle accordion revealing all 6 core sub-stages', () => {
    setupAuthMock('HR_MANAGER', 'HR Manager');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    // Initial state on /dashboard: accordion is closed
    expect(screen.queryByText('1. Onboarding')).not.toBeInTheDocument();

    // Click Employee Lifecycle accordion button
    const lifecycleButton = screen.getByRole('button', { name: /employee lifecycle/i });
    fireEvent.click(lifecycleButton);

    // Now all 6 sub-stages + overview should be visible
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Probation')).toBeInTheDocument();
    expect(screen.getByText('Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Performance Reviews')).toBeInTheDocument();
    expect(screen.getByText('Offboarding')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(lifecycleButton);
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
  });

  it('auto-expands Employee Lifecycle accordion when initial route is inside /lifecycle', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/lifecycle/probation']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Probation')).toBeInTheDocument();
    expect(screen.getByText('Confirmation')).toBeInTheDocument();
  });

  it('calls logout callback when Sign Out button is clicked', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={false} />
      </MemoryRouter>
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders collapsed sidebar in icon-only mode with tooltips', () => {
    setupAuthMock('ADMIN', 'System Admin');

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isOpen={true} onClose={vi.fn()} isCollapsed={true} onToggleCollapse={vi.fn()} />
      </MemoryRouter>
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('lg:w-[72px]');
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
  });
});

describe('Header Component & Application Shell Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders clean top navigation with breadcrumbs and title without duplicate profile controls in Header', () => {
    setupAuthMock('HR_MANAGER', 'HR Manager');

    render(
      <MemoryRouter initialEntries={['/action-center']}>
        <Header onToggleSidebar={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('Task Management').length).toBeGreaterThanOrEqual(1);
    // Profile controls are removed from Header to avoid duplication with sidebar
    expect(screen.queryByRole('button', { name: /user profile menu/i })).not.toBeInTheDocument();
  });

  it('preserves clean top bar on dashboard and keeps user profile in sidebar', () => {
    setupAuthMock('ADMIN', 'System Admin');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Header onToggleSidebar={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('HR Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /user profile menu/i })).not.toBeInTheDocument();
  });

  it('triggers mobile sidebar toggle when hamburger button is clicked', () => {
    setupAuthMock('ADMIN', 'System Admin');
    const mockToggle = vi.fn();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Header onToggleSidebar={mockToggle} />
      </MemoryRouter>
    );

    const hamburger = screen.getByRole('button', { name: /toggle mobile navigation menu/i });
    fireEvent.click(hamburger);

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
