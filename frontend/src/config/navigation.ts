import {
  LayoutDashboard,
  Users,
  GitBranch,
  UserPlus,
  Clock,
  CheckCircle2,
  FileText,
  Award,
  LogOut,
  CheckSquare,
  BellRing,
  BrainCircuit,
  ChartNoAxesCombined,
  MessageCircle,
  Settings,
  UserCog,
  LucideIcon,
} from 'lucide-react';
import { RoleCode } from '../types/auth';

export interface NavChildItem {
  name: string;
  path: string;
  icon?: LucideIcon;
  allowedRoles: RoleCode[];
  description?: string;
  badge?: string;
}

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  allowedRoles: RoleCode[];
  description: string;
  children?: NavChildItem[];
  badge?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      {
        name: 'HR Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Operational overview & quick metrics',
      },
      {
        name: 'Employee Management',
        path: '/employees',
        icon: Users,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Workforce directory & employee profiles',
      },
    ],
  },
  {
    id: 'lifecycle-tasks',
    title: 'Lifecycle & Operations',
    items: [
      {
        name: 'Employee Lifecycle',
        path: '/lifecycle',
        icon: GitBranch,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: '6 core lifecycle stages & transitions',
        children: [
          {
            name: 'Onboarding',
            path: '/lifecycle/onboarding',
            icon: UserPlus,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'New hire checklists and welcome kit distribution',
          },
          {
            name: 'Documentation',
            path: '/lifecycle/documentation',
            icon: FileText,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Statutory compliance and KYC credential verification',
          },
          {
            name: 'Probation',
            path: '/lifecycle/probation',
            icon: Clock,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Mid-term and end-of-probation progress reviews',
          },
          {
            name: 'Confirmation',
            path: '/lifecycle/confirmation',
            icon: CheckCircle2,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Employment confirmation appraisals and formal letters',
          },
          {
            name: 'Performance Reviews',
            path: '/lifecycle/performance-reviews',
            icon: Award,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Annual appraisals and manager evaluation feedback',
          },
          {
            name: 'Offboarding',
            path: '/lifecycle/offboarding',
            icon: LogOut,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Exit interviews, asset clearance and full-and-final settlement',
          },
        ],
      },
      {
        name: 'Task Management',
        path: '/action-center',
        icon: CheckSquare,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Operational tasks, dependencies & checklists',
      },
      {
        name: 'Follow-ups & Escalations',
        path: '/follow-ups',
        icon: BellRing,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Follow-up tracking & operational escalations',
      },
    ],
  },
  {
    id: 'insights',
    title: 'HR Insights & Assistance',
    items: [
      {
        name: 'HR Insights & Assistance',
        path: '/insights',
        icon: BrainCircuit,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Consolidated operational performance & decision assistance',
        children: [
          {
            name: 'HR Operations Insights',
            path: '/insights',
            icon: ChartNoAxesCombined,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Consolidated analytics and task delay risk prediction',
          },
          {
            name: 'HR Operations Copilot',
            path: '/ai-intelligence/copilot',
            icon: MessageCircle,
            allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
            description: 'Conversational assistant and grounded operational guidance',
          },
        ],
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    items: [
      {
        name: 'User Administration',
        path: '/admin/users',
        icon: UserCog,
        allowedRoles: ['ADMIN'],
        description: 'Platform user accounts, security roles & access permissions',
      },
    ],
  },
  {
    id: 'settings-group',
    title: 'Preferences',
    items: [
      {
        name: 'Settings',
        path: '/settings',
        icon: Settings,
        allowedRoles: ['ADMIN', 'HR_MANAGER', 'HR_EXECUTIVE', 'REPORTING_MANAGER'],
        description: 'Profile, preferences & notification thresholds',
      },
    ],
  },
];

/**
 * Filter navigation groups and items based on active role code.
 */
export const getAccessibleNavGroups = (roleCode?: RoleCode): NavGroup[] => {
  if (!roleCode) return [];

  return NAVIGATION_GROUPS.map((group) => {
    const accessibleItems = group.items
      .filter((item) => item.allowedRoles.includes(roleCode))
      .map((item) => {
        if (!item.children) return item;
        const accessibleChildren = item.children.filter((child) =>
          child.allowedRoles.includes(roleCode)
        );
        return {
          ...item,
          children: accessibleChildren,
        };
      });

    return {
      ...group,
      items: accessibleItems,
    };
  }).filter((group) => group.items.length > 0);
};

/**
 * Check if a route path is currently active.
 */
export const isRouteActive = (currentPath: string, targetPath: string): boolean => {
  if (currentPath === targetPath) return true;
  // Handle canonical insights paths
  if (targetPath === '/insights' && (currentPath === '/analytics' || currentPath === '/ml-intelligence' || currentPath.startsWith('/ai-intelligence/predictions'))) {
    return true;
  }
  // Handle copilot paths
  if (targetPath === '/ai-intelligence/copilot' && (currentPath === '/copilot' || currentPath === '/ai-intelligence' || currentPath === '/ai-intelligence/copilot')) {
    return true;
  }
  if (targetPath !== '/' && currentPath.startsWith(targetPath + '/')) return true;
  return false;
};

/**
 * Breadcrumb metadata item.
 */
export interface BreadcrumbItem {
  label: string;
  path?: string;
}

/**
 * Generate dynamic breadcrumb hierarchy from current pathname.
 */
export const getBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const cleanPath = pathname.replace(/\/$/, '');

  // Exact matching across navigation structure
  for (const group of NAVIGATION_GROUPS) {
    for (const item of group.items) {
      if (item.path === cleanPath) {
        return [
          { label: group.title },
          { label: item.name, path: item.path },
        ];
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.path === cleanPath) {
            return [
              { label: group.title },
              { label: item.name, path: item.path },
              { label: child.name, path: child.path },
            ];
          }
        }
      }
    }
  }

  // Handle canonical insights routes
  if (cleanPath === '/insights' || cleanPath === '/analytics' || cleanPath === '/ml-intelligence') {
    return [
      { label: 'HR Insights & Assistance' },
      { label: 'HR Operations Insights', path: '/insights' },
    ];
  }

  if (cleanPath === '/copilot' || cleanPath === '/ai-intelligence/copilot') {
    return [
      { label: 'HR Insights & Assistance' },
      { label: 'HR Operations Copilot', path: '/ai-intelligence/copilot' },
    ];
  }

  // Handle special dynamic routes
  if (cleanPath.startsWith('/employees/')) {
    return [
      { label: 'Workspace' },
      { label: 'Employee Management', path: '/employees' },
      { label: 'Employee Profile' },
    ];
  }

  if (cleanPath === '/lifecycle') {
    return [
      { label: 'Employee Lifecycle' },
      { label: 'Overview', path: '/lifecycle' },
    ];
  }

  if (cleanPath === '/admin/users') {
    return [
      { label: 'Administration' },
      { label: 'User Administration', path: '/admin/users' },
    ];
  }

  return [
    { label: 'HR Flow AI' },
    { label: cleanPath.replace(/^\//, '').replace(/-/g, ' ').toUpperCase() },
  ];
};

/**
 * Page meta description generator.
 */
export const getPageMeta = (pathname: string): { title: string; subtitle: string } => {
  const cleanPath = pathname.replace(/\/$/, '');

  if (cleanPath === '/insights' || cleanPath === '/analytics' || cleanPath === '/ml-intelligence') {
    return {
      title: 'HR Operations Insights',
      subtitle: 'Understand HR operational performance, identify emerging delays and prioritise actions.',
    };
  }

  if (cleanPath === '/copilot' || cleanPath === '/ai-intelligence/copilot') {
    return {
      title: 'HR Operations Copilot',
      subtitle: 'Grounded operational guidance & decision support',
    };
  }

  // Check children first
  for (const group of NAVIGATION_GROUPS) {
    for (const item of group.items) {
      if (item.children) {
        for (const child of item.children) {
          if (child.path === cleanPath) {
            return {
              title: child.name,
              subtitle: child.description || item.description,
            };
          }
        }
      }
      if (item.path === cleanPath) {
        return {
          title: item.name,
          subtitle: item.description,
        };
      }
    }
  }

  if (cleanPath.startsWith('/employees/')) {
    return {
      title: 'Employee Profile',
      subtitle: 'Comprehensive employee lifecycle records, reporting lines and actions',
    };
  }

  if (cleanPath === '/lifecycle') {
    return {
      title: 'Employee Lifecycle Overview',
      subtitle: 'Complete lifecycle status distribution across all 6 operational stages',
    };
  }

  if (cleanPath === '/settings') {
    return {
      title: 'Settings',
      subtitle: 'System preferences, notification thresholds and display options',
    };
  }

  if (cleanPath === '/admin/users') {
    return {
      title: 'User Administration',
      subtitle: 'Manage platform user accounts, security credentials and access permissions',
    };
  }

  return {
    title: 'HR Operations',
    subtitle: 'AuraTech Solutions — Enterprise HR Operations & Action Tracker',
  };
};
