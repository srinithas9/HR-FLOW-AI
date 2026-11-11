import React from 'react';
import {
  UserCheck,
  Clock,
  Award,
  FileText,
  TrendingUp,
  LogOut,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { LifecycleOverview, ProcessCardMetric } from '../../types/lifecycle';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface LifecycleOverviewTabProps {
  overview: LifecycleOverview | null;
  onNavigateTab: (tab: string) => void;
}

export const LifecycleOverviewTab: React.FC<LifecycleOverviewTabProps> = ({
  overview,
  onNavigateTab,
}) => {
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'ONBOARDING':
        return <UserCheck className="w-5 h-5 text-indigo-600" />;
      case 'PROBATION':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'CONFIRMATION':
        return <Award className="w-5 h-5 text-purple-600" />;
      case 'DOCUMENTATION':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'PERFORMANCE':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'OFFBOARDING':
        return <LogOut className="w-5 h-5 text-rose-600" />;
      default:
        return <Layers className="w-5 h-5 text-[#5425CB]" />;
    }
  };

  const getStageRoute = (stage: string) => {
    switch (stage) {
      case 'ONBOARDING':
        return 'onboarding';
      case 'PROBATION':
        return 'probation';
      case 'CONFIRMATION':
        return 'confirmation';
      case 'DOCUMENTATION':
        return 'documentation';
      case 'PERFORMANCE':
        return 'performance-reviews';
      case 'OFFBOARDING':
        return 'offboarding';
      default:
        return 'overview';
    }
  };

  const getButtonLabel = (stage: string) => {
    switch (stage) {
      case 'ONBOARDING':
        return 'View Onboarding';
      case 'PROBATION':
        return 'View Probation';
      case 'CONFIRMATION':
        return 'View Confirmation';
      case 'DOCUMENTATION':
        return 'View Documents';
      case 'PERFORMANCE':
        return 'View Reviews';
      case 'OFFBOARDING':
        return 'View Offboarding';
      default:
        return 'View Workspace';
    }
  };

  // Real data cards calculated from overview or default zero states
  const defaultCards: ProcessCardMetric[] = [
    {
      stage: 'ONBOARDING',
      title: 'Onboarding',
      description: 'Coordinate new hire joining, equipment provisioning, background verification, and company orientation.',
      primary_count: overview?.onboarding_active ?? 0,
      primary_label: 'In Progress',
      secondary_count: 0,
      secondary_label: 'Completed',
      action_required_count: overview?.onboarding_active ?? 0,
      action_required_label: 'Action Required',
    },
    {
      stage: 'DOCUMENTATION',
      title: 'Documentation',
      description: 'Collect, review, and verify employee identity, education, and statutory compliance documents.',
      primary_count: 0,
      primary_label: 'Verified Docs',
      secondary_count: 0,
      secondary_label: 'Total Documents',
      action_required_count: 0,
      action_required_label: 'Requires Verification',
    },
    {
      stage: 'PROBATION',
      title: 'Probation',
      description: 'Track evaluation milestones, manager feedback, and probation extension or completion decisions.',
      primary_count: overview?.probation_active ?? 0,
      primary_label: 'Under Review',
      secondary_count: overview?.confirmed_employees ?? 0,
      secondary_label: 'Confirmed',
      action_required_count: 0,
      action_required_label: 'Review Due Soon',
    },
    {
      stage: 'CONFIRMATION',
      title: 'Confirmation',
      description: 'Review manager recommendations, record HR decisions, and issue confirmation letters.',
      primary_count: overview?.confirmation_pending ?? 0,
      primary_label: 'Pending Decision',
      secondary_count: overview?.confirmed_employees ?? 0,
      secondary_label: 'Confirmed',
      action_required_count: overview?.confirmation_pending ?? 0,
      action_required_label: 'Action Required',
    },
    {
      stage: 'PERFORMANCE',
      title: 'Performance Reviews',
      description: 'Manage appraisal cycles, employee self-reviews, manager evaluations, and performance ratings.',
      primary_count: overview?.performance_reviews_in_progress ?? 0,
      primary_label: 'Active Reviews',
      secondary_count: 0,
      secondary_label: 'Completed',
      action_required_count: 0,
      action_required_label: 'Reviews Pending',
    },
    {
      stage: 'OFFBOARDING',
      title: 'Offboarding',
      description: 'Coordinate resignation handover, knowledge transfer, company equipment return, and exit clearances.',
      primary_count: overview?.offboarding_in_progress ?? 0,
      primary_label: 'In Progress',
      secondary_count: 0,
      secondary_label: 'Completed',
      action_required_count: overview?.offboarding_in_progress ?? 0,
      action_required_label: 'Clearance Pending',
    },
  ];

  const stageOrder = ['ONBOARDING', 'DOCUMENTATION', 'PROBATION', 'CONFIRMATION', 'PERFORMANCE', 'OFFBOARDING'];
  const rawCards = overview?.process_cards && overview.process_cards.length === 6
    ? overview.process_cards
    : defaultCards;

  const cards = [...rawCards].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));

  return (
    <div className="space-y-6">
      {/* 6 Process Cards Grid (3 columns on desktop, 2 on tablet, 1 on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const tabKey = getStageRoute(card.stage);
          const buttonLabel = getButtonLabel(card.stage);
          return (
            <Card
              key={card.stage}
              className="group border border-[#E2DBEB] hover:border-[#5425CB]/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between bg-white rounded-2xl"
            >
              <CardHeader className="p-6 pb-4 border-b border-[#E2DBEB]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[#F3EBFB] flex items-center justify-center border border-[#5425CB]/20 shrink-0">
                      {getStageIcon(card.stage)}
                    </div>
                    <div>
                      <CardTitle className="text-[17px] sm:text-[18px] font-extrabold text-[#1E162B] group-hover:text-[#5425CB] transition-colors">
                        {card.title}
                      </CardTitle>
                    </div>
                  </div>
                  {card.action_required_count > 0 ? (
                    <Badge variant="warning" className="text-[12px] sm:text-[13px] px-3 py-1 font-bold">
                      {card.action_required_count} {card.action_required_label}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-[12px] sm:text-[13px] text-[#5C5270] px-3 py-1 border-[#E2DBEB]">
                      All clear
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-5 flex-1 flex flex-col justify-between">
                <p className="text-[14px] text-[#5C5270] leading-relaxed mb-5 min-h-[44px] font-medium">
                  {card.description}
                </p>

                {/* Primary & Secondary Metric Strip */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#FAF8FE] border border-[#E2DBEB] mb-5">
                  <div>
                    <div className="text-2xl sm:text-[30px] font-extrabold font-mono text-[#1E162B] tracking-tight">
                      {card.primary_count}
                    </div>
                    <div className="text-[12px] sm:text-[13px] font-bold text-[#5C5270] uppercase tracking-wider mt-1">
                      {card.primary_label}
                    </div>
                  </div>
                  <div className="border-l border-[#E2DBEB] pl-4">
                    <div className="text-2xl sm:text-[30px] font-extrabold font-mono text-[#5C5270] tracking-tight">
                      {card.secondary_count}
                    </div>
                    <div className="text-[12px] sm:text-[13px] font-bold text-[#796F8F] uppercase tracking-wider mt-1">
                      {card.secondary_label}
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <Button
                  variant="outline"
                  size="md"
                  className="w-full justify-between hover:bg-[#5425CB] hover:text-white hover:border-[#5425CB] transition-colors text-[14px] sm:text-[15px] font-bold h-11 px-5 rounded-xl border-[#DCD5E8] text-[#1E162B] cursor-pointer"
                  onClick={() => onNavigateTab(tabKey)}
                >
                  <span>{buttonLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
