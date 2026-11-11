import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import { PerformanceReview } from '../../types/lifecycle';
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

interface PerformanceTabProps {
  canInitiateCycle: boolean;
  canEdit: boolean;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({ canInitiateCycle, canEdit }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Cycle options
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create Cycle Modal
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [newCycleName, setNewCycleName] = useState('FY25-H1');
  const [newDeadline, setNewDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Edit Review Modal
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
  const [editSelfStatus, setEditSelfStatus] = useState<string>('');
  const [editManagerStatus, setEditManagerStatus] = useState<string>('');
  const [editRating, setEditRating] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // Fetch cycles on mount
  useEffect(() => {
    const loadCycles = async () => {
      try {
        const cycles = await lifecycleApi.listPerformanceCycles();
        setAvailableCycles(cycles);
      } catch (err) {
        console.error('Failed to load performance cycles', err);
      }
    };
    loadCycles();
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listPerformanceReviews({
        page,
        size: pageSize,
        cycle: selectedCycle || undefined,
        status: statusFilter || undefined,
      });
      setReviews(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load performance reviews', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedCycle, statusFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Record-level direct navigation support
  useEffect(() => {
    if ((empParam || recordParam) && reviews.length > 0 && !selectedReview) {
      const match = reviews.find(
        (r) =>
          (recordParam && String(r.id) === recordParam) ||
          (empParam && String(r.employee_id) === empParam)
      );
      if (match) {
        setSelectedReview(match);
        setEditSelfStatus(match.self_review_status);
        setEditManagerStatus(match.manager_review_status);
        setEditRating(match.rating ? String(match.rating) : '');
        setEditStatus(match.status);
      }
    }
  }, [empParam, recordParam, reviews, selectedReview]);

  const handleCreateCycleSubmit = async () => {
    if (!newCycleName || !newDeadline) return;
    setSubmitting(true);
    try {
      await lifecycleApi.createPerformanceCycle({
        cycle_name: newCycleName,
        submission_deadline: newDeadline,
      });
      setIsCycleModalOpen(false);
      // Reload cycles and table
      const cycles = await lifecycleApi.listPerformanceCycles();
      setAvailableCycles(cycles);
      setSelectedCycle(newCycleName);
      fetchReviews();
    } catch (err) {
      console.error('Failed to create review cycle', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (rev: PerformanceReview) => {
    setSelectedReview(rev);
    setEditSelfStatus(rev.self_review_status);
    setEditManagerStatus(rev.manager_review_status);
    setEditRating(rev.rating ? String(rev.rating) : '');
    setEditStatus(rev.status);
  };

  const handleEditSubmit = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      await lifecycleApi.updatePerformanceReview(selectedReview.id, {
        self_review_status: editSelfStatus,
        manager_review_status: editManagerStatus,
        rating: editRating ? Number(editRating) : undefined,
        status: editStatus,
      });
      setSelectedReview(null);
      fetchReviews();
    } catch (err) {
      console.error('Failed to update review', err);
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
          <div className="w-64">
            <Select
              value={selectedCycle}
              onChange={(e) => {
                setSelectedCycle(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Appraisal Cycles' },
                ...availableCycles.map((c) => ({ value: c, label: `Cycle: ${c}` })),
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

          <div className="w-56">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'SUBMITTED', label: 'Submitted' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              className="h-11 text-[14px] font-semibold"
            />
          </div>

          {(selectedCycle || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCycle('');
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
          {canInitiateCycle && (
            <Button variant="primary" onClick={() => setIsCycleModalOpen(true)} className="h-11 px-5 text-[14px] sm:text-[15px] font-bold rounded-xl cursor-pointer">
              <Plus className="w-4 h-4 mr-2" />
              Initiate Review Cycle
            </Button>
          )}
        </div>
      </div>

      {/* Performance Reviews Table */}
      <div className="bg-white rounded-2xl border border-[#E1DBEA] overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Performance Reviews in Selected Filter"
              description="No active appraisal reviews found. You can select historical cycles from the dropdown above or initiate a new appraisal cycle."
              actionLabel={canInitiateCycle ? "Initiate Review Cycle" : undefined}
              onAction={canInitiateCycle ? () => setIsCycleModalOpen(true) : undefined}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Self Review</TableHead>
                <TableHead>Manager Review</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((rev) => (
                <TableRow key={rev.id} className="hover:bg-[#FAF8FE] transition-colors">
                  <TableCell>
                    <div className="font-bold text-[#1E162B] text-[15px]">
                      {rev.employee_name || `Employee #${rev.employee_id}`}
                    </div>
                    <div className="text-[13px] text-[#5C5270] font-mono">{rev.employee_code}</div>
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {rev.department_name || '—'}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] font-bold text-[#5425CB]">
                    {rev.review_cycle}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {rev.reviewer_name || `Reviewer #${rev.reviewer_id}`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rev.self_review_status === 'COMPLETED' ? 'success' : 'neutral'}
                    >
                      {rev.self_review_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rev.manager_review_status === 'COMPLETED' ? 'success' : 'warning'}
                    >
                      {rev.manager_review_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[14px]">
                    {rev.rating ? (
                      <span className="inline-flex items-center font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80 text-[13px]">
                        <Star className="w-3.5 h-3.5 mr-1 fill-amber-500 text-amber-500" />
                        {Number(rev.rating).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[#796F8F] text-[14px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {rev.review_submission_deadline}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rev.status === 'COMPLETED' ? 'success' : 'brand'}
                    >
                      {rev.status}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => handleOpenEdit(rev)}
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

      {/* Modal: Initiate Performance Review Cycle */}
      <Modal
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        title="Initiate Performance Review Cycle"
        description="Launch an appraisal cycle across the organization with submission deadlines."
        maxWidth="md"
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setIsCycleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={submitting || !newCycleName}
              onClick={handleCreateCycleSubmit}
            >
              {submitting ? 'Initiating...' : 'Launch Cycle'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Cycle Name / Code</label>
            <Input
              type="text"
              value={newCycleName}
              onChange={(e) => setNewCycleName(e.target.value)}
              placeholder="e.g. FY25-H1 or Q1-2025"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Appraisal Submission Deadline</label>
            <Input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
          </div>

          <p className="text-xs text-text-secondary bg-surface-subtle p-2.5 rounded-lg border border-border/50">
            This will create draft performance review records for eligible employees and assign review responsibilities to their designated reporting managers.
          </p>
        </div>
      </Modal>

      {/* Modal: Update Performance Review */}
      {selectedReview && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReview(null)}
          title={`Update Performance Review: ${selectedReview.employee_name || `Employee #${selectedReview.employee_id}`}`}
          description={`Cycle: ${selectedReview.review_cycle}`}
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedReview(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleEditSubmit}>
                {submitting ? 'Saving...' : 'Save Review'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Self Review Status</label>
              <Select
                value={editSelfStatus}
                onChange={(e) => setEditSelfStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Manager Review Status</label>
              <Select
                value={editManagerStatus}
                onChange={(e) => setEditManagerStatus(e.target.value)}
                options={[
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'COMPLETED', label: 'Completed' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Rating (1.00 to 5.00)</label>
              <Input
                type="number"
                step="0.01"
                min="1.0"
                max="5.0"
                value={editRating}
                onChange={(e) => setEditRating(e.target.value)}
                placeholder="e.g. 4.25"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Overall Status</label>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={[
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'SUBMITTED', label: 'Submitted' },
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
