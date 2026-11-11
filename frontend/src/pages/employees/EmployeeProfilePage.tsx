import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Building,
  MapPin,
  User,
  Calendar,
  Clock,
  FileText,
  Award,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  CheckSquare,
  ListTodo,
  History,
  Activity,
  Layers,
} from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import {
  EmployeeProfile,
  EmployeeUpdate,
  EmployeeFilterOptions,
} from '../../types/employee';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const INDIAN_LOCATIONS = [
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Mumbai',
  'Gurugram',
];

export const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [filterOptions, setFilterOptions] = useState<EmployeeFilterOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'lifecycle' | 'actions' | 'documents' | 'history'
  >('overview');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EmployeeUpdate>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProfile = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getEmployeeProfile(Number(id));
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    employeeApi.getFilterOptions().then(setFilterOptions).catch(console.error);
  }, [id]);

  const handleOpenEdit = () => {
    if (!profile) return;
    const emp = profile.employee;
    setEditFormData({
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
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (editFormData.manager_id && editFormData.manager_id === profile.employee.id) {
      setEditError('An employee cannot report to themselves.');
      return;
    }

    setIsSubmitting(true);
    setEditError(null);
    try {
      await employeeApi.updateEmployee(profile.employee.id, editFormData);
      setIsEditModalOpen(false);
      fetchProfile();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update employee details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80 col-span-1 rounded-xl" />
          <Skeleton className="h-80 col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/employees')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Directory
        </Button>
        <Alert variant="error">{error || 'Employee record not found.'}</Alert>
      </div>
    );
  }

  const { employee } = profile;
  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ACTIVE':
        return <Badge variant="success">Confirmed Full-Time</Badge>;
      case 'PROBATION':
        return <Badge variant="warning">Probationary Period</Badge>;
      case 'NOTICE_PERIOD':
        return <Badge variant="danger">Serving Notice Period</Badge>;
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3.5 h-3.5" /> Stage: Onboarding
        </span>
      );
    }
    if (s === 'PROBATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5" /> Stage: Probation
        </span>
      );
    }
    if (s === 'CONFIRMATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Clock className="w-3.5 h-3.5" /> Stage: Confirmation
        </span>
      );
    }
    if (s === 'OFFBOARDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <Clock className="w-3.5 h-3.5" /> Stage: Offboarding
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
        Stage: {stage}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/employees')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Directory
        </Button>
      </div>

      {/* Profile Header Banner */}
      <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-18 h-18 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-2xl border-2 border-purple-200 shrink-0 shadow-xs">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E162B] tracking-tight">
                  {employee.first_name} {employee.last_name}
                </h1>
                <span className="font-mono text-sm px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md font-bold border border-gray-200">
                  {employee.employee_code}
                </span>
                {getStatusBadge(employee.employment_status)}
                {getLifecycleBadge(profile.current_lifecycle_stage)}
              </div>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2.5 text-[14px] sm:text-[15px] text-[#5C5270]">
                <span className="font-semibold text-[#1E162B]">{employee.designation}</span>
                <span>•</span>
                <span>{employee.department_name || 'Department Unassigned'}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#796F8F]" />
                  {employee.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#796F8F]" />
                  Joined {employee.date_of_joining}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Action if authorized */}
          {profile.can_edit && (
            <div className="self-start md:self-center">
              <Button
                variant="outline"
                size="md"
                onClick={handleOpenEdit}
                leftIcon={<Edit2 className="w-4.5 h-4.5" />}
              >
                Edit Employee
              </Button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-[#E2DBEB] mt-7 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#5425CB] text-white shadow-xs'
                : 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#FAF8FE]'
            }`}
          >
            <User className="w-4 h-4" /> Employment Details
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`px-4 py-2.5 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'lifecycle'
                ? 'bg-[#5425CB] text-white shadow-xs'
                : 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#FAF8FE]'
            }`}
          >
            <Layers className="w-4 h-4" /> Lifecycle Journey
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2.5 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-[#5425CB] text-white shadow-xs'
                : 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#FAF8FE]'
            }`}
          >
            <ListTodo className="w-4 h-4" /> Actions & Tasks
            {profile.pending_actions.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === 'actions' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {profile.pending_actions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2.5 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-[#5425CB] text-white shadow-xs'
                : 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#FAF8FE]'
            }`}
          >
            <FileText className="w-4 h-4" /> Documents & Compliance
            <span className={`ml-1 text-[12px] ${activeTab === 'documents' ? 'text-white/80' : 'text-[#796F8F]'}`}>
              ({profile.documents.length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-[14px] sm:text-[15px] font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#5425CB] text-white shadow-xs'
                : 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#FAF8FE]'
            }`}
          >
            <Activity className="w-4 h-4" /> Activity Log
            <span className={`ml-1 text-[12px] ${activeTab === 'history' ? 'text-white/80' : 'text-[#796F8F]'}`}>
              ({profile.activity_history.length})
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Employment Details */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact & Location Info */}
          <Card>
            <CardHeader className="pb-3 border-b border-[#E1DBEA]/70">
              <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-purple-600" /> Contact & Workplace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-[15px]">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Work Email</span>
                <span className="font-bold text-[#1E162B] select-all">{employee.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Phone Number</span>
                <span className="font-bold text-[#1E162B]">{employee.phone_number}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Office Hub</span>
                <span className="font-bold text-[#1E162B]">{employee.location}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#5C5270] font-medium text-[14px]">Employee ID</span>
                <span className="font-mono font-bold text-[#1E162B]">{employee.employee_code}</span>
              </div>
            </CardContent>
          </Card>

          {/* Organizational Hierarchy */}
          <Card>
            <CardHeader className="pb-3 border-b border-[#E1DBEA]/70">
              <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center gap-2.5">
                <Building className="w-5 h-5 text-purple-600" /> Organizational Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-[15px]">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Department</span>
                <span className="font-bold text-[#1E162B]">
                  {employee.department_name || 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Designation</span>
                <span className="font-bold text-[#1E162B]">{employee.designation}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-[#5C5270] font-medium text-[14px]">Reporting Manager</span>
                <span className="font-bold text-[#1E162B]">
                  {employee.manager_name || 'None (Top-Level Executive)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#5C5270] font-medium text-[14px]">Date of Joining</span>
                <span className="font-bold text-[#1E162B]">{employee.date_of_joining}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Lifecycle Journey across 6 Processes */}
      {activeTab === 'lifecycle' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Onboarding Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <User className="w-4.5 h-4.5 text-blue-600" /> 1. Onboarding
                </h3>
                {profile.onboarding ? (
                  <Badge
                    variant={
                      profile.onboarding.overall_status === 'COMPLETED' ? 'success' : 'warning'
                    }
                  >
                    {profile.onboarding.overall_status}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Not Initiated</Badge>
                )}
              </div>
              {profile.onboarding ? (
                <div className="text-[14px] sm:text-[15px] space-y-2 text-[#5C5270]">
                  <p>
                    <span className="text-[#796F8F] font-medium">Start Date:</span> {profile.onboarding.start_date}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Target Date:</span>{' '}
                    {profile.onboarding.target_completion_date}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">IT Assets:</span>{' '}
                    <span className="font-bold text-[#1E162B]">{profile.onboarding.it_asset_status}</span>
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Background Verification:</span>{' '}
                    <span className="font-bold text-[#1E162B]">{profile.onboarding.bgv_status}</span>
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-gray-400 italic">No onboarding record for this employee.</p>
              )}
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/onboarding')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Onboarding Module
                </Button>
              </div>
            </div>

            {/* 2. Probation Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <Clock className="w-4.5 h-4.5 text-amber-600" /> 2. Probation
                </h3>
                {profile.probation ? (
                  <Badge
                    variant={
                      profile.probation.status === 'COMPLETED' ? 'success' : 'warning'
                    }
                  >
                    {profile.probation.status}
                  </Badge>
                ) : (
                  <Badge variant="neutral">N/A</Badge>
                )}
              </div>
              {profile.probation ? (
                <div className="text-[14px] sm:text-[15px] space-y-2 text-[#5C5270]">
                  <p>
                    <span className="text-[#796F8F] font-medium">Start Date:</span>{' '}
                    {profile.probation.probation_start_date}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">End Date:</span>{' '}
                    {profile.probation.probation_end_date}
                  </p>
                  {profile.probation.extended_end_date && (
                    <p className="text-amber-700">
                      <span className="text-[#796F8F] font-medium">Extended Date:</span>{' '}
                      {profile.probation.extended_end_date}
                    </p>
                  )}
                  <p>
                    <span className="text-[#796F8F] font-medium">Manager Evaluation:</span>{' '}
                    <span className="font-semibold text-[#1E162B]">{profile.probation.manager_feedback || 'Pending evaluation'}</span>
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-gray-400 italic">No active probation record.</p>
              )}
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/probation')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Probation Module
                </Button>
              </div>
            </div>

            {/* 3. Confirmation Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-purple-600" /> 3. Confirmation
                </h3>
                {profile.confirmation ? (
                  <Badge
                    variant={
                      profile.confirmation.status === 'CONFIRMED' ||
                      profile.confirmation.status === 'APPROVED'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {profile.confirmation.status}
                  </Badge>
                ) : (
                  <Badge variant="neutral">N/A</Badge>
                )}
              </div>
              {profile.confirmation ? (
                <div className="text-[14px] sm:text-[15px] space-y-2 text-[#5C5270]">
                  <p>
                    <span className="text-[#796F8F] font-medium">Confirmation Due:</span>{' '}
                    {profile.confirmation.confirmation_due_date ||
                      profile.confirmation.scheduled_confirmation_date ||
                      'Scheduled'}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Effective Date:</span>{' '}
                    {profile.confirmation.effective_confirmation_date || 'Pending approval'}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Letter Issued:</span>{' '}
                    <span className="font-bold text-[#1E162B]">
                      {profile.confirmation.confirmation_letter_issued ? 'Yes' : 'No'}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-gray-400 italic">No confirmation record found.</p>
              )}
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/confirmation')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Confirmation Module
                </Button>
              </div>
            </div>

            {/* 4. Documentation Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-indigo-600" /> 4. Documentation
                </h3>
                <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {profile.documents.filter((d) => d.status === 'VERIFIED').length} /{' '}
                  {profile.documents.length} Verified
                </span>
              </div>
              <div className="text-[14px] space-y-2 text-[#5C5270]">
                {profile.documents.slice(0, 3).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <span className="truncate pr-2 font-medium text-[#1E162B]">{doc.requirement_name || doc.document_name}</span>
                    <Badge variant={doc.status === 'VERIFIED' ? 'success' : 'neutral'}>
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/compliance')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Compliance Module
                </Button>
              </div>
            </div>

            {/* 5. Performance Reviews Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-emerald-600" /> 5. Performance Reviews
                </h3>
                <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  {profile.performance_reviews.length} Cycles
                </span>
              </div>
              {profile.performance_reviews.length > 0 ? (
                <div className="text-[14px] sm:text-[15px] space-y-2 text-[#5C5270]">
                  <p>
                    <span className="text-[#796F8F] font-medium">Latest Cycle:</span>{' '}
                    <span className="font-bold text-[#1E162B]">{profile.performance_reviews[0].review_cycle}</span>
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Deadline:</span>{' '}
                    {profile.performance_reviews[0].review_submission_deadline}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[#796F8F] font-medium">Status:</span>{' '}
                    <Badge variant="neutral">{profile.performance_reviews[0].status}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-[14px] text-gray-400 italic">No performance review records.</p>
              )}
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/performance')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Performance Module
                </Button>
              </div>
            </div>

            {/* 6. Offboarding Card */}
            <div className="bg-white rounded-2xl border border-[#E1DBEA] p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[#1E162B] text-[16px] sm:text-[17px] flex items-center gap-2">
                  <LogOut className="w-4.5 h-4.5 text-rose-600" /> 6. Offboarding
                </h3>
                {profile.offboarding ? (
                  <Badge variant="danger">{profile.offboarding.overall_status}</Badge>
                ) : (
                  <Badge variant="neutral">Not Applicable</Badge>
                )}
              </div>
              {profile.offboarding ? (
                <div className="text-[14px] sm:text-[15px] space-y-2 text-[#5C5270]">
                  <p>
                    <span className="text-[#796F8F] font-medium">Resignation:</span>{' '}
                    {profile.offboarding.resignation_date}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Last Working Day:</span>{' '}
                    {profile.offboarding.last_working_day}
                  </p>
                  <p>
                    <span className="text-[#796F8F] font-medium">Clearance:</span>{' '}
                    <span className="font-bold text-[#1E162B]">{profile.offboarding.clearance_status}</span>
                  </p>
                </div>
              ) : (
                <p className="text-[14px] text-gray-400 italic">Employee is in good standing.</p>
              )}
              <div className="pt-3 border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/offboarding')}
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  className="w-full text-[14px] font-bold text-primary-600 justify-center h-10"
                >
                  Go to Offboarding Module
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Actions & Tasks */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          {/* Outstanding Action Items */}
          <Card>
            <CardHeader className="border-b border-[#E1DBEA]/70 pb-4">
              <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600" /> Outstanding Action Items Concerning Employee
                </span>
                <span className="text-[14px] font-medium text-[#5C5270]">
                  {profile.pending_actions.length} actionable items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {profile.pending_actions.length === 0 ? (
                <p className="text-[15px] text-[#5C5270] italic py-6 text-center">
                  No outstanding actions or pending reviews for this employee.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {profile.pending_actions.map((act) => (
                    <div
                      key={act.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-[15px] text-[#1E162B]">{act.title}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded uppercase bg-gray-100 text-[#5C5270] font-mono">
                            {act.category}
                          </span>
                          <Badge
                            variant={
                              act.priority === 'CRITICAL' || act.priority === 'HIGH'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {act.status}
                          </Badge>
                        </div>
                        <div className="text-[14px] text-[#5C5270] flex items-center gap-4">
                          {act.due_date && <span>Target: <strong className="text-[#1E162B] font-semibold">{act.due_date}</strong></span>}
                          {act.responsible_party && (
                            <span>Responsible: <strong className="text-[#1E162B] font-semibold">{act.responsible_party}</strong></span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(act.link_path)}
                        rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                        className="text-[14px] font-bold self-start sm:self-auto h-10 px-4"
                      >
                        Action Workflow
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* HR Tasks Concerning the Employee */}
          <Card>
            <CardHeader className="border-b border-[#E1DBEA]/70 pb-4">
              <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <CheckSquare className="w-5 h-5 text-purple-600" /> HR Lifecycle Tasks Concerning Employee
                </span>
                <span className="text-[14px] font-medium text-[#5C5270]">
                  Subject = {employee.first_name} {employee.last_name} ({profile.hr_tasks.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 p-0 sm:p-6 sm:pt-4">
              {profile.hr_tasks.length === 0 ? (
                <p className="text-[15px] text-[#5C5270] italic py-6 text-center">
                  No HR tasks found for this employee.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px] sm:text-[15px]">
                    <thead>
                      <tr className="border-b border-[#E1DBEA] text-[#5C5270] h-12 uppercase tracking-wider text-[12px] sm:text-[13px] font-bold">
                        <th className="py-3 px-4 font-bold">Task Code</th>
                        <th className="py-3 px-4 font-bold">Title</th>
                        <th className="py-3 px-4 font-bold">Category</th>
                        <th className="py-3 px-4 font-bold">Assigned To</th>
                        <th className="py-3 px-4 font-bold">Due Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {profile.hr_tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-[#FAF8FE] transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-[#1E162B]">
                            {task.task_code}
                          </td>
                          <td className="py-4 px-4 font-semibold text-[#1E162B]">{task.title}</td>
                          <td className="py-4 px-4 text-[#5C5270]">{task.category}</td>
                          <td className="py-4 px-4 text-[#5C5270]">{task.owner_name || 'Unassigned'}</td>
                          <td className="py-4 px-4 text-[#5C5270] font-mono">{task.due_date || '—'}</td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={
                                task.status === 'COMPLETED'
                                  ? 'success'
                                  : task.status === 'DELAYED'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {task.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(task.link_path)}
                              className="text-primary-600 font-bold text-[14px] h-9 px-3"
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
            </CardContent>
          </Card>

          {/* Tasks Assigned to the Employee */}
          {profile.assigned_tasks.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[#E1DBEA]/70 pb-4">
                <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <ListTodo className="w-5 h-5 text-emerald-600" /> Operational Tasks Assigned to Employee
                  </span>
                  <span className="text-[14px] font-medium text-[#5C5270]">
                    Owner = {employee.first_name} {employee.last_name} ({profile.assigned_tasks.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 p-0 sm:p-6 sm:pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px] sm:text-[15px]">
                    <thead>
                      <tr className="border-b border-[#E1DBEA] text-[#5C5270] h-12 uppercase tracking-wider text-[12px] sm:text-[13px] font-bold">
                        <th className="py-3 px-4 font-bold">Task Code</th>
                        <th className="py-3 px-4 font-bold">Title</th>
                        <th className="py-3 px-4 font-bold">Category</th>
                        <th className="py-3 px-4 font-bold">Due Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {profile.assigned_tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-[#FAF8FE] transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-[#1E162B]">
                            {task.task_code}
                          </td>
                          <td className="py-4 px-4 font-semibold text-[#1E162B]">{task.title}</td>
                          <td className="py-4 px-4 text-[#5C5270]">{task.category}</td>
                          <td className="py-4 px-4 text-[#5C5270] font-mono">{task.due_date || '—'}</td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={
                                task.status === 'COMPLETED'
                                  ? 'success'
                                  : task.status === 'DELAYED'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {task.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(task.link_path)}
                              className="text-primary-600 font-bold text-[14px] h-9 px-3"
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Documents & Compliance */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader className="border-b border-[#E1DBEA]/70 pb-4">
            <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-purple-600" /> Employee Documents & Verification Status
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/compliance')}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                className="text-[14px] font-bold h-10 px-4"
              >
                Compliance Workspace
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 p-0 sm:p-6 sm:pt-4">
            {profile.documents.length === 0 ? (
              <p className="text-[15px] text-[#5C5270] italic py-6 text-center">
                No compliance documents recorded for this employee.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px] sm:text-[15px]">
                  <thead>
                    <tr className="border-b border-[#E1DBEA] text-[#5C5270] h-12 uppercase tracking-wider text-[12px] sm:text-[13px] font-bold">
                      <th className="py-3 px-4 font-bold">Requirement</th>
                      <th className="py-3 px-4 font-bold">Document Name</th>
                      <th className="py-3 px-4 font-bold">Submitted On</th>
                      <th className="py-3 px-4 font-bold">Verification Status</th>
                      <th className="py-3 px-4 font-bold">Verification Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#FAF8FE] transition-colors">
                        <td className="py-4 px-4 font-semibold text-[#1E162B]">
                          {doc.requirement_name || 'Standard Document'}
                        </td>
                        <td className="py-4 px-4 text-[#5C5270] font-mono">{doc.document_name}</td>
                        <td className="py-4 px-4 text-[#5C5270] font-mono">{doc.submission_date || 'Pending'}</td>
                        <td className="py-4 px-4">
                          <Badge
                            variant={
                              doc.status === 'VERIFIED'
                                ? 'success'
                                : doc.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-[#5C5270] italic">
                          {doc.verification_notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Activity & History from ActivityLog */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader className="border-b border-[#E1DBEA]/70 pb-4">
            <CardTitle className="text-lg sm:text-xl font-extrabold text-[#1E162B] flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-purple-600" /> Chronological Event History & Audit Log
              </span>
              <span className="text-[14px] font-medium text-[#5C5270]">
                {profile.activity_history.length} logged events
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {profile.activity_history.length === 0 ? (
              <p className="text-[15px] text-[#5C5270] italic py-6 text-center">
                No activity records found for this employee.
              </p>
            ) : (
              <div className="space-y-4">
                {profile.activity_history.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-[#FAF8FE]/80 text-[14px] sm:text-[15px]"
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#1E162B]">
                          {act.action} — {act.entity_type}
                        </span>
                        <span className="text-[#777387] font-mono text-[13px]">
                          {new Date(act.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-[#5C5270]">
                        Performed by <span className="font-semibold text-[#1E162B]">{act.user_name || 'System'}</span>
                      </p>
                      {act.details && Object.keys(act.details).length > 0 && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 text-[#1E162B] font-mono text-[12px] overflow-x-auto">
                          {JSON.stringify(act.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Employee — ${employee.first_name} ${employee.last_name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && <Alert variant="error">{editError}</Alert>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Employee ID"
              value={employee.employee_code}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />

            <Select
              label="Department *"
              value={editFormData.department_id || employee.department_id}
              onChange={(e) =>
                setEditFormData({ ...editFormData, department_id: Number(e.target.value) })
              }
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
              value={editFormData.first_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
              required
            />

            <Input
              label="Last Name *"
              value={editFormData.last_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
              required
            />

            <Input
              label="Work Email *"
              type="email"
              value={editFormData.email || ''}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />

            <Input
              label="Phone Number *"
              value={editFormData.phone_number || ''}
              onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
              required
            />

            <Input
              label="Designation *"
              value={editFormData.designation || ''}
              onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
              required
            />

            <Select
              label="Office Location *"
              value={editFormData.location || ''}
              onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
              options={INDIAN_LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
              required
            />

            <Select
              label="Employment Status *"
              value={editFormData.employment_status || ''}
              onChange={(e) =>
                setEditFormData({ ...editFormData, employment_status: e.target.value })
              }
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
              value={editFormData.date_of_joining || ''}
              onChange={(e) =>
                setEditFormData({ ...editFormData, date_of_joining: e.target.value })
              }
              required
            />

            <div className="sm:col-span-2">
              <Select
                label="Reporting Manager"
                value={editFormData.manager_id || ''}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    manager_id: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                options={[
                  { value: '', label: 'None (Top-level / Self-managed)' },
                  ...(filterOptions?.managers
                    .filter((m) => m.id !== employee.id)
                    .map((m) => ({
                      value: m.id,
                      label: `${m.name} (${m.designation})`,
                    })) || []),
                ]}
              />
              <p className="mt-1 text-xs text-gray-500">
                Self-reporting and circular reporting hierarchies are strictly blocked.
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
