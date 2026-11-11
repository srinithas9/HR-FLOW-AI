import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { ConfirmationRecord } from '../../types/lifecycle';
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

interface ConfirmationTabProps {
  userRole?: string;
}

export const ConfirmationTab: React.FC<ConfirmationTabProps> = ({ userRole }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [records, setRecords] = useState<ConfirmationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  const isReportingManager = ['REPORTING_MANAGER', 'PEOPLE_MANAGER'].includes(userRole || '');
  const canDecide = ['ADMIN', 'HR_MANAGER'].includes(userRole || '');

  // Recommendation Modal (for reporting manager)
  const [recommendRecord, setRecommendRecord] = useState<ConfirmationRecord | null>(null);
  const [recommendationChoice, setRecommendationChoice] = useState<'RECOMMENDED' | 'EXTEND_PROBATION' | 'NOT_RECOMMENDED'>('RECOMMENDED');
  const [recommendFeedback, setRecommendFeedback] = useState<string>('');

  // Formal Decision Modal (for HR Manager / Admin)
  const [decisionRecord, setDecisionRecord] = useState<ConfirmationRecord | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<'CONFIRMED' | 'EXTENDED' | 'REJECTED'>('CONFIRMED');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [letterIssued, setLetterIssued] = useState<boolean>(true);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [extensionMonths, setExtensionMonths] = useState<number>(3);

  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listConfirmation({
        page,
        size: pageSize,
        status: statusFilter || undefined,
      });
      setRecords(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load confirmation records', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Record-level direct navigation support
  useEffect(() => {
    if ((empParam || recordParam) && records.length > 0 && !decisionRecord && !recommendRecord) {
      const match = records.find(
        (r) =>
          (recordParam && String(r.id) === recordParam) ||
          (empParam && String(r.employee_id) === empParam)
      );
      if (match) {
        if (canDecide) {
          setDecisionRecord(match);
          setDecisionChoice('CONFIRMED');
          setEffectiveDate(match.confirmation_due_date || new Date().toISOString().split('T')[0]);
        } else if (isReportingManager) {
          setRecommendRecord(match);
          setRecommendationChoice('RECOMMENDED');
        }
      }
    }
  }, [empParam, recordParam, records, decisionRecord, recommendRecord, canDecide, isReportingManager]);

  // Handle recommendation submit
  const handleRecommendSubmit = async () => {
    if (!recommendRecord) return;
    setSubmitting(true);
    try {
      await lifecycleApi.recommendConfirmation(recommendRecord.id, {
        manager_recommendation: recommendationChoice,
        manager_feedback: recommendFeedback,
      });
      setRecommendRecord(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to submit recommendation', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle formal decision submit
  const handleDecisionSubmit = async () => {
    if (!decisionRecord) return;
    setSubmitting(true);
    try {
      await lifecycleApi.decideConfirmation(decisionRecord.id, {
        decision: decisionChoice,
        effective_confirmation_date: effectiveDate,
        confirmation_letter_issued: letterIssued,
        extension_months: decisionChoice === 'EXTENDED' ? extensionMonths : undefined,
        notes: decisionNotes,
      });
      setDecisionRecord(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to finalize decision', err);
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
              { value: '', label: 'All Confirmation Statuses' },
              { value: 'PENDING_APPROVAL', label: 'Pending Decision' },
              { value: 'APPROVED_BY_MANAGER', label: 'Recommended by Manager' },
              { value: 'CONFIRMED', label: 'Formally Confirmed' },
              { value: 'EXTENDED', label: 'Probation Extended' },
            ]}
            className="w-64 h-11 text-[14px] font-semibold"
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

      {/* Confirmation Records Table */}
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
              title="No Confirmation Records"
              description="No confirmation workflows match the selected filter criteria."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reporting Manager</TableHead>
                <TableHead>Confirmation Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manager Recommendation</TableHead>
                <TableHead>HR Approval</TableHead>
                <TableHead>Confirmation Letter</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-semibold font-mono">
                    {rec.confirmation_due_date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rec.status === 'CONFIRMED'
                          ? 'success'
                          : rec.status === 'APPROVED_BY_MANAGER'
                          ? 'brand'
                          : rec.status === 'EXTENDED'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[14px]">
                    {rec.approved_by_manager_id ? (
                      <span className="inline-flex items-center text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Endorsed
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-amber-600 font-medium">
                        <AlertCircle className="w-4 h-4 mr-1.5" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {rec.approved_by_hr_name || (rec.status === 'CONFIRMED' ? 'HR Approved' : '—')}
                  </TableCell>
                  <TableCell className="text-[14px]">
                    {rec.confirmation_letter_issued ? (
                      <Badge variant="success">
                        Issued
                      </Badge>
                    ) : (
                      <span className="text-[#796F8F] text-[14px]">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canDecide ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => {
                          setDecisionRecord(rec);
                          setDecisionChoice('CONFIRMED');
                          setEffectiveDate(rec.confirmation_due_date || new Date().toISOString().split('T')[0]);
                        }}
                      >
                        Formal Decision
                      </Button>
                    ) : isReportingManager ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => {
                          setRecommendRecord(rec);
                          setRecommendationChoice('RECOMMENDED');
                        }}
                      >
                        Recommend
                      </Button>
                    ) : (
                      <span className="text-[11px] text-text-secondary">View Only</span>
                    )}
                  </TableCell>
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

      {/* Modal: Reporting Manager Recommendation */}
      {recommendRecord && (
        <Modal
          isOpen={true}
          onClose={() => setRecommendRecord(null)}
          title={`Confirmation Recommendation: ${recommendRecord.employee_name || `Employee #${recommendRecord.employee_id}`}`}
          description="Submit your managerial recommendation regarding employment confirmation."
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setRecommendRecord(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleRecommendSubmit}>
                {submitting ? 'Submitting...' : 'Submit Recommendation'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Your Recommendation</label>
              <Select
                value={recommendationChoice}
                onChange={(e) => setRecommendationChoice(e.target.value as any)}
                options={[
                  { value: 'RECOMMENDED', label: 'Confirm Employment (Recommended)' },
                  { value: 'EXTEND_PROBATION', label: 'Extend Probation' },
                  { value: 'NOT_RECOMMENDED', label: 'Do Not Confirm' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Managerial Justification & Feedback</label>
              <textarea
                value={recommendFeedback}
                onChange={(e) => setRecommendFeedback(e.target.value)}
                rows={4}
                placeholder="Detail technical competence, team collaboration, delivery velocity, and reasoning..."
                className="w-full rounded-lg border border-border/70 p-2 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Formal HR Decision */}
      {decisionRecord && (
        <Modal
          isOpen={true}
          onClose={() => setDecisionRecord(null)}
          title={`Formal Confirmation Decision: ${decisionRecord.employee_name || `Employee #${decisionRecord.employee_id}`}`}
          description="Human-in-the-loop executive decision to formalize employee confirmation or extend probation."
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setDecisionRecord(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleDecisionSubmit}>
                {submitting ? 'Finalizing...' : 'Finalize Decision'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Confirmation Decision</label>
              <Select
                value={decisionChoice}
                onChange={(e) => setDecisionChoice(e.target.value as any)}
                options={[
                  { value: 'CONFIRMED', label: 'Confirm Employee (Transition to CONFIRMED)' },
                  { value: 'EXTENDED', label: 'Extend Probation Duration' },
                  { value: 'REJECTED', label: 'Reject Confirmation' },
                ]}
              />
            </div>

            {decisionChoice === 'CONFIRMED' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">Effective Confirmation Date</label>
                  <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="letterIssued"
                    checked={letterIssued}
                    onChange={(e) => setLetterIssued(e.target.checked)}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                  />
                  <label htmlFor="letterIssued" className="text-xs font-medium text-text-primary cursor-pointer">
                    Issue Formal Confirmation Letter
                  </label>
                </div>
              </>
            )}

            {decisionChoice === 'EXTENDED' && (
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">Extension Duration (Months)</label>
                <Select
                  value={String(extensionMonths)}
                  onChange={(e) => setExtensionMonths(Number(e.target.value))}
                  options={[
                    { value: '1', label: '1 Month' },
                    { value: '2', label: '2 Months' },
                    { value: '3', label: '3 Months (Standard)' },
                    { value: '6', label: '6 Months' },
                  ]}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Executive Notes</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={3}
                placeholder="Official decision rationale recorded for statutory audit..."
                className="w-full rounded-lg border border-border/70 p-2 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
