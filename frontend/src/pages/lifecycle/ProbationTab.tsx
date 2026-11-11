import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { ProbationRecord } from '../../types/lifecycle';
import { lifecycleApi } from '../../api/lifecycleApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

interface ProbationTabProps {
  canEdit: boolean;
}

export const ProbationTab: React.FC<ProbationTabProps> = ({ canEdit }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [records, setRecords] = useState<ProbationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Edit modal
  const [selectedRecord, setSelectedRecord] = useState<ProbationRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editFeedback, setEditFeedback] = useState<string>('');
  const [editHrEval, setEditHrEval] = useState<string>('');
  const [editExtDate, setEditExtDate] = useState<string>('');
  const [editExtReason, setEditExtReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listProbation({
        page,
        size: pageSize,
        status: statusFilter || undefined,
      });
      setRecords(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load probation records', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Record-level direct navigation support
  useEffect(() => {
    if ((empParam || recordParam) && records.length > 0 && !selectedRecord) {
      const match = records.find(
        (r) =>
          (recordParam && String(r.id) === recordParam) ||
          (empParam && String(r.employee_id) === empParam)
      );
      if (match) {
        setSelectedRecord(match);
        setEditStatus(match.status);
        setEditFeedback(match.manager_feedback || '');
        setEditHrEval(match.hr_evaluation || '');
        setEditExtDate(match.extended_end_date || '');
        setEditExtReason(match.extension_reason || '');
      }
    }
  }, [empParam, recordParam, records, selectedRecord]);

  const handleOpenEdit = (rec: ProbationRecord) => {
    setSelectedRecord(rec);
    setEditStatus(rec.status);
    setEditFeedback(rec.manager_feedback || '');
    setEditHrEval(rec.hr_evaluation || '');
    setEditExtDate(rec.extended_end_date || '');
    setEditExtReason(rec.extension_reason || '');
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await lifecycleApi.updateProbation(selectedRecord.id, {
        status: editStatus,
        manager_feedback: editFeedback,
        hr_evaluation: editHrEval,
        extended_end_date: editExtDate || null,
        extension_reason: editExtReason || null,
      });
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to update probation', err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Action and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 bg-white rounded-2xl border border-[#E1DBEA] shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Probation Statuses' },
              { value: 'UNDER_REVIEW', label: 'Under Review' },
              { value: 'EXTENDED', label: 'Extended' },
              { value: 'COMPLETED', label: 'Completed' },
            ]}
            className="w-56 h-11 text-[14px] font-semibold"
          />

          {statusFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              className="h-11 px-4 text-[14px] font-bold text-[#5C5270] hover:text-[#5425CB]"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Probation Records Table */}
      <div className="bg-white rounded-2xl border border-[#E1DBEA] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Probation Records"
              description="No probation records match the selected filter criteria."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reporting Manager</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Probation End Date</TableHead>
                <TableHead>Extended End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manager Feedback</TableHead>
                {canEdit && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-[#FAF8FE] transition-colors">
                  <TableCell>
                    <div className="font-bold text-[#1E162B] text-[15px]">
                      {rec.employee_name || `Employee #${rec.employee_id}`}
                    </div>
                    <div className="text-[13px] text-[#5C5270] font-mono">{rec.employee_code}</div>
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {rec.department_name || '—'}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {rec.manager_name || '—'}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {rec.probation_start_date}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-semibold font-mono">
                    {rec.probation_end_date}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] whitespace-nowrap font-mono">
                    {rec.extended_end_date ? (
                      <span className="text-amber-700 font-bold">{rec.extended_end_date}</span>
                    ) : (
                      <span className="text-[#796F8F]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rec.status === 'COMPLETED'
                          ? 'success'
                          : rec.status === 'EXTENDED'
                          ? 'warning'
                          : 'brand'
                      }
                    >
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270] max-w-xs truncate">
                    {rec.manager_feedback || <span className="italic text-slate-400">None yet</span>}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => handleOpenEdit(rec)}
                      >
                        Evaluate
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-border/70 flex justify-end">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Modal: Evaluate / Extend Probation */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Probation Review: ${selectedRecord.employee_name || `Employee #${selectedRecord.employee_id}`}`}
          description="Record manager assessment, HR evaluation, or extend probation duration."
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleEditSubmit}>
                {submitting ? 'Saving...' : 'Save Evaluation'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Probation Status</label>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={[
                  { value: 'UNDER_REVIEW', label: 'Under Review' },
                  { value: 'EXTENDED', label: 'Extended' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Manager Feedback & Assessment</label>
              <textarea
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                rows={3}
                placeholder="Key performance highlights, probation observations, areas of improvement..."
                className="w-full rounded-lg border border-border/70 p-2 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">HR Evaluation Notes</label>
              <textarea
                value={editHrEval}
                onChange={(e) => setEditHrEval(e.target.value)}
                rows={2}
                placeholder="HR compliance and attendance verification..."
                className="w-full rounded-lg border border-border/70 p-2 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>

            {editStatus === 'EXTENDED' && (
              <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/60 space-y-2.5">
                <div className="text-xs font-semibold text-amber-900 flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Probation Extension Details
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-primary mb-1">New Extended End Date</label>
                  <Input type="date" value={editExtDate} onChange={(e) => setEditExtDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-primary mb-1">Extension Reason</label>
                  <Input
                    type="text"
                    value={editExtReason}
                    onChange={(e) => setEditExtReason(e.target.value)}
                    placeholder="e.g. Additional training period required on core stack"
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
