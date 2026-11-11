import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { EmployeeDocument } from '../../types/lifecycle';
import { lifecycleApi } from '../../api/lifecycleApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

interface DocumentationTabProps {
  canVerify: boolean;
}

export const DocumentationTab: React.FC<DocumentationTabProps> = ({ canVerify }) => {
  const [searchParams] = useSearchParams();
  const empParam = searchParams.get('employee_id');
  const recordParam = searchParams.get('record_id');

  const [records, setRecords] = useState<EmployeeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Verify Modal
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lifecycleApi.listDocuments({
        page,
        size: pageSize,
        status: statusFilter || undefined,
      });
      setRecords(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Record-level direct navigation support
  useEffect(() => {
    if ((empParam || recordParam) && records.length > 0 && !selectedDoc) {
      const match = records.find(
        (d) =>
          (recordParam && String(d.id) === recordParam) ||
          (empParam && String(d.employee_id) === empParam)
      );
      if (match) {
        setSelectedDoc(match);
        setVerifyStatus('VERIFIED');
        setVerifyNotes(match.verification_notes || '');
      }
    }
  }, [empParam, recordParam, records, selectedDoc]);

  const handleOpenVerify = (doc: EmployeeDocument) => {
    setSelectedDoc(doc);
    setVerifyStatus('VERIFIED');
    setVerifyNotes(doc.verification_notes || '');
  };

  const handleVerifySubmit = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      await lifecycleApi.verifyDocument(selectedDoc.id, {
        status: verifyStatus,
        verification_notes: verifyNotes,
      });
      setSelectedDoc(null);
      fetchRecords();
    } catch (err) {
      console.error('Failed to verify document', err);
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
              { value: '', label: 'All Document Statuses' },
              { value: 'VERIFIED', label: 'Verified' },
              { value: 'SUBMITTED', label: 'Submitted (Pending Review)' },
              { value: 'PENDING_SUBMISSION', label: 'Pending Submission' },
              { value: 'REJECTED', label: 'Rejected' },
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

      {/* Documents Table */}
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
              title="No Documents Found"
              description="No employee compliance documents match the selected filter criteria."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Document Name</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Submission Date</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead>Notes</TableHead>
                {canVerify && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-[#FAF8FE] transition-colors">
                  <TableCell>
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-4.5 h-4.5 text-[#5425CB] shrink-0" />
                      <span className="font-bold text-[#1E162B] text-[15px]">{doc.document_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270]">
                    {doc.requirement_name || `Req #${doc.requirement_id}`}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270] font-mono">
                    EMP-{String(doc.employee_id).padStart(4, '0')}
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#1E162B] whitespace-nowrap font-mono">
                    {doc.submission_date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        doc.status === 'VERIFIED'
                          ? 'success'
                          : doc.status === 'REJECTED'
                          ? 'danger'
                          : doc.status === 'SUBMITTED'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[14px] sm:text-[15px] text-[#5C5270] max-w-xs truncate">
                    {doc.verification_notes || <span className="italic text-slate-400">None</span>}
                  </TableCell>
                  {canVerify && (
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[14px] font-bold h-10 px-4"
                        onClick={() => handleOpenVerify(doc)}
                      >
                        Verify
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

      {/* Modal: Document Verification */}
      {selectedDoc && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
          title={`Document Verification: ${selectedDoc.document_name}`}
          description={`Verify compliance document submitted by Employee #${selectedDoc.employee_id}`}
          maxWidth="md"
          footer={
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleVerifySubmit}>
                {submitting ? 'Updating...' : 'Confirm Verification'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Verification Decision</label>
              <Select
                value={verifyStatus}
                onChange={(e) => setVerifyStatus(e.target.value as any)}
                options={[
                  { value: 'VERIFIED', label: 'Verify & Approve Document' },
                  { value: 'REJECTED', label: 'Reject Document (Requires Re-submission)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">Verification / Rejection Notes</label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={3}
                placeholder="Audit notes or clear instructions for re-upload..."
                className="w-full rounded-lg border border-border/70 p-2 text-xs focus:ring-1 focus:ring-brand-primary outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
