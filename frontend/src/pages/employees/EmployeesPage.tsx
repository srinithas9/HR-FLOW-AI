import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  UserPlus,
  Edit2,
  ExternalLink,
  Building,
  User,
  Calendar,
  X,
  Clock,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { employeeApi } from '../../api/employeeApi';
import {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeFilterOptions,
  EmployeeFilterParams,
} from '../../types/employee';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const INDIAN_LOCATIONS = [
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Mumbai',
  'Gurugram',
];

export const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role?.role_code;
  const canManage = ['ADMIN', 'HR_MANAGER'].includes(userRole || '');

  // Directory Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterOptions, setFilterOptions] = useState<EmployeeFilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [size] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<EmployeeCreate>({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    department_id: 1,
    designation: '',
    location: 'Bengaluru',
    employment_status: 'PROBATION',
    date_of_joining: new Date().toISOString().split('T')[0],
    manager_id: undefined,
  });

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Filter Options
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const opts = await employeeApi.getFilterOptions();
        setFilterOptions(opts);
        if (opts.departments.length > 0 && !formData.department_id) {
          setFormData((prev) => ({ ...prev, department_id: opts.departments[0].id }));
        }
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };
    loadFilters();
  }, []);

  // Fetch Employees
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: EmployeeFilterParams = {
        page,
        size,
        search: debouncedSearch || undefined,
        department_id: selectedDept,
        designation: selectedDesignation || undefined,
        manager_id: selectedManager,
        employment_status: selectedStatus || undefined,
        sort_by: 'id',
        sort_order: 'asc',
      };

      const res = await employeeApi.listEmployees(params);
      setEmployees(res.items);
      setTotal(res.pagination?.total ?? res.items.length);
      setTotalPages(res.pagination?.total_pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employee directory.');
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    size,
    debouncedSearch,
    selectedDept,
    selectedDesignation,
    selectedManager,
    selectedStatus,
  ]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const hasActiveFilters = Boolean(
    search ||
      selectedDept !== undefined ||
      selectedDesignation ||
      selectedManager !== undefined ||
      selectedStatus
  );

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedDept(undefined);
    setSelectedDesignation('');
    setSelectedManager(undefined);
    setSelectedStatus('');
    setPage(1);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      employee_code: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      department_id: filterOptions?.departments[0]?.id || 1,
      designation: '',
      location: 'Bengaluru',
      employment_status: 'PROBATION',
      date_of_joining: new Date().toISOString().split('T')[0],
      manager_id: undefined,
    });
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone_number: emp.phone_number,
      department_id: emp.department_id,
      designation: emp.designation,
      location: emp.location,
      employment_status: emp.employment_status,
      date_of_joining: emp.date_of_joining,
      manager_id: emp.manager_id || undefined,
    });
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.designation) {
      setModalError('Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      await employeeApi.createEmployee(formData);
      setIsCreateModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    if (formData.manager_id && formData.manager_id === selectedEmployee.id) {
      setModalError('An employee cannot report to themselves.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatePayload: EmployeeUpdate = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone_number: formData.phone_number,
        department_id: formData.department_id,
        designation: formData.designation,
        location: formData.location,
        employment_status: formData.employment_status,
        date_of_joining: formData.date_of_joining,
        manager_id: formData.manager_id || null,
      };
      await employeeApi.updateEmployee(selectedEmployee.id, updatePayload);
      setIsEditModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to update employee details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (fname: string, lname: string) => {
    return `${fname?.[0] || ''}${lname?.[0] || ''}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ACTIVE':
        return <Badge variant="success">Confirmed</Badge>;
      case 'PROBATION':
        return <Badge variant="warning">Probation</Badge>;
      case 'NOTICE_PERIOD':
        return <Badge variant="danger">Notice Period</Badge>;
      case 'RESIGNED':
        return <Badge variant="neutral">Resigned</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getLifecycleBadge = (stage?: string | null) => {
    if (!stage) return null;
    const s = stage.toUpperCase();
    if (s === 'ONBOARDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3" /> Onboarding In Progress
        </span>
      );
    }
    if (s === 'PROBATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Under Probation
        </span>
      );
    }
    if (s === 'CONFIRMATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Clock className="w-3 h-3" /> Confirmation Pending
        </span>
      );
    }
    if (s === 'OFFBOARDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <Clock className="w-3 h-3" /> Offboarding Clearance
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] lg:text-[32px] font-extrabold text-[#1E162B] tracking-tight">
            Employee Directory
          </h1>
          <p className="mt-1 text-[15px] sm:text-[16px] text-[#5C5270] font-medium">
            Find employee information, understand employee status and access their HR records.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreate}
            leftIcon={<UserPlus className="w-5 h-5 shrink-0" />}
            className="shadow-sm self-start sm:self-auto bg-[#5425CB] hover:bg-[#431DA7] text-white text-[15px] sm:text-[16px] font-bold h-12 px-6 rounded-xl cursor-pointer"
          >
            Add Employee
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E2DBEB] p-6 shadow-xs space-y-5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by employee name, employee ID (e.g. EMP-00101), or work email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-12 pr-11 text-[15px] sm:text-[16px] bg-white border border-[#E2DBEB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB] transition-all placeholder:text-gray-400 text-[#1E162B] font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Combined Filter Controls - 4 clean columns on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-[#E2DBEB]">
          {/* Department */}
          <div>
            <label className="block text-[14px] sm:text-[15px] font-bold text-[#1E162B] mb-2">Department</label>
            <select
              value={selectedDept === undefined ? '' : selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="w-full h-12 text-[14px] sm:text-[15px] py-2 px-3.5 bg-white border border-[#E2DBEB] rounded-xl text-[#1E162B] font-semibold focus:outline-none focus:border-[#5425CB] cursor-pointer"
            >
              <option value="">All Departments</option>
              {filterOptions?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className="block text-[14px] sm:text-[15px] font-bold text-[#1E162B] mb-2">Designation</label>
            <select
              value={selectedDesignation}
              onChange={(e) => {
                setSelectedDesignation(e.target.value);
                setPage(1);
              }}
              className="w-full h-12 text-[14px] sm:text-[15px] py-2 px-3.5 bg-white border border-[#E2DBEB] rounded-xl text-[#1E162B] font-semibold focus:outline-none focus:border-[#5425CB] cursor-pointer"
            >
              <option value="">All Designations</option>
              {filterOptions?.designations.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
          </div>

          {/* Reporting Manager */}
          <div>
            <label className="block text-[14px] sm:text-[15px] font-bold text-[#1E162B] mb-2">Reporting Manager</label>
            <select
              value={selectedManager === undefined ? '' : selectedManager}
              onChange={(e) => {
                setSelectedManager(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="w-full h-12 text-[14px] sm:text-[15px] py-2 px-3.5 bg-white border border-[#E2DBEB] rounded-xl text-[#1E162B] font-semibold focus:outline-none focus:border-[#5425CB] cursor-pointer"
            >
              <option value="">All Managers</option>
              {filterOptions?.managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employment Status */}
          <div>
            <label className="block text-[14px] sm:text-[15px] font-bold text-[#1E162B] mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full h-12 text-[14px] sm:text-[15px] py-2 px-3.5 bg-white border border-[#E2DBEB] rounded-xl text-[#1E162B] font-semibold focus:outline-none focus:border-[#5425CB] cursor-pointer"
            >
              <option value="">All Statuses</option>
              {filterOptions?.employment_statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Action */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 text-xs text-gray-600">
            <span>Filtering active directory scope</span>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && employees.length === 0 && (
        <EmptyState
          icon={Users}
          title="No employees found"
          description={
            hasActiveFilters
              ? 'No employee records match the active search or filter criteria. Try resetting filters.'
              : 'No employee records available in your authorized directory scope.'
          }
          actionLabel={hasActiveFilters ? 'Clear All Filters' : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
        />
      )}

      {/* Responsive Employee Cards Grid */}
      {!isLoading && employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
          {employees.map((emp) => {
            const initials = getInitials(emp.first_name, emp.last_name);
            const lifecycleIndicator = getLifecycleBadge(emp.current_lifecycle_stage);

            return (
              <div
                key={emp.id}
                onClick={() => navigate(`/employees/${emp.id}`)}
                className="bg-white rounded-2xl border border-[#E2DBEB] hover:border-[#5425CB]/50 hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Card Header: Avatar, Name, Code, Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-13 h-13 rounded-2xl bg-[#EDE7FF] text-[#5425CB] flex items-center justify-center font-extrabold text-[16px] border border-[#DCD0FF] shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[#1E162B] text-[17px] sm:text-[18px] leading-tight">
                          {emp.first_name} {emp.last_name}
                        </h3>
                        <span className="text-[14px] font-mono text-[#5C5270] font-bold">
                          {emp.employee_code}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(emp.employment_status)}
                  </div>

                  {/* Designation & Department */}
                  <div className="space-y-2.5 mb-4 text-[14px] sm:text-[15px] text-[#5C5270]">
                    <div className="flex items-center gap-2.5 font-bold text-[#1E162B]">
                      <Briefcase className="w-4.5 h-4.5 text-[#5425CB] shrink-0" />
                      <span className="truncate">{emp.designation}</span>
                    </div>
                    <div className="flex items-center gap-2.5 font-medium">
                      <Building className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span className="truncate">{emp.department_name || 'Department Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 font-medium">
                      <User className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span className="truncate">
                        {emp.manager_name ? `Reports to ${emp.manager_name}` : 'No direct manager'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 font-medium">
                      <Calendar className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span>Joined {emp.date_of_joining}</span>
                    </div>
                  </div>

                  {/* Lifecycle Indicator (if applicable) */}
                  {lifecycleIndicator && <div className="mb-4">{lifecycleIndicator}</div>}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 border-t border-[#E2DBEB] flex items-center justify-between gap-3 mt-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    rightIcon={<ExternalLink className="w-4.5 h-4.5" />}
                    className="flex-1 justify-center text-[14px] sm:text-[15px] font-bold h-11 border-[#DCD5E8] text-[#1E162B] hover:bg-[#FAF8FE] hover:text-[#5425CB] hover:border-[#5425CB] rounded-xl cursor-pointer"
                  >
                    View Profile
                  </Button>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={(e) => handleOpenEdit(emp, e)}
                      leftIcon={<Edit2 className="w-4.5 h-4.5 text-[#5C5270]" />}
                      className="px-3.5 text-[14px] sm:text-[15px] font-bold text-[#5C5270] hover:text-[#1E162B] h-11 rounded-xl cursor-pointer"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium">{(page - 1) * size + 1}</span> to{' '}
            <span className="font-medium">{Math.min(page * size, total)}</span> of {total} employees
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Employee"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {modalError && <Alert variant="error">{modalError}</Alert>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Employee ID *"
              value={formData.employee_code}
              onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
              placeholder="e.g. EMP-00999"
              required
            />

            <Select
              label="Department *"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
              options={
                filterOptions?.departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })) || []
              }
              required
            />

            <Input
              label="First Name *"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />

            <Input
              label="Last Name *"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />

            <Input
              label="Work Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="employee@auratech.in"
              required
            />

            <Input
              label="Phone Number *"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="+91 98765 43210"
              required
            />

            <Input
              label="Designation *"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g. Senior Software Engineer"
              required
            />

            <Select
              label="Office Location *"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              options={INDIAN_LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
              required
            />

            <Select
              label="Employment Status *"
              value={formData.employment_status}
              onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
              options={[
                { value: 'PROBATION', label: 'Probation' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'NOTICE_PERIOD', label: 'Notice Period' },
                { value: 'RESIGNED', label: 'Resigned' },
              ]}
              required
            />

            <Input
              label="Date of Joining *"
              type="date"
              value={formData.date_of_joining}
              onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
              required
            />

            <div className="sm:col-span-2">
              <Select
                label="Reporting Manager"
                value={formData.manager_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    manager_id: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                options={[
                  { value: '', label: 'None (Top-level / Self-managed)' },
                  ...(filterOptions?.managers.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.designation})`,
                  })) || []),
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Employee — ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {modalError && <Alert variant="error">{modalError}</Alert>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Employee ID"
              value={formData.employee_code}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />

            <Select
              label="Department *"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
              options={
                filterOptions?.departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })) || []
              }
              required
            />

            <Input
              label="First Name *"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />

            <Input
              label="Last Name *"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />

            <Input
              label="Work Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Phone Number *"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              required
            />

            <Input
              label="Designation *"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              required
            />

            <Select
              label="Office Location *"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              options={INDIAN_LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
              required
            />

            <Select
              label="Employment Status *"
              value={formData.employment_status}
              onChange={(e) => setFormData({ ...formData, employment_status: e.target.value })}
              options={[
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'PROBATION', label: 'Probation' },
                { value: 'NOTICE_PERIOD', label: 'Notice Period' },
                { value: 'RESIGNED', label: 'Resigned' },
              ]}
              required
            />

            <Input
              label="Date of Joining *"
              type="date"
              value={formData.date_of_joining}
              onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
              required
            />

            <div className="sm:col-span-2">
              <Select
                label="Reporting Manager"
                value={formData.manager_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    manager_id: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                options={[
                  { value: '', label: 'None (Top-level / Self-managed)' },
                  ...(filterOptions?.managers
                    .filter((m) => m.id !== selectedEmployee?.id)
                    .map((m) => ({
                      value: m.id,
                      label: `${m.name} (${m.designation})`,
                    })) || []),
                ]}
              />
              <p className="mt-1 text-xs text-gray-500">
                Self-reporting and circular reporting structures are prevented.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
