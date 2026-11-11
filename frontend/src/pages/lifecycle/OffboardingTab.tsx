import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserMinus } from 'lucide-react';
import { OffboardingRecord, EligibleEmployee, TaskTemplate } from '../../types/lifecycle';
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

interface OffboardingTabProps {
  canInitiate: boolean;
  canEdit: boolean;
}

export const OffboardingTab: React.FC<OffboardingTabProps> = ({ canInitiate, canEdit }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [records, setRecords] = useState<OffboardingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Initiate Modal state
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [resignationDate, setResignationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lastWorkingDay, setLastWorkingDay] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState<string>('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);

  // Update Clearance Modal state
  const [selectedRecord, setSelectedRecord] = useState<OffboardingRecord | null>(null);
  const [editKtStatus, setEditKtStatus] = useState<string>('');
  const [editAssetStatus, setEditAssetStatus] = useState<string>('');
  const [editClearanceStatus, setEditClearanceStatus] = useState<string>('');
  const [editExitInterview, setEditExitInterview] = useState<boolean>(false);
  const [editOverallStatus, setEditOverallStatus] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listOffboarding({
        page,
        size: pageSize,
        status: statusFilter || undefined,
      });
      setRecords(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load offboarding records', err);
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
        setEditKtStatus(match.kt_status);
        setEditAssetStatus(match.asset_recovery_status);
        setEditClearanceStatus(match.clearance_status);
        setEditExitInterview(match.exit_interview_completed);
        setEditOverallStatus(match.overall_status);
      }
    }
  }, [empParam, recordParam, records, selectedRecord]);

  const handleOpenInitiate = async () => {
    try {
      const [emps, tmpls] = await Promise.all([
        lifecycleApi.getEligibleEmployeesForOffboarding(),
        lifecycleApi.listTemplates({ category: 'OFFBOARDING', is_active: true }),
      ]);
      setEligibleEmployees(emps);
      setTemplates(tmpls);
      setSelectedTemplateIds(tmpls.map((t) => t.id));
      if (emps.length > 0) setSelectedEmpId(emps[0].id);
      setIsInitiateModalOpen(true);
    } catch (err) {
      console.error('Failed to open offboarding initiation', err);
    }
  };

  const handleInitiateSubmit = async () => {
    if (!selectedEmpId || !resignationDate || !lastWorkingDay) return;
    setSubmitting(true);
    try {
      await lifecycleApi.initiateOffboarding({
        employee_id: selectedEmpId,
        resignation_date: resignationDate,
        last_working_day: lastWorkingDay,
        reason: reason || undefined,
        template_ids: selectedTemplateIds,
      });
      setIsInitiateModalOpen(false);
      fetchRecords();
    } catch (err) {
      console.error('Failed to initiate offboarding', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (rec: OffboardingRecord) => {
    setSelectedRecord(rec);
    setEditKtStatus(rec.kt_status);
    setEditAssetStatus(rec.asset_recovery_status);
    setEditClearanceStatus(rec.clearance_status);
    setEditExitInterview(rec.exit_interview_completed);
    setEditOverallStatus(rec.overall_status);
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await lifecycleApi.updateOffboarding(selectedRecord.id, {
        kt_status: editKtStatus,
        asset_recovery_status: editAssetStatus,
        clearance_status: editClearanceStatus,
        exit_interview_completed: editExitInterview,
        overall_status: editOverallStatus,
      });
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to update offboarding', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeExit = async (rec: OffboardingRecord) => {
    if (!window.confirm(`Are you sure you want to finalize offboarding for ${rec.employee_name}? This will mark all clearances complete and transition the employee to RESIGNED.`)) {
      return;
    }
    try {
      await lifecycleApi.completeOffboarding(rec.id);
      fetchRecords();
    } catch (err) {
      console.error('Failed to finalize offboarding', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Action and Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:p-5 bg-white rounded-2xl border border-[#E1DBEA] shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Offboarding Statuses' },
                { value: 'IN_PROGRESS', label: 'In Progress (Notice Period)' },
                { value: 'COMPLETED', label: 'Completed (Exited)' },
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

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

        <div className="flex items-center shrink-0">
          {canInitiate && (
            <Button variant="primary" onClick={handleOpenInitiate} className="h-11 px-5 text-[14px] sm:text-[15px] font-bold rounded-xl cursor-pointer">
              <UserMinus className="w-4 h-4 mr-2" />
              Initiate Offboarding
            </Button>
          )}
        </div>
      </div>

      {/* Offboarding Records Table */}
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
              title="No Offboarding Records"
              description="No offboarding workflows match the selected filter criteria."
              actionLabel={canInitiate ? "Initiate Offboarding" : undefined}
              onAction={canInitiate ? handleOpenInitiate : undefined}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-48">Employee</TableHead>
                <TableHead className="w-36">Department</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Resignation Date</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Last Working Day</TableHead>
                <TableHead className="w-48 whitespace-nowrap">Knowledge Transfer Status</TableHead>
                <TableHead className="w-44 whitespace-nowrap">Clearance Status</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
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
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {rec.resignation_date}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] font-bold text-rose-700 whitespace-nowrap font-mono">
                    {rec.last_working_day}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rec.kt_status === 'COMPLETED' ? 'success' : 'warning'}
                    >
                      {rec.kt_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <Badge
                        variant={rec.clearance_status === 'CLEARED' ? 'success' : 'warning'}
                        className="w-fit"
                      >
                        {rec.clearance_status}
                      </Badge>
                      <span className="text-[12px] text-[#5C5270] font-medium">
                        Asset: {rec.asset_recovery_status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[14px] font-bold h-10 px-3.5"
                          onClick={() => handleOpenEdit(rec)}
                        >
                          Clearance
                        </Button>
                      )}
                      {canInitiate && rec.overall_status === 'IN_PROGRESS' && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-[14px] font-bold h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleFinalizeExit(rec)}
                        >
                          Finalize
                        </Button>
                      )}
                    </div>
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

      {/* Modal: Initiate Offboarding */}
      <Modal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        title="Initiate Employee Separation & Offboarding"
        description="Set up notice period, last working day, and generate offboarding clearances."
        maxWidth="lg"
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setIsInitiateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={submitting || !selectedEmpId}
              onClick={handleInitiateSubmit}
            >
              {submitting ? 'Initiating...' : 'Start Offboarding'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Employee Resigning</label>
            <Select
              value={selectedEmpId ? String(selectedEmpId) : ''}
              onChange={(e) => setSelectedEmpId(Number(e.target.value))}
              options={eligibleEmployees.map((e) => ({
                value: String(e.id),
                label: `${e.name} (${e.employee_code}) - ${e.department_name || 'No Dept'}`,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Resignation Submission Date</label>
              <Input type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Last Working Day (LWD)</label>
              <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Reason for Departure (Optional)</label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Higher education, relocation, external offer"
            />
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">
                Offboarding Clearances & Checklist ({selectedTemplateIds.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-border/70 rounded-lg p-2.5 space-y-1.5 bg-slate-50/50">
                {templates.map((tmpl) => (
                  <label key={tmpl.id} className="flex items-center space-x-2.5 text-xs text-text-primary cursor-pointer hover:bg-white p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.includes(tmpl.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTemplateIds([...selectedTemplateIds, tmpl.id]);
                        } else {
                          setSelectedTemplateIds(selectedTemplateIds.filter((id) => id !== tmpl.id));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{tmpl.name}</span>
                      <span className="text-[10px] text-text-secondary ml-1.5">({tmpl.default_role_code}, {tmpl.estimated_duration_days}d)</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Update Clearances */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Update Clearances: ${selectedRecord.employee_name || `Employee #${selectedRecord.employee_id}`}`}
          description="Update KT handover, IT hardware return, full & final settlement clearance, and exit interview."
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleEditSubmit}>
                {submitting ? 'Saving...' : 'Save Clearances'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Knowledge Transfer Status</label>
              <Select
                value={editKtStatus}
                onChange={(e) => setEditKtStatus(e.target.value)}
                options={[
                  { value: 'IN_PROGRESS', label: 'Knowledge Transfer In Progress' },
                  { value: 'COMPLETED', label: 'Knowledge Transfer Completed' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Company Equipment Return</label>
              <Select
                value={editAssetStatus}
                onChange={(e) => setEditAssetStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Company Equipment Return Pending' },
                  { value: 'RETURNED', label: 'Company Equipment Returned & Verified' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Department Clearance</label>
              <Select
                value={editClearanceStatus}
                onChange={(e) => setEditClearanceStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Department Clearance In Progress' },
                  { value: 'CLEARED', label: 'Department Clearance Completed' },
                ]}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="editExit"
                checked={editExitInterview}
                onChange={(e) => setEditExitInterview(e.target.checked)}
                className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
              />
              <label htmlFor="editExit" className="text-xs font-medium text-text-primary cursor-pointer">
                Exit Interview Completed
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Overall Offboarding Status</label>
              <Select
                value={editOverallStatus}
                onChange={(e) => setEditOverallStatus(e.target.value)}
                options={[
                  { value: 'IN_PROGRESS', label: 'In Progress (Notice Period)' },
                  { value: 'COMPLETED', label: 'Completed (Exited)' },
                ]}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
