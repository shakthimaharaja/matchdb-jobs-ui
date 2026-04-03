/**
 * CompanyContext — provides RBAC context (role, department, permissions)
 * for employer users. Fetches from GET /admin/me on mount.
 */
import React, { createContext, useContext, useMemo } from "react";
import {
  useGetCompanyContextQuery,
  type UserRole,
  type MarketerDepartment,
} from "../api/jobsApi";

interface CompanyContextValue {
  /** True while the initial /admin/me call is loading */
  isLoading: boolean;
  /** True if the user has no company context (not set up yet) */
  isUnsetup: boolean;
  companyId: string;
  companyName: string;
  role: UserRole | null;
  department: MarketerDepartment | null;
  permissions: string[];
  /** Check if the user has a specific permission (admin always true) */
  hasPermission: (perm: string) => boolean;
  /** Check if the user has one of the given roles */
  hasRole: (...roles: UserRole[]) => boolean;
}

interface CompanyContextProviderProps {
  readonly children: React.ReactNode;
}

const Ctx = createContext<CompanyContextValue>({
  isLoading: true,
  isUnsetup: true,
  companyId: "",
  companyName: "",
  role: null,
  department: null,
  permissions: [],
  hasPermission: () => false,
  hasRole: () => false,
});

export function CompanyContextProvider({
  children,
}: CompanyContextProviderProps) {
  const { data, isLoading, isError } = useGetCompanyContextQuery();

  const value = useMemo<CompanyContextValue>(() => {
    if (isLoading) {
      return {
        isLoading: true,
        isUnsetup: false,
        companyId: "",
        companyName: "",
        role: null,
        department: null,
        permissions: [],
        hasPermission: () => false,
        hasRole: () => false,
      };
    }

    if (isError || !data) {
      return {
        isLoading: false,
        isUnsetup: true,
        companyId: "",
        companyName: "",
        role: null,
        department: null,
        permissions: [],
        hasPermission: () => false,
        hasRole: () => false,
      };
    }

    const perms = new Set(data.permissions);
    const role = data.role;

    return {
      isLoading: false,
      isUnsetup: false,
      companyId: data.companyId,
      companyName: data.companyName,
      role,
      department: data.department,
      permissions: data.permissions,
      hasPermission: (perm: string) => role === "admin" || perms.has(perm),
      hasRole: (...roles: UserRole[]) => role !== null && roles.includes(role),
    };
  }, [data, isLoading, isError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Use the company RBAC context — must be inside <CompanyContextProvider> */
export function useCompanyContext(): CompanyContextValue {
  return useContext(Ctx);
}

/** Shorthand: check if current user has a specific permission */
export function useHasPermission(perm: string): boolean {
  const { hasPermission } = useCompanyContext();
  return hasPermission(perm);
}

/** Shorthand: check if current user has one of the given roles */
export function useHasRole(...roles: UserRole[]): boolean {
  const { hasRole } = useCompanyContext();
  return hasRole(...roles);
}
