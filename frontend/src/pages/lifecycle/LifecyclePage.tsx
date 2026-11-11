import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  UserCheck,
  Clock,
  Award,
  FileText,
  TrendingUp,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { lifecycleApi } from '../../api/lifecycleApi';
import { LifecycleOverview } from '../../types/lifecycle';
import { LifecycleOverviewTab } from './LifecycleOverviewTab';
import { OnboardingTab } from './OnboardingTab';
import { ProbationTab } from './ProbationTab';
import { ConfirmationTab } from './ConfirmationTab';
import { DocumentationTab } from './DocumentationTab';
import { PerformanceTab } from './PerformanceTab';
import { OffboardingTab } from './OffboardingTab';

type TabKey =
  | 'overview'
  | 'onboarding'
  | 'probation'
  | 'confirmation'
  | 'documentation'
  | 'performance-reviews'
  | 'offboarding';

export const LifecyclePage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role?.role_code;

  const isAdminOrHRM = ['ADMIN', 'HR_MANAGER'].includes(userRole || '');
  const canEdit = ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE'].includes(userRole || '');
  const canVerifyDocs = ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE'].includes(userRole || '');

  const resolveTab = (param?: string): TabKey => {
    switch (param) {
      case 'onboarding':
        return 'onboarding';
      case 'probation':
        return 'probation';
      case 'confirmation':
        return 'confirmation';
      case 'documentation':
      case 'documents':
        return 'documentation';
      case 'performance-reviews':
      case 'reviews':
        return 'performance-reviews';
      case 'offboarding':
        return 'offboarding';
      default:
        return 'overview';
    }
  };

  const [activeTab, setActiveTab] = useState<TabKey>(() => resolveTab(tab));
  const [overview, setOverview] = useState<LifecycleOverview | null>(null);

  // Sync state when URL param changes
  useEffect(() => {
    const target = resolveTab(tab);
    if (target !== activeTab) {
      setActiveTab(target);
    }
  }, [tab]);

  // Fetch overview counts
  const fetchOverview = useCallback(async () => {
    try {
      const data = await lifecycleApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load lifecycle overview', err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleTabChange = (newTab: string) => {
    const resolved = resolveTab(newTab);
    setActiveTab(resolved);
    if (resolved === 'overview') {
      navigate('/lifecycle');
    } else {
      navigate(`/lifecycle/${resolved}`);
    }
  };

  const navTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { key: 'onboarding', label: 'Onboarding', icon: <UserCheck className="w-4 h-4" /> },
    { key: 'documentation', label: 'Documentation', icon: <FileText className="w-4 h-4" /> },
    { key: 'probation', label: 'Probation', icon: <Clock className="w-4 h-4" /> },
    { key: 'confirmation', label: 'Confirmation', icon: <Award className="w-4 h-4" /> },
    { key: 'performance-reviews', label: 'Performance Reviews', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'offboarding', label: 'Offboarding', icon: <LogOut className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E2DBEB]">
        <div>
          <h1 className="text-2xl sm:text-[28px] lg:text-[30px] font-extrabold text-[#1E162B] tracking-tight">
            Employee Lifecycle
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#5C5270] mt-1 font-medium">
            Manage employee onboarding, probation, reviews, documentation, confirmations and exits in one place.
          </p>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="border-b border-[#E2DBEB]">
        <nav className="flex space-x-1.5 overflow-x-auto pb-px" aria-label="Lifecycle Workspaces">
          {navTabs.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key)}
                className={`flex items-center space-x-2 py-3 px-4 text-[14px] sm:text-[15px] font-semibold rounded-t-xl transition-all duration-150 whitespace-nowrap border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-[#5425CB] text-[#5425CB] bg-[#EDE7FF]/60 font-bold'
                    : 'border-transparent text-[#5C5270] hover:text-[#1E162B] hover:border-gray-300 hover:bg-[#FAF8FE]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Workspaces Content */}
      <div className="pt-1">
        {activeTab === 'overview' && (
          <LifecycleOverviewTab
            overview={overview}
            onNavigateTab={handleTabChange}
          />
        )}

        {activeTab === 'onboarding' && (
          <OnboardingTab
            canInitiate={isAdminOrHRM}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'probation' && (
          <ProbationTab
            canEdit={canEdit}
          />
        )}

        {activeTab === 'confirmation' && (
          <ConfirmationTab
            userRole={userRole}
          />
        )}

        {activeTab === 'documentation' && (
          <DocumentationTab
            canVerify={canVerifyDocs}
          />
        )}

        {activeTab === 'performance-reviews' && (
          <PerformanceTab
            canInitiateCycle={isAdminOrHRM}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'offboarding' && (
          <OffboardingTab
            canInitiate={isAdminOrHRM}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
};
export default LifecyclePage;
