/**
 * LeaveManagementView — Leave balances, leave requests, leave calendar.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetLeaveCalendarQuery,
  useSetLeaveBalanceMutation,
  type LeaveBalance,
  type LeaveType,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const LEAVE_COLORS: Record<LeaveType, string> = {
  PTO: "#3b82f6",
  SICK: "#ef4444",
  VACATION: "#10b981",
  PERSONAL: "#f59e0b",
  UNPAID: "#6b7280",
};

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const LeaveManagementView: React.FC<Props> = ({ navigateTo }) => {
  const [showSetBalance, setShowSetBalance] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    personId: "",
    leaveType: "PTO" as LeaveType,
    year: new Date().getFullYear(),
    totalAllotted: 0,
  });

  const { data: calendarData, isLoading } = useGetLeaveCalendarQuery({
    year: new Date().getFullYear(),
  });
  const balances = calendarData?.data ?? [];

  const [setLeaveBalance, { isLoading: saving }] = useSetLeaveBalanceMutation();

  const handleSetBalance = useCallback(async () => {
    try {
      await setLeaveBalance(balanceForm).unwrap();
      setShowSetBalance(false);
      setBalanceForm({ personId: "", leaveType: "PTO", year: new Date().getFullYear(), totalAllotted: 0 });
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to set leave balance"));
    }
  }, [setLeaveBalance, balanceForm]);

  const columns: DataTableColumn<LeaveBalance>[] = useMemo(() => [
    { key: "personName", header: "Worker", render: (lb) => lb.personName || lb.personId },
    {
      key: "leaveType",
      header: "Type",
      render: (lb) => (
        <span style={{ color: LEAVE_COLORS[lb.leaveType], fontWeight: 600 }}>
          {lb.leaveType}
        </span>
      ),
    },
    { key: "year", header: "Year" },
    { key: "totalAllotted", header: "Allotted", render: (lb) => `${lb.totalAllotted}h` },
    { key: "used", header: "Used", render: (lb) => `${lb.used}h` },
    {
      key: "remaining",
      header: "Remaining",
      render: (lb) => (
        <span style={{ color: lb.remaining <= 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
          {lb.remaining}h
        </span>
      ),
    },
  ], []);

  return (
    <>
      <DataTable<LeaveBalance>
        columns={columns}
        data={balances}
        keyExtractor={(lb) => lb._id}
        loading={isLoading}
        paginated
        pageSize={PAGE_SIZE}
        titleIcon="🏖️"
        title="Leave Balances"
        titleExtra={
          <Button onClick={() => setShowSetBalance(true)} style={{ marginLeft: 12 }}>+ Set Balance</Button>
        }
      />

      {showSetBalance && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowSetBalance(false)}
        >
          <div
            style={{ background: "var(--rm-card-bg, #fff)", borderRadius: 8, padding: 24, minWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Set Leave Balance</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder="Worker ID"
                value={balanceForm.personId}
                onChange={(e) => setBalanceForm((p) => ({ ...p, personId: e.target.value }))}
                style={{ width: "100%" }}
              />
              <select
                value={balanceForm.leaveType}
                onChange={(e) => setBalanceForm((p) => ({ ...p, leaveType: e.target.value as LeaveType }))}
                style={{ width: "100%" }}
              >
                <option value="PTO">PTO</option>
                <option value="SICK">Sick</option>
                <option value="VACATION">Vacation</option>
                <option value="PERSONAL">Personal</option>
                <option value="UNPAID">Unpaid</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="number"
                  placeholder="Year"
                  value={balanceForm.year}
                  onChange={(e) => setBalanceForm((p) => ({ ...p, year: +e.target.value }))}
                  style={{ width: "100%" }}
                />
                <input
                  type="number"
                  placeholder="Total Hours"
                  value={balanceForm.totalAllotted || ""}
                  onChange={(e) => setBalanceForm((p) => ({ ...p, totalAllotted: +e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="default" onClick={() => setShowSetBalance(false)}>Cancel</Button>
                <Button onClick={handleSetBalance} disabled={saving || !balanceForm.personId || !balanceForm.totalAllotted}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeaveManagementView;
