import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, Search, Mail } from 'lucide-react';
import { userApi, UserItem } from '../../api/userApi';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await userApi.listUsers({
        page,
        size,
        search: debouncedSearch.trim() || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, size, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const getRoleBadgeVariant = (roleCode: string) => {
    switch (roleCode) {
      case 'ADMIN':
        return 'danger';
      case 'HR_MANAGER':
        return 'brand';
      case 'HR_EXECUTIVE':
        return 'info';
      case 'REPORTING_MANAGER':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDE7F7] text-[#5425CB] border border-[#DCD5E8] flex items-center justify-center font-bold shadow-2xs">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#292238] tracking-tight">
                User & Role Management
              </h1>
              <p className="text-[13px] text-[#625A70] mt-0.5">
                System administration console for managing platform user accounts, authentication credentials, and RBAC assignments.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#777387]" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-[#777387] self-end sm:self-center">
              Total platform accounts: <span className="font-semibold text-[#24212E]">{total}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-[#24212E] flex items-center justify-between">
            <span>Platform User Directory</span>
            {isLoading && <span className="text-xs text-[#777387] font-normal">Loading accounts...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-center text-xs text-status-danger bg-red-50/50">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-[#777387]">
                        No user accounts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-[#F5F1FF]/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#EDE7FF] text-[#6938EF] font-bold text-xs flex items-center justify-center shrink-0">
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-xs text-[#24212E]">{u.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-[#777387]">
                            <Mail className="w-3.5 h-3.5 text-[#A09BAE]" />
                            <span>{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(u.role.role_code)} size="sm">
                            {u.role.role_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <Badge variant="success" size="sm" dot>
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-[#777387]">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-xs text-[#777387]">
                          {new Date(u.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-[#E7E3EF] flex justify-end">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
