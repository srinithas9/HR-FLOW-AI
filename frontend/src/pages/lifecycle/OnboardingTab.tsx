import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, CheckCircle2, Clock } from 'lucide-react';
import { OnboardingRecord, EligibleEmployee, TaskTemplate } from '../../types/lifecycle';
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

interface OnboardingTabProps {
  canInitiate: boolean;
  canEdit: boolean;
}

export const OnboardingTab: React.FC<OnboardingTabProps> = ({ canInitiate, canEdit }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [itAssetFilter, setItAssetFilter] = useState<string>('');
  const [bgvFilter, setBgvFilter] = useState<string>('');

  // Initiate Modal state
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit / Update Modal state
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);
  const [editItStatus, setEditItStatus] = useState<string>('');
  const [editBgvStatus, setEditBgvStatus] = useState<string>('');
  const [editOrientation, setEditOrientation] = useState<boolean>(false);
  const [editOverallStatus, setEditOverallStatus] = useState<string>('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listOnboarding({
        page,
        size: pageSize,
        status: statusFilter || undefined,
        it_asset_status: itAssetFilter || undefined,
        bgv_status: bgvFilter || undefined,
      });
      setRecords(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load onboarding records', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, itAssetFilter, bgvFilter]);

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
        setEditItStatus(match.it_asset_status);
        setEditBgvStatus(match.bgv_status);
        setEditOrientation(match.orientation_completed);
        setEditOverallStatus(match.overall_status);
      }
    }
  }, [empParam, recordParam, records, selectedRecord]);

  // Load eligible employees and templates for initiation
  const handleOpenInitiate = async () => {
    try {
      const [emps, tmpls] = await Promise.all([
        lifecycleApi.getEligibleEmployeesForOnboarding(),
        lifecycleApi.listTemplates({ category: 'ONBOARDING', is_active: true }),
      ]);
      setEligibleEmployees(emps);
      setTemplates(tmpls);
      setSelectedTemplateIds(tmpls.map((t) => t.id));
      if (emps.length > 0) setSelectedEmpId(emps[0].id);
      setIsInitiateModalOpen(true);
    } catch (err) {
      console.error('Failed to open initiate modal', err);
    }
  };

  const handleInitiateSubmit = async () => {
    if (!selectedEmpId || !startDate || !targetDate) return;
    setSubmitting(true);
    try {
      await lifecycleApi.initiateOnboarding({
        employee_id: selectedEmpId,
        start_date: startDate,
        target_completion_date: targetDate,
        template_ids: selectedTemplateIds,
      });
      setIsInitiateModalOpen(false);
      fetchRecords();
    } catch (err) {
      console.error('Failed to initiate onboarding', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (rec: OnboardingRecord) => {
    setSelectedRecord(rec);
    setEditItStatus(rec.it_asset_status);
    setEditBgvStatus(rec.bgv_status);
    setEditOrientation(rec.orientation_completed);
    setEditOverallStatus(rec.overall_status);
  };

  const handleEditSubmit = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await lifecycleApi.updateOnboarding(selectedRecord.id, {
        it_asset_status: editItStatus,
        bgv_status: editBgvStatus,
        orientation_completed: editOrientation,
        overall_status: editOverallStatus,
      });
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to update onboarding', err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Action and Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:p-5 bg-white rounded-2xl border border-[#E1DBEA] shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Overall Statuses' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

          <div className="w-72">
            <Select
              value={itAssetFilter}
              onChange={(e) => {
                setItAssetFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Equipment Allocation Statuses' },
                { value: 'PROVISIONED', label: 'Equipment Provisioned' },
                { value: 'PENDING', label: 'Pending Provisioning' },
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

          <div className="w-80">
            <Select
              value={bgvFilter}
              onChange={(e) => {
                setBgvFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Background Verification Statuses' },
                { value: 'COMPLETED', label: 'Background Verification Completed' },
                { value: 'IN_PROGRESS', label: 'Background Verification In Progress' },
                { value: 'PENDING', label: 'Background Verification Pending' },
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

          {(statusFilter || itAssetFilter || bgvFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('');
                setItAssetFilter('');
                setBgvFilter('');
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
              <UserPlus className="w-4 h-4 mr-2" />
              Initiate Onboarding
            </Button>
          )}
        </div>
      </div>

      {/* Onboarding Records Table */}
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
              title="No Onboarding Records"
              description="No onboarding records match the selected filter criteria."
              actionLabel={canInitiate ? "Initiate Onboarding" : undefined}
              onAction={canInitiate ? handleOpenInitiate : undefined}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Expected Completion</TableHead>
                <TableHead>Equipment Allocation</TableHead>
                <TableHead>Background Verification</TableHead>
                <TableHead>Company Orientation</TableHead>
                <TableHead>Overall Status</TableHead>
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
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {rec.start_date}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {rec.target_completion_date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rec.it_asset_status === 'PROVISIONED' ? 'success' : 'warning'}
                    >
                      {rec.it_asset_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rec.bgv_status === 'COMPLETED' ? 'success' : 'warning'}
                    >
                      {rec.bgv_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rec.orientation_completed ? (
                      <span className="inline-flex items-center text-[14px] text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[14px] text-amber-600 font-medium">
                        <Clock className="w-4 h-4 mr-1.5" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rec.overall_status === 'COMPLETED' ? 'success' : 'brand'}
                    >
                      {rec.overall_status}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => handleOpenEdit(rec)}
                      >
                        Update
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

      {/* Modal: Initiate Onboarding */}
      <Modal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        title="Initiate Onboarding Workflow"
        description="Set up new hire onboarding milestones and auto-generate lifecycle checklist tasks."
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
              {submitting ? 'Initiating...' : 'Start Onboarding'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Eligible Employee</label>
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
              <label className="block text-xs font-medium text-text-primary mb-1">Joining / Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Target Completion Date</label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">
                Onboarding Task Checklist ({selectedTemplateIds.length} selected)
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

      {/* Modal: Update Onboarding Progress */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Update Onboarding: ${selectedRecord.employee_name || `Employee #${selectedRecord.employee_id}`}`}
          description="Update equipment provisioning, background verification, company orientation, and stage status."
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleEditSubmit}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Equipment Allocation Status</label>
              <Select
                value={editItStatus}
                onChange={(e) => setEditItStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Pending Provisioning' },
                  { value: 'PROVISIONED', label: 'Equipment Provisioned' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Background Verification Status</label>
              <Select
                value={editBgvStatus}
                onChange={(e) => setEditBgvStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Verification Pending' },
                  { value: 'IN_PROGRESS', label: 'Verification In Progress' },
                  { value: 'COMPLETED', label: 'Verification Completed' },
                ]}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="editOrientation"
                checked={editOrientation}
                onChange={(e) => setEditOrientation(e.target.checked)}
                className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary/20"
              />
              <label htmlFor="editOrientation" className="text-xs font-medium text-text-primary cursor-pointer">
                Company Orientation Completed
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Overall Onboarding Status</label>
              <Select
                value={editOverallStatus}
                onChange={(e) => setEditOverallStatus(e.target.value)}
                options={[
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
