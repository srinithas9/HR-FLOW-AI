import React, { useState } from 'react';
import { 
  Settings, 
  Shield, 
  Bell, 
  Sliders, 
  Check, 
  User, 
  Save, 
  RotateCcw,
  Building,
  Clock,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';

interface UserPreferences {
  slaReminders: boolean;
  delayEscalations: boolean;
  weeklyDigest: boolean;
  defaultLandingPage: string;
  tablePageSize: string;
  dateFormat: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  slaReminders: true,
  delayEscalations: true,
  weeklyDigest: false,
  defaultLandingPage: '/dashboard',
  tablePageSize: '25',
  dateFormat: 'DD/MM/YYYY',
};

const PREFERENCES_STORAGE_KEY = 'hrflow_user_preferences';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role?.role_code;

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to defaults on storage error
    }
    return DEFAULT_PREFERENCES;
  });

  const [showSavedFeedback, setShowSavedFeedback] = useState(false);

  const handleToggle = (key: keyof Pick<UserPreferences, 'slaReminders' | 'delayEscalations' | 'weeklyDigest'>) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectChange = (key: keyof Pick<UserPreferences, 'defaultLandingPage' | 'tablePageSize' | 'dateFormat'>, value: string) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 3000);
    } catch (e) {
      console.error('Failed to save preferences to localStorage', e);
    }
  };

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E2DBEB]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EDE7F7] to-[#DDD1FA] text-[#5425CB] border border-[#DCD5E8] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <Settings className="w-5 h-5 text-[#5425CB]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E162B] tracking-tight">
              Settings & Preferences
            </h1>
            <p className="text-[13px] text-[#5C5270] mt-0.5">
              Manage your personal HR operations preferences, alert cadence, and display configuration.
            </p>
          </div>
        </div>

        {/* Global Save Action */}
        <div className="flex items-center gap-2.5">
          {showSavedFeedback && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              Preferences Saved
            </span>
          )}
          <Button 
            variant="outline" 
            size="md" 
            onClick={handleReset}
            icon={<RotateCcw className="w-4 h-4 text-[#5C5270]" />}
          >
            Reset
          </Button>
          <Button 
            variant="primary" 
            size="md" 
            onClick={handleSave}
            icon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Profile & Governance */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-[#1E162B] flex items-center gap-2">
                <User className="w-4 h-4 text-[#5425CB]" />
                <span>Account Profile</span>
              </CardTitle>
              <CardDescription>
                Authenticated identity and system privileges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#F7F5FB] border border-[#E2DBEB]">
                <div className="w-12 h-12 rounded-xl bg-[#5425CB] text-white font-extrabold text-lg flex items-center justify-center shadow-xs shrink-0">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1E162B] truncate">{user?.full_name || 'HR Operations Lead'}</p>
                  <p className="text-xs text-[#5C5270] truncate flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-[#796F8F] shrink-0" />
                    {user?.email || 'hr.ops@auratech.internal'}
                  </p>
                  <div className="mt-2">
                    <Badge variant="brand" size="sm">
                      {user?.role?.role_name || userRole || 'HR Administrator'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs pt-1 border-t border-[#E2DBEB]">
                <div className="flex items-center justify-between py-1 text-[#5C5270]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Session Status:
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active & Authenticated
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 text-[#5C5270]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#5425CB]" />
                    Timezone:
                  </span>
                  <span className="font-semibold text-[#1E162B]">Asia/Kolkata (IST, UTC+5:30)</span>
                </div>
                <div className="flex items-center justify-between py-1 text-[#5C5270]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building className="w-3.5 h-3.5 text-[#5425CB]" />
                    Organization:
                  </span>
                  <span className="font-semibold text-[#1E162B]">AuraTech Solutions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Access Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#1E162B] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#5425CB]" />
                <span>Security & RBAC Enforcement</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[#5C5270] pt-0">
              <p className="leading-relaxed">
                All platform actions are protected by granular Role-Based Access Control (RBAC). Data transfer is encrypted end-to-end and audit trails record critical operations.
              </p>
              <div className="p-3 rounded-lg bg-[#F7F5FB] border border-[#E2DBEB] space-y-1">
                <p className="font-bold text-[#1E162B]">Access Governance</p>
                <p className="text-[11px] text-[#5C5270]">
                  Your credentials grant full authorization to manage lifecycle tasks, assign checklists, trigger follow-ups, and review predictive delay analytics.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Practical Operational Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification & SLA Alert Preferences */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-[#1E162B] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#5425CB]" />
                <span>Operational Alerts & Escalation Cadence</span>
              </CardTitle>
              <CardDescription>
                Configure when and how HR operations should receive automated reminders and escalation alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Setting 1: SLA Reminders */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-[#E2DBEB] bg-white hover:border-[#DCD5E8] transition-colors">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#1E162B]">Task SLA Due-Date Reminders</p>
                    {preferences.slaReminders ? (
                      <Badge variant="success" size="sm">Active</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Paused</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#5C5270] leading-relaxed">
                    Automatically trigger notifications for assigned HR specialists 48 hours and 24 hours prior to impending checklist due dates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('slaReminders')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5425CB]/30 ${
                    preferences.slaReminders ? 'bg-[#5425CB]' : 'bg-[#D4CCE8]'
                  }`}
                  aria-pressed={preferences.slaReminders}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.slaReminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 2: Delay Escalations */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-[#E2DBEB] bg-white hover:border-[#DCD5E8] transition-colors">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#1E162B]">High-Risk Delay Escalations</p>
                    {preferences.delayEscalations ? (
                      <Badge variant="danger" size="sm">Urgent Alerts</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Paused</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#5C5270] leading-relaxed">
                    Instantly flag tasks on the critical path when ML intelligence predicts delay probability exceeding 70% or when deadlines are breached.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('delayEscalations')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5425CB]/30 ${
                    preferences.delayEscalations ? 'bg-[#5425CB]' : 'bg-[#D4CCE8]'
                  }`}
                  aria-pressed={preferences.delayEscalations}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.delayEscalations ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 3: Weekly Summary */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-[#E2DBEB] bg-white hover:border-[#DCD5E8] transition-colors">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#1E162B]">Weekly Operations Summary Digest</p>
                    {preferences.weeklyDigest ? (
                      <Badge variant="info" size="sm">Subscribed</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Off</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#5C5270] leading-relaxed">
                    Receive a consolidated Monday morning briefing covering milestone on-time completion rates, team workload distribution, and top delay factors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('weeklyDigest')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5425CB]/30 ${
                    preferences.weeklyDigest ? 'bg-[#5425CB]' : 'bg-[#D4CCE8]'
                  }`}
                  aria-pressed={preferences.weeklyDigest}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.weeklyDigest ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Operational & Display Preferences */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-[#1E162B] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#5425CB]" />
                <span>Display & Workspace Preferences</span>
              </CardTitle>
              <CardDescription>
                Customize table pagination density, default landing page, and date presentation format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Default Landing Page */}
                <div>
                  <Select
                    label="Default Home View"
                    value={preferences.defaultLandingPage}
                    onChange={(e) => handleSelectChange('defaultLandingPage', e.target.value)}
                    options={[
                      { value: '/dashboard', label: 'HR Dashboard (Recommended)' },
                      { value: '/action-center', label: 'Action Center & Tasks' },
                      { value: '/employees', label: 'Employee Directory' },
                      { value: '/insights', label: 'HR Operations Insights' },
                    ]}
                    helperText="Initial page loaded immediately upon logging in"
                  />
                </div>

                {/* Table Page Size */}
                <div>
                  <Select
                    label="Table Row Density"
                    value={preferences.tablePageSize}
                    onChange={(e) => handleSelectChange('tablePageSize', e.target.value)}
                    options={[
                      { value: '10', label: '10 rows per page (Compact)' },
                      { value: '25', label: '25 rows per page (Standard)' },
                      { value: '50', label: '50 rows per page (Expanded)' },
                    ]}
                    helperText="Default items displayed across all management tables"
                  />
                </div>

                {/* Date Format */}
                <div className="sm:col-span-2">
                  <Select
                    label="Date Presentation Format"
                    value={preferences.dateFormat}
                    onChange={(e) => handleSelectChange('dateFormat', e.target.value)}
                    options={[
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 11/11/2026) — Standard' },
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 11/11/2026) — US Format' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-11-11) — ISO Format' },
                    ]}
                    helperText="Formatting applied to task due dates and milestone trackers"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
