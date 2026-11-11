import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Info,
  X,
  Users,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { HRFlowLogo } from '../../components/common/HRFlowLogo';
import { HRIllustration } from '../../components/auth/HRIllustration';

const REMEMBER_ME_KEY = 'hrflow_remember_me';
const REMEMBERED_EMAIL_KEY = 'hrflow_remembered_email';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals for Honest Enterprise Policy Guidance
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showAccountInfoModal, setShowAccountInfoModal] = useState(false);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Restore remembered email if previously checked
  useEffect(() => {
    const isRemembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    if (isRemembered) {
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim();

    // Client-side validation
    if (!cleanEmail) {
      setFormError('Please enter your work email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Please enter a valid work email address (e.g., name@company.com).');
      return;
    }

    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: cleanEmail, password });

      // Handle Remember Me persistence
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
        localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      // Redirect to the originally requested route, or default to /dashboard
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F6FB] flex items-center justify-center font-sans antialiased selection:bg-[#EDE7FF] selection:text-[#6938EF]">
      {/* Main Split-Screen Container */}
      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* =========================================================
         * LEFT SECTION: HR Product Narrative, Illustration & 3 Feature Cards
         * Visible on lg (>=1024px) screens
         * ========================================================= */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#F5F1FF] border-r border-[#E7E3EF] flex-col justify-between p-8 xl:p-12 relative overflow-hidden">
          
          {/* Top Brand Bar */}
          <div className="relative z-10 flex items-center justify-between">
            <HRFlowLogo size="md" />
          </div>

          {/* Center Group: Illustration + Headlines + 3 Product Feature Cards */}
          <div className="relative z-10 my-auto py-4 flex flex-col items-center justify-center w-full max-w-xl mx-auto">
            {/* Redesigned HR Illustration */}
            <HRIllustration className="max-w-[440px] xl:max-w-[480px]" />
            
            {/* Concise Product-Focused Headline & Supporting Text */}
            <div className="mt-5 text-center max-w-lg">
              <h2 className="text-2xl xl:text-3xl font-bold text-[#24212E] tracking-tight">
                HR Operations, Simplified.
              </h2>
              <p className="mt-2 text-sm text-[#777387] leading-relaxed">
                Manage employee journeys, coordinate HR tasks, and stay on top of everyday HR operations — all in one workspace.
              </p>
            </div>

            {/* Exactly 3 Product-Relevant Feature Cards */}
            <div className="mt-6 grid grid-cols-1 gap-2.5 w-full">
              {/* CARD 1: Employee Lifecycle Management */}
              <div className="bg-white/90 backdrop-blur-sm border border-[#E7E3EF] rounded-xl p-3 flex items-start gap-3 shadow-sm hover:border-[#DCD0FF] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#EDE7FF] text-[#6938EF] flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#24212E]">Employee Lifecycle Management</div>
                  <div className="text-[11px] text-[#777387] leading-snug mt-0.5">
                    Manage onboarding, probation, confirmation and offboarding.
                  </div>
                </div>
              </div>

              {/* CARD 2: Task & Follow-up Tracking */}
              <div className="bg-white/90 backdrop-blur-sm border border-[#E7E3EF] rounded-xl p-3 flex items-start gap-3 shadow-sm hover:border-[#DCD0FF] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#EDE7FF] text-[#6938EF] flex items-center justify-center shrink-0 mt-0.5">
                  <ListChecks className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#24212E]">Task & Follow-up Tracking</div>
                  <div className="text-[11px] text-[#777387] leading-snug mt-0.5">
                    Keep HR activities, deadlines and follow-ups organized.
                  </div>
                </div>
              </div>

              {/* CARD 3: AI-Powered HR Assistance */}
              <div className="bg-white/90 backdrop-blur-sm border border-[#E7E3EF] rounded-xl p-3 flex items-start gap-3 shadow-sm hover:border-[#DCD0FF] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#EDE7FF] text-[#6938EF] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#24212E]">AI-Powered HR Assistance</div>
                  <div className="text-[11px] text-[#777387] leading-snug mt-0.5">
                    Get operational insights, summaries and helpful recommendations.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer: Minimal & Clean */}
          <div className="relative z-10 pt-4 text-xs text-[#777387]">
            <span>Designed for HR teams and operations managers.</span>
          </div>
        </div>

        {/* =========================================================
         * RIGHT SECTION: Clean, Focused Login Form Surface
         * Mobile and Desktop
         * ========================================================= */}
        <div className="col-span-1 lg:col-span-6 xl:col-span-5 bg-white flex flex-col justify-between p-6 sm:p-10 md:p-12 xl:p-16 relative">
          
          {/* Mobile Top Brand Header */}
          <div className="lg:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#E7E3EF]">
            <HRFlowLogo size="sm" />
          </div>

          {/* Login Form Wrapper */}
          <div className="w-full max-w-md mx-auto my-auto py-2">
            
            {/* Desktop Brand Logo */}
            <div className="hidden lg:block mb-8">
              <HRFlowLogo size="md" />
            </div>

            {/* Welcome Headings */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#24212E] tracking-tight">
                Welcome Back!
              </h1>
              <p className="text-sm text-[#777387] mt-1.5 leading-relaxed">
                Sign in to continue to your HR workspace.
              </p>
            </div>

            {/* Error Alert Display */}
            {formError && (
              <div
                role="alert"
                className="mb-6 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-3 text-xs text-[#DC4545] animate-fadeIn transition-all"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{formError}</div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-[#DC4545] hover:opacity-75 transition-opacity"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Main Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              {/* Field 1: Work Email Address */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-[#24212E] uppercase tracking-wider"
                >
                  Email Address <span className="text-[#DC4545]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-[#777387] flex items-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter your work email"
                    className="w-full h-11 pl-10 pr-4 text-sm text-[#24212E] bg-white border border-[#E7E3EF] rounded-lg shadow-sm placeholder:text-[#A09BAE] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6938EF]/20 focus:border-[#6938EF] hover:border-[#DCD0FF]"
                  />
                </div>
              </div>

              {/* Field 2: Password with Show/Hide Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-[#24212E] uppercase tracking-wider"
                  >
                    Password <span className="text-[#DC4545]">*</span>
                  </label>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-[#777387] flex items-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter your password"
                    className="w-full h-11 pl-10 pr-11 text-sm text-[#24212E] bg-white border border-[#E7E3EF] rounded-lg shadow-sm placeholder:text-[#A09BAE] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6938EF]/20 focus:border-[#6938EF] hover:border-[#DCD0FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 p-1 text-[#777387] hover:text-[#24212E] transition-colors focus:outline-none focus:ring-1 focus:ring-[#6938EF] rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Utility Row: Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                {/* Remember Me Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E7E3EF] text-[#6938EF] focus:ring-[#6938EF] focus:ring-offset-0 cursor-pointer accent-[#6938EF]"
                  />
                  <span className="text-xs text-[#777387] group-hover:text-[#24212E] transition-colors">
                    Remember me
                  </span>
                </label>

                {/* Forgot Password Link */}
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-xs font-semibold text-[#6938EF] hover:text-[#5425CB] transition-colors focus:outline-none focus:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Primary Sign In Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 px-6 rounded-lg font-semibold text-sm text-white shadow-lavender-btn hover:shadow-lavender-hover transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#6938EF] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, #6938EF 0%, #8056F5 100%)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4 ml-0.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Account Access Messaging */}
            <div className="mt-8 pt-6 border-t border-[#E7E3EF] text-center">
              <p className="text-xs text-[#777387]">
                Need access to HR Flow AI?{' '}
                <button
                  type="button"
                  onClick={() => setShowAccountInfoModal(true)}
                  className="font-semibold text-[#6938EF] hover:text-[#5425CB] underline-offset-2 hover:underline transition-colors"
                >
                  Contact your HR Administrator.
                </button>
              </p>
            </div>
          </div>

          {/* Exact Required Footer */}
          <div className="w-full text-center text-xs text-[#777387] pt-6">
            &copy; 2026 HR Flow AI. All rights reserved.
          </div>
        </div>
      </div>

      {/* =========================================================
       * MODAL 1: Forgot Password Assistance
       * Honest handling of internal credentials
       * ========================================================= */}
      {showForgotPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgotPasswordTitle"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-[#E7E3EF] relative">
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#777387] hover:bg-[#F5F1FF] hover:text-[#24212E] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EDE7FF] text-[#6938EF] flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="forgotPasswordTitle" className="text-base font-bold text-[#24212E]">
                  Password Reset Assistance
                </h3>
                <p className="text-xs text-[#777387]">HR Operations Helpdesk</p>
              </div>
            </div>

            <p className="text-xs text-[#777387] leading-relaxed mb-4">
              HR Flow AI user accounts are managed internally. Self-service password resets are disabled. To reset your credentials, please contact your internal HR Administrator or IT Helpdesk.
            </p>

            <div className="p-3.5 rounded-xl bg-[#F5F1FF] border border-[#DCD0FF] mb-5 text-xs text-[#24212E]">
              <span className="font-semibold text-[#6938EF] block mb-1">Standard Procedure</span>
              <span>Your HR Administrator can securely generate a temporary password or reset link for your account.</span>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="w-full h-10 rounded-lg bg-[#6938EF] text-white text-xs font-semibold hover:bg-[#5425CB] transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
       * MODAL 2: Account Access Information
       * Explaining administrator-provisioned internal accounts
       * ========================================================= */}
      {showAccountInfoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="accountInfoTitle"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-[#E7E3EF] relative">
            <button
              onClick={() => setShowAccountInfoModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#777387] hover:bg-[#F5F1FF] hover:text-[#24212E] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EDE7FF] text-[#6938EF] flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 id="accountInfoTitle" className="text-base font-bold text-[#24212E]">
                  Account Access Request
                </h3>
                <p className="text-xs text-[#777387]">Internal HR Operations Platform</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#777387] leading-relaxed mb-5">
              <p>
                HR Flow AI is an internal platform for HR teams, managers, and authorized personnel. Accounts are created and provisioned directly by your organization's HR leadership.
              </p>
              <div className="p-3 rounded-lg bg-[#F7F6FB] border border-[#E7E3EF] space-y-1.5">
                <div className="font-semibold text-[#24212E]">How to get access:</div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#777387]">
                  <li>Contact your designated HR Operations Administrator.</li>
                  <li>Request assignment to your department role (HR Manager, HR Executive, or Reporting Manager).</li>
                  <li>Your credentials will be sent to your company email address.</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAccountInfoModal(false)}
              className="w-full h-10 rounded-lg bg-[#6938EF] text-white text-xs font-semibold hover:bg-[#5425CB] transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
