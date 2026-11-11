import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-status-danger-bg flex items-center justify-center text-status-danger mb-4 border border-status-danger-border shadow-subtle">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-status-danger mb-1">
        Error 403 • Access Restricted
      </span>
      <h1 className="text-2xl sm:text-3xl font-bold text-brand mb-2">
        Unauthorized Operational Area
      </h1>
      <p className="text-sm text-text-secondary max-w-md mb-2 leading-relaxed">
        Your current role (<strong>{user?.role?.role_code || 'User'}</strong>) does not have authorization to access this operational module.
      </p>
      <p className="text-xs text-text-muted max-w-md mb-6">
        Please contact your platform administrator if you believe your user profile requires elevated operational permissions.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="md" onClick={() => navigate(-1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Go Back
        </Button>
        <Button variant="primary" size="md" onClick={() => navigate('/dashboard')} leftIcon={<Home className="w-4 h-4" />}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

