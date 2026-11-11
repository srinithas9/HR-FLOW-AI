import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  UserCheck,
  Clock,
  Award,
  UserMinus,
  ExternalLink,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { MilestoneItem } from '../../types/dashboard';

interface UpcomingMilestonesProps {
  milestones: MilestoneItem[];
  isLoading?: boolean;
}

export const UpcomingMilestones: React.FC<UpcomingMilestonesProps> = ({ milestones, isLoading }) => {
  const navigate = useNavigate();

  // Milestone Detail Modal state
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenMilestone = (m: MilestoneItem) => {
    setSelectedMilestone(m);
    setIsModalOpen(true);
  };

  const handleCloseMilestone = () => {
    setIsModalOpen(false);
    setSelectedMilestone(null);
  };

  const getMilestoneCategory = (type?: string) => {
    switch (type) {
      case 'NEW_JOINER':
        return {
          label: 'New Joiner',
          style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: UserCheck,
          description: 'Employee joining date milestone. Ensure workstation, accounts, and initial welcome plan are active.',
        };
      case 'ONBOARDING_COMPLETION':
        return {
          label: 'Onboarding',
          style: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: UserCheck,
          description: 'Scheduled onboarding completion deadline. Verify all initial checklist tasks and orientation sessions are finished.',
        };
      case 'PROBATION_END':
        return {
          label: 'Probation Review',
          style: 'bg-amber-50 text-amber-900 border-amber-200',
          icon: Clock,
          description: 'Employee probation evaluation milestone. Manager assessment and performance feedback must be submitted.',
        };
      case 'CONFIRMATION_DUE':
        return {
          label: 'Confirmation',
          style: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: Award,
          description: 'Formal confirmation decision deadline. HR and managerial sign-offs are required before this target date.',
        };
      case 'PERFORMANCE_DEADLINE':
        return {
          label: 'Performance Review',
          style: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: Award,
          description: 'Annual or periodic performance review cycle deadline. Ensure self-assessment and manager ratings are filed.',
        };
      case 'OFFBOARDING_EXIT':
        return {
          label: 'Last Working Day',
          style: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: UserMinus,
          description: 'Employee final exit milestone. Confirm asset recovery, departmental clearances, and exit interview completion.',
        };
      default:
        return {
          label: type || 'Operational Milestone',
          style: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Calendar,
          description: 'Scheduled employee lifecycle milestone requiring operational tracking and timely completion.',
        };
    }
  };

  const formatDateDisplay = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return String(dateStr);
    }
  };

  const selectedCategoryMeta = selectedMilestone
    ? getMilestoneCategory(selectedMilestone.milestone_type)
    : null;

  return (
    <div className="bg-white border border-[#E2DBEB] rounded-2xl shadow-2xs p-6 sm:p-7 space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2DBEB]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF8FE] border border-[#E2DBEB] flex items-center justify-center text-[#5425CB] shrink-0 shadow-2xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-[22px] font-extrabold text-[#1E162B] tracking-tight">
              Upcoming Milestones
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#5C5270] font-medium mt-0.5">
              Operational deadlines scheduled in the next 30 calendar days
            </p>
          </div>
        </div>

        <span className="self-start sm:self-auto text-[13px] sm:text-[14px] font-bold text-[#5425CB] bg-[#F3EBFB] px-4 py-1.5 rounded-full border border-[#DDD1FA] font-mono">
          {milestones.length} Scheduled
        </span>
      </div>

      {/* Content — Structured List layout using available width */}
      {isLoading ? (
        <div className="py-12 text-center text-sm sm:text-[15px] text-[#5C5270] space-y-2">
          <Clock className="w-6 h-6 mx-auto animate-spin text-[#5425CB]" />
          <p className="font-semibold">Loading upcoming milestones...</p>
        </div>
      ) : milestones.length === 0 ? (
        <div className="py-12 text-center text-[15px] text-[#5C5270] font-medium">
          No upcoming employee milestones in the selected period.
        </div>
      ) : (
        <div className="divide-y divide-[#E2DBEB]">
          {milestones.map((m) => {
            const cat = getMilestoneCategory(m.milestone_type);
            const CatIcon = cat.icon;

            return (
              <div
                key={m.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8FE]/80 px-3 rounded-xl transition-colors"
              >
                {/* Left: Stage pill, Milestone title, Employee info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cat.style}`}>
                    <CatIcon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-[15px] sm:text-[16px] text-[#1E162B]">
                        {m.title}
                      </span>
                      <span className={`text-[12px] sm:text-[13px] font-bold px-2.5 py-0.5 rounded-full border ${cat.style}`}>
                        {cat.label}
                      </span>
                    </div>

                    <div className="text-[14px] text-[#5C5270] flex items-center gap-2 mt-1 font-medium">
                      <button
                        type="button"
                        onClick={() => m.employee_id && navigate(`/employees/${m.employee_id}`)}
                        className="font-semibold text-[#1E162B] hover:text-[#5425CB] hover:underline cursor-pointer"
                      >
                        {m.employee_name}
                      </button>
                      {m.department_name && (
                        <span>• {m.department_name}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Date, Countdown urgency, Record action button */}
                <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-[14px] sm:text-[15px] font-mono font-bold text-[#1E162B]">
                      {formatDateDisplay(String(m.target_date))}
                    </div>
                    <div className="text-[13px] font-bold text-[#5425CB]">
                      in {m.days_remaining} {m.days_remaining === 1 ? 'day' : 'days'}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenMilestone(m)}
                    leftIcon={<ExternalLink className="w-4 h-4 text-[#5425CB] shrink-0" />}
                    className="h-10 px-4 text-[14px] sm:text-[15px] font-bold min-w-[88px] text-[#1E162B] bg-white border-[#DCD5E8] hover:border-[#5425CB] hover:bg-[#FAF8FE]"
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MILESTONE DETAIL WINDOW (MODAL) */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseMilestone}
        title={selectedMilestone?.title || 'Milestone Details'}
        description={
          selectedMilestone
            ? `Lifecycle Milestone • Due ${formatDateDisplay(selectedMilestone.target_date)}`
            : undefined
        }
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={handleCloseMilestone}
              className="min-w-[96px] text-[15px] font-bold"
            >
              Close
            </Button>

            {selectedMilestone?.link_path && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  const targetPath = selectedMilestone.link_path;
                  handleCloseMilestone();
                  navigate(targetPath);
                }}
                leftIcon={<ArrowRight className="w-4.5 h-4.5" />}
                className="text-[15px] font-bold"
              >
                Go to Lifecycle Workspace
              </Button>
            )}
          </div>
        }
      >
        {selectedMilestone ? (
          <div className="space-y-6">
            {/* Employee Card */}
            <div className="flex items-center justify-between p-4.5 rounded-xl bg-[#FAF8FE] border border-[#E2DBEB]">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#5425CB] text-white font-extrabold text-[16px] flex items-center justify-center shrink-0 shadow-xs">
                  {selectedMilestone.employee_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <h4 className="text-[16px] sm:text-[17px] font-extrabold text-[#1E162B]">
                    {selectedMilestone.employee_name || 'Employee Record'}
                  </h4>
                  <div className="flex items-center gap-2 text-[13px] sm:text-[14px] text-[#5C5270] mt-0.5 font-medium">
                    <span className="font-mono text-[#5425CB] font-bold">
                      {selectedMilestone.employee_code || 'ID: —'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-[#5C5270]" />
                      {selectedMilestone.department_name || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedMilestone.employee_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleCloseMilestone();
                    navigate(`/employees/${selectedMilestone.employee_id}`);
                  }}
                  className="text-[13px] font-bold h-9"
                >
                  View Profile
                </Button>
              )}
            </div>

            {/* Milestone Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-[#E2DBEB] bg-white space-y-1">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#5C5270]">
                  Target Deadline
                </span>
                <p className="text-[16px] font-extrabold font-mono text-[#1E162B]">
                  {formatDateDisplay(selectedMilestone.target_date)}
                </p>
                <p className="text-[12px] font-bold text-[#5425CB]">
                  in {selectedMilestone.days_remaining} {selectedMilestone.days_remaining === 1 ? 'day' : 'days'}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E2DBEB] bg-white space-y-1">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#5C5270]">
                  Process Stage
                </span>
                <p className="text-[16px] font-bold text-[#1E162B]">
                  {selectedCategoryMeta?.label || 'General'}
                </p>
                <p className="text-[12px] text-[#5C5270] font-medium truncate">
                  Lifecycle Phase
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E2DBEB] bg-white space-y-1">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#5C5270]">
                  Status
                </span>
                <div>
                  <Badge variant="brand" size="sm">
                    {selectedMilestone.status || 'SCHEDULED'}
                  </Badge>
                </div>
                <p className="text-[12px] text-[#5C5270] font-medium">
                  {selectedMilestone.owner_name ? `Owner: ${selectedMilestone.owner_name}` : 'Team Managed'}
                </p>
              </div>
            </div>

            {/* Operational Guidance */}
            <div className="p-4.5 rounded-xl border border-[#E2DBEB] bg-white space-y-2">
              <h5 className="text-[15px] font-bold text-[#1E162B] flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-[#5425CB]" />
                <span>Operational Checkpoint Summary</span>
              </h5>
              <p className="text-[14px] text-[#5C5270] leading-relaxed font-medium">
                {selectedCategoryMeta?.description ||
                  'This operational milestone has been scheduled as part of standard employee lifecycle governance.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-[#5C5270] space-y-2">
            <AlertCircle className="w-8 h-8 text-[#5425CB] mx-auto" />
            <p className="font-semibold text-[15px]">No milestone record selected.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
