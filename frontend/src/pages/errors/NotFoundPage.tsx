import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4 border border-slate-200 shadow-subtle">
        <FileQuestion className="w-8 h-8" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-action mb-1">
        Error 404
      </span>
      <h1 className="text-2xl sm:text-3xl font-bold text-brand mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
        The operational route or resource you are looking for does not exist or has been relocated.
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

