import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { AttentionItem } from '../../types/dashboard';

interface AttentionRequiredTableProps {
  items: AttentionItem[];
  totalCount: number;
  isLoading?: boolean;
}

export const AttentionRequiredTable: React.FC<AttentionRequiredTableProps> = ({
  items,
  totalCount,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: totalCount || items.length,
      OVERDUE_TASK: 0,
      OVERDUE_REVIEW: 0,
      OVERDUE_DECISION: 0,
      PENDING_CLEARANCE: 0,
    };
    items.forEach((item) => {
      if (counts[item.category] !== undefined) {
        counts[item.category] += 1;
      }
    });
    return counts;
  }, [items]);

  const categories = [
    { id: 'ALL', label: 'All Categories', count: categoryCounts.ALL },
    { id: 'OVERDUE_TASK', label: 'Overdue Tasks', count: categoryCounts.OVERDUE_TASK },
    { id: 'OVERDUE_REVIEW', label: 'Probation Reviews', count: categoryCounts.OVERDUE_REVIEW },
    { id: 'OVERDUE_DECISION', label: 'Confirmations', count: categoryCounts.OVERDUE_DECISION },
    { id: 'PENDING_CLEARANCE', label: 'Clearance Holds', count: categoryCounts.PENDING_CLEARANCE },
  ];

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'ALL') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const getPriorityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-700 border border-gray-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OVERDUE':
      case 'BLOCKED':
      case 'DELAYED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {status}
          </span>
        );
      case 'IN_PROGRESS':
      case 'UNDER_REVIEW':
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {status.replace('_', ' ')}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-[#292238]">
            {status}
          </span>
        );
    }
  };

  const formatDateDisplay = (dateStr?: string | Date | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return String(dateStr);
    }
  };

  // Clean concise action description
  const cleanActionDescription = (item: AttentionItem) => {
    if (item.category === 'OVERDUE_TASK') {
      const taskTitle = item.title.replace(/^Task Overdue:\s*/i, '');
      return `Complete ${taskTitle}`;
    }
    return item.action_required || item.title;
  };

  return (
    <div className="bg-white border border-[#E2DBEB] rounded-2xl shadow-2xs overflow-hidden w-full space-y-0">
      {/* Header & Filter Controls Section */}
      <div className="p-6 sm:p-7 border-b border-[#E2DBEB] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-[22px] font-extrabold text-[#1E162B] tracking-tight">
                Attention Required
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[#5C5270] font-medium mt-0.5">
                Operational tasks and lifecycle checkpoints requiring prompt HR action
              </p>
            </div>
          </div>

          <span className="self-start sm:self-auto bg-rose-50 text-rose-700 border border-rose-200 text-[13px] sm:text-[14px] font-bold px-4 py-1.5 rounded-full font-mono">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-4 py-2 rounded-xl text-[14px] sm:text-[15px] font-bold transition-all whitespace-nowrap flex items-center gap-2.5 border cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#5425CB] text-white border-[#5425CB] shadow-2xs'
                  : 'bg-[#FAF8FE] text-[#5C5270] border-[#E2DBEB] hover:bg-[#F3EBFB] hover:text-[#5425CB]'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[12px] sm:text-[13px] font-bold px-2 py-0.5 rounded-full ${
                  selectedCategory === cat.id
                    ? 'bg-white/20 text-white'
                    : 'bg-[#DDD1FA]/70 text-[#5425CB]'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="p-12 text-center text-sm sm:text-[15px] text-[#5C5270] space-y-2">
          <Clock className="w-6 h-6 mx-auto animate-spin text-[#5425CB]" />
          <p className="font-semibold">Loading attention records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-[16px] font-bold text-[#1E162B]">No Items in this Category</h3>
          <p className="text-[14px] text-[#5C5270]">All operational activities in this category are healthy.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[14px] sm:text-[15px]">
            <thead className="bg-[#F7F5FB] text-[#5C5270] border-b border-[#E2DBEB] uppercase tracking-wider text-[13px] sm:text-[14px] font-bold h-14">
              <tr>
                <th className="py-4 px-5 w-[38%] min-w-[280px]">Action Item</th>
                <th className="py-4 px-5 w-[20%] min-w-[170px]">Employee</th>
                <th className="py-4 px-5 w-[16%] min-w-[140px]">Department</th>
                <th className="py-4 px-5 w-[14%] min-w-[130px]">Deadline</th>
                <th className="py-4 px-5 text-right w-[12%] min-w-[110px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DBEB] text-[#1E162B]">
              {paginatedItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#FAF8FE]/80 transition-colors"
                >
                  {/* 1. Action Item (Priority + Title + Subtext) */}
                  <td className="py-5 px-5 align-middle">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {getPriorityBadge(item.severity)}
                      {getStatusBadge(item.workflow_status)}
                    </div>
                    <div className="font-bold text-[#1E162B] line-clamp-2 leading-snug text-[15px] sm:text-[16px]">
                      {cleanActionDescription(item)}
                    </div>
                    {item.owner_name && (
                      <div className="text-[12.5px] text-[#5C5270] font-medium mt-1">
                        Assigned to: <span className="font-semibold text-[#1E162B]">{item.owner_name}</span>
                      </div>
                    )}
                  </td>

                  {/* 2. Employee */}
                  <td className="py-5 px-5 align-middle whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => item.employee_id && navigate(`/employees/${item.employee_id}`)}
                      className="text-left group cursor-pointer hover:underline"
                    >
                      <div className="font-bold text-[#1E162B] group-hover:text-[#5425CB] transition-colors text-[15px] sm:text-[16px]">
                        {item.employee_name}
                      </div>
                      {item.employee_code && (
                        <div className="text-[12px] sm:text-[13px] text-[#5C5270] font-mono font-medium mt-0.5">
                          {item.employee_code}
                        </div>
                      )}
                    </button>
                  </td>

                  {/* 3. Department */}
                  <td className="py-5 px-5 align-middle whitespace-nowrap text-[#5C5270] font-semibold text-[14px] sm:text-[15px]">
                    {item.department_name || '—'}
                  </td>

                  {/* 4. Deadline */}
                  <td className="py-5 px-5 align-middle whitespace-nowrap font-mono text-[#5C5270] font-bold text-[14px]">
                    <div>{formatDateDisplay(item.due_date)}</div>
                    {item.days_overdue > 0 && (
                      <span className="inline-flex items-center text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded mt-1">
                        {item.days_overdue}d overdue
                      </span>
                    )}
                  </td>

                  {/* 5. Action Button */}
                  <td className="py-5 px-5 align-middle text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(item.link_path)}
                      leftIcon={<ExternalLink className="w-4 h-4 text-[#5425CB] shrink-0" />}
                      className="h-10 px-4 text-[14px] sm:text-[15px] font-bold min-w-[88px] text-[#1E162B] bg-white border-[#DCD5E8] hover:border-[#5425CB] hover:bg-[#FAF8FE]"
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="px-5 py-3 border-t border-[#E2DBEB] bg-[#FAF8FE]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5C5270]">
          <div>
            Showing <strong className="text-[#1E162B] font-bold">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-[#1E162B] font-bold">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </strong>{' '}
            of <strong className="text-[#1E162B] font-bold">{filteredItems.length}</strong> matching records
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E2DBEB] bg-white hover:bg-gray-50 text-[#1E162B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-medium">
              Page <strong className="text-[#1E162B]">{currentPage}</strong> of{' '}
              <strong className="text-[#1E162B]">{totalPages}</strong>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E2DBEB] bg-white hover:bg-gray-50 text-[#1E162B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
