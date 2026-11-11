import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, UserMinus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DashboardKPIs } from '../../types/dashboard';
import { KPICard } from '../ui/KPICard';

interface DashboardKPIBarProps {
  kpis: DashboardKPIs;
  isLoading?: boolean;
}

export const DashboardKPIBar: React.FC<DashboardKPIBarProps> = ({ kpis, isLoading }) => {
  const navigate = useNavigate();

  const totalEmployeesCount = kpis.total_employees ?? kpis.active_employees ?? 0;
  const newJoinersCount = kpis.new_joiners_this_month ?? 0;
  const exitsCount = kpis.exits_this_month ?? 0;
  const pendingActionsCount = kpis.pending_hr_actions ?? kpis.open_tasks ?? 0;

  const items = [
    {
      id: 'total_employees',
      title: 'Total Employees',
      value: isLoading ? '—' : totalEmployeesCount,
      indicator: 'Active Headcount',
      indicatorColor: 'text-[#5425CB] bg-[#EDE7FF] border-[#DCD0FF]',
      icon: Users,
      accent: 'violet' as const,
      onClick: () => navigate('/employees?status=ACTIVE,CONFIRMED'),
    },
    {
      id: 'new_joiners_this_month',
      title: 'New Joiners This Month',
      value: isLoading ? '—' : newJoinersCount,
      indicator: 'Current Month',
      indicatorColor: 'text-blue-800 bg-blue-50 border-blue-200',
      icon: UserPlus,
      accent: 'blue' as const,
      onClick: () => navigate('/lifecycle/onboarding'),
    },
    {
      id: 'exits_this_month',
      title: 'Exits This Month',
      value: isLoading ? '—' : exitsCount,
      indicator: 'Current Month',
      indicatorColor: 'text-rose-800 bg-rose-50 border-rose-200',
      icon: UserMinus,
      accent: 'rose' as const,
      onClick: () => navigate('/lifecycle/offboarding'),
    },
    {
      id: 'pending_hr_actions',
      title: 'Pending HR Actions',
      value: isLoading ? '—' : pendingActionsCount,
      indicator: pendingActionsCount > 0 ? 'Requires Attention' : 'Healthy',
      indicatorColor:
        pendingActionsCount > 0
          ? 'text-amber-900 bg-amber-50 border-amber-200'
          : 'text-emerald-800 bg-emerald-50 border-emerald-200',
      icon: pendingActionsCount > 0 ? AlertCircle : CheckCircle2,
      accent: pendingActionsCount > 0 ? ('amber' as const) : ('emerald' as const),
      onClick: () => navigate('/action-center'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {items.map((item) => (
        <KPICard
          key={item.id}
          title={item.title}
          value={item.value}
          indicator={item.indicator}
          indicatorColor={item.indicatorColor}
          icon={item.icon}
          accent={item.accent}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
};
