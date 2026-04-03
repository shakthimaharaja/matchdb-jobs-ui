/**
 * RoleAssignmentDropdown.tsx
 *
 * A styled select dropdown for assigning/changing user roles.
 * Uses the component library's Select for consistent Win97 theming.
 */
import React from "react";
import { Select } from "matchdb-component-library";
import type { UserRole, MarketerDepartment } from "../api/jobsApi";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "vendor", label: "Vendor (Job Postings)" },
  { value: "marketer", label: "Marketer (Staffing)" },
];

const DEPARTMENT_OPTIONS: { value: MarketerDepartment; label: string }[] = [
  { value: "accounts", label: "Accounts" },
  { value: "immigration", label: "Immigration" },
  { value: "placement", label: "Placement" },
];

interface RoleAssignmentDropdownProps {
  id?: string;
  value: UserRole;
  department?: MarketerDepartment | null;
  onChange: (role: UserRole, department?: MarketerDepartment | null) => void;
  disabled?: boolean;
  excludeAdmin?: boolean;
  size?: "sm" | "md";
}

export function RoleAssignmentDropdown({
  id,
  value,
  department,
  onChange,
  disabled,
  excludeAdmin,
  size = "sm",
}: Readonly<RoleAssignmentDropdownProps>) {
  const options = excludeAdmin
    ? ROLE_OPTIONS.filter((o) => o.value !== "admin")
    : ROLE_OPTIONS;

  const fontSize = size === "sm" ? 11 : 13;

  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <Select
        id={id}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(
            e.target.value as UserRole,
            value === "marketer" ? department : null,
          )
        }
        disabled={disabled}
        style={{ fontSize, minWidth: 120 }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      {value === "marketer" && (
        <Select
          id={id ? `${id}-department` : undefined}
          value={department || "accounts"}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange(value, e.target.value as MarketerDepartment)
          }
          disabled={disabled}
          style={{ fontSize, minWidth: 100 }}
        >
          {DEPARTMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}
    </span>
  );
}

export default RoleAssignmentDropdown;
