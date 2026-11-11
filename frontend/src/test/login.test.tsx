import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import * as AuthHook from '../hooks/useAuth';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', state: { from: { pathname: '/dashboard' } } }),
  };
});

describe('LoginPage Component — Refined HR Operations Experience', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(AuthHook, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
      clearError: vi.fn(),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
  };

  it('renders the split-screen layout with HR Flow AI branding, refined headline, and 3 product cards', () => {
    renderLoginPage();

    // Verify Brand Logo and Headlines
    expect(screen.getAllByText(/HR Flow/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Welcome Back!/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to continue to your HR workspace/i)).toBeInTheDocument();

    // Verify Left Section Refined Product Narrative
    expect(screen.getByRole('heading', { name: /HR Operations, Simplified\./i })).toBeInTheDocument();
    expect(screen.getByText(/Manage employee journeys, coordinate HR tasks, and stay on top of everyday HR operations/i)).toBeInTheDocument();

    // Verify Exactly Three Product-Relevant Cards
    expect(screen.getByText(/Employee Lifecycle Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage onboarding, probation, confirmation and offboarding\./i)).toBeInTheDocument();

    expect(screen.getByText(/Task & Follow-up Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep HR activities, deadlines and follow-ups organized\./i)).toBeInTheDocument();

    expect(screen.getByText(/AI-Powered HR Assistance/i)).toBeInTheDocument();
    expect(screen.getByText(/Get operational insights, summaries and helpful recommendations\./i)).toBeInTheDocument();

    // Verify Exactly Required Footer
    expect(screen.getByText(/© 2026 HR Flow AI\. All rights reserved\./i)).toBeInTheDocument();
  });

  it('renders email and password inputs, remember me, and sign in button with clean placeholders', () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;

    expect(emailInput).toBeInTheDocument();
    expect(emailInput.placeholder).toBe('Enter your work email');

    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.placeholder).toBe('Enter your password');

    expect(screen.getByLabelText(/Remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forgot Password\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
  });

  it('validates empty email field and shows error', async () => {
    renderLoginPage();

    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter your work email address/i);
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates invalid email format and shows error', async () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'invalidemail' } });

    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a valid work email address/i);
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates empty password field when valid email is provided', async () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'neha.saxena@auratech.in' } });

    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter your password/i);
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('toggles password visibility between password and text', () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /Show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    const hideBtn = screen.getByRole('button', { name: /Hide password/i });
    fireEvent.click(hideBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('successfully logs in and redirects user', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'neha.saxena@auratech.in' } });
    fireEvent.change(passwordInput, { target: { value: 'Password@123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'neha.saxena@auratech.in',
        password: 'Password@123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('displays error alert when login credentials are invalid', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials or inactive account'));
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'unknown@auratech.in' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid credentials or inactive account/i);
    });
  });

  it('handles remember me state persistence in localStorage', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const rememberMeBox = screen.getByLabelText(/Remember me/i);
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'deepak.joshi@auratech.in' } });
    fireEvent.change(passwordInput, { target: { value: 'Password@123' } });
    fireEvent.click(rememberMeBox);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(localStorage.getItem('hrflow_remember_me')).toBe('true');
      expect(localStorage.getItem('hrflow_remembered_email')).toBe('deepak.joshi@auratech.in');
    });
  });

  it('opens and closes the Forgot Password assistance modal', async () => {
    renderLoginPage();

    const forgotBtn = screen.getByRole('button', { name: /Forgot Password\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByText(/Password Reset Assistance/i)).toBeInTheDocument();
    expect(screen.getByText(/HR Flow AI user accounts are managed internally/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Back to Sign In/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Password Reset Assistance/i)).not.toBeInTheDocument();
    });
  });

  it('opens and closes the Account Access Information modal', async () => {
    renderLoginPage();

    expect(screen.getByText(/Need access to HR Flow AI\?/i)).toBeInTheDocument();
    const accountBtn = screen.getByRole('button', { name: /Contact your HR Administrator\./i });
    fireEvent.click(accountBtn);

    expect(screen.getByText(/Account Access Request/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal HR Operations Platform/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close Window/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Account Access Request/i)).not.toBeInTheDocument();
    });
  });

  it('redirects immediately if user is already authenticated', () => {
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'admin@auratech.in',
        full_name: 'Admin User',
        role_id: 1,
        is_active: true,
        role: {
          id: 1,
          role_code: 'ADMIN',
          role_name: 'Administrator',
          is_active: true,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: mockLogin,
      logout: vi.fn(),
      clearError: vi.fn(),
    });

    renderLoginPage();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
