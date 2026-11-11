import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { EmployeesPage } from '../pages/employees/EmployeesPage';
import { EmployeeProfilePage } from '../pages/employees/EmployeeProfilePage';
import { LifecyclePage } from '../pages/lifecycle/LifecyclePage';
import { ActionCenterPage } from '../pages/action-center/ActionCenterPage';
import { FollowUpsPage } from '../pages/follow-ups/FollowUpsPage';
import { HROperationsInsightsPage } from '../pages/insights/HROperationsInsightsPage';
import { AIIntelligencePage } from '../pages/ai-intelligence/AIIntelligencePage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import { UnauthorizedPage } from '../pages/errors/UnauthorizedPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected Routes inside Main App Shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 1. Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* 2. Employee Management */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <EmployeeProfilePage />
              </ProtectedRoute>
            }
          />

          {/* 3. Employee Lifecycle */}
          <Route path="/lifecycle" element={<Navigate to="/lifecycle/onboarding" replace />} />
          <Route
            path="/lifecycle/:tab"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <LifecyclePage />
              </ProtectedRoute>
            }
          />

          {/* 4. Task Management */}
          <Route
            path="/tasks"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <ActionCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/action-center"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <ActionCenterPage />
              </ProtectedRoute>
            }
          />

          {/* 5. Follow-ups & Escalations */}
          <Route
            path="/follow-ups"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <FollowUpsPage />
              </ProtectedRoute>
            }
          />

          {/* 6. HR Insights & Assistance */}
          {/* Canonical route for consolidated HR Operations Insights */}
          <Route
            path="/insights"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <HROperationsInsightsPage />
              </ProtectedRoute>
            }
          />

          {/* Backward compatibility redirects to canonical /insights */}
          <Route path="/analytics" element={<Navigate to="/insights" replace />} />
          <Route path="/ml-intelligence" element={<Navigate to="/insights" replace />} />
          <Route path="/ai-intelligence/predictions" element={<Navigate to="/insights" replace />} />
          <Route path="/ai-intelligence/actions" element={<Navigate to="/insights" replace />} />

          {/* HR Operations Copilot */}
          <Route
            path="/ai-intelligence/copilot"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <AIIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-intelligence"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <AIIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-intelligence/:tab"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <AIIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route path="/copilot" element={<Navigate to="/ai-intelligence/copilot" replace />} />

          {/* 7. Settings */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
