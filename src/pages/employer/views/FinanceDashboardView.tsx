/**
 * FinanceDashboardView — Finance overview: AR/AP, P&L, Cash Flow, Margin Report.
 */
import React, { useState, useMemo } from "react";
import { DataTable, Button } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetFinanceDashboardQuery,
  useGetProfitLossQuery,
  useGetCashFlowQuery,
  useGetMarginReportQuery,
  type FinanceDashboard,
  type CashFlowMonth,
  type MarginReportItem,
} from "../../../api/jobsApi";
import type { ActiveView } from "../employerHelpers";

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

type TabId = "overview" | "pnl" | "cashflow" | "margin";

interface Props {
  navigateTo: (view: ActiveView) => void;
}

function getMarginColor(marginPercent: number) {
  if (marginPercent >= 20) return "#10b981";
  if (marginPercent >= 10) return "#f59e0b";
  return "#ef4444";
}

function renderOverviewContent(
  dashLoading: boolean,
  dashboard: FinanceDashboard | undefined,
) {
  if (dashLoading) return <div>Loading…</div>;
  if (!dashboard) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      <StatCard
        label="Total AR (Receivables)"
        value={fmtCurrency(dashboard.totalAR)}
        color="#3b82f6"
      />
      <StatCard
        label="Total AP (Payables)"
        value={fmtCurrency(dashboard.totalAP)}
        color="#ef4444"
      />
      <StatCard
        label="Net Position"
        value={fmtCurrency(dashboard.netPosition)}
        color={dashboard.netPosition >= 0 ? "#10b981" : "#ef4444"}
      />
      <StatCard
        label="Pending Timesheets"
        value={String(dashboard.pendingTimesheets)}
        color="#f59e0b"
      />
      <StatCard
        label="Overdue Invoices"
        value={String(dashboard.overdueInvoices)}
        color="#ef4444"
      />
      <StatCard
        label="Overdue Bills"
        value={String(dashboard.overdueBills)}
        color="#ef4444"
      />
    </div>
  );
}

const FinanceDashboardView: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const { data: dashboard, isLoading: dashLoading } =
    useGetFinanceDashboardQuery();
  const { data: pnl } = useGetProfitLossQuery(
    {},
    { skip: activeTab !== "pnl" },
  );
  const { data: cashFlowData } = useGetCashFlowQuery(
    { months: 12 },
    { skip: activeTab !== "cashflow" },
  );
  const { data: marginData } = useGetMarginReportQuery(undefined, {
    skip: activeTab !== "margin",
  });

  const cashFlow = cashFlowData?.data ?? [];
  const margins = marginData?.data ?? [];

  const cfColumns: DataTableColumn<CashFlowMonth>[] = useMemo(
    () => [
      { key: "month", header: "Month" },
      {
        key: "inflows",
        header: "Inflows",
        render: (m) => fmtCurrency(m.inflows),
      },
      {
        key: "outflows",
        header: "Outflows",
        render: (m) => fmtCurrency(m.outflows),
      },
      {
        key: "net",
        header: "Net",
        render: (m) => (
          <span
            style={{
              color: m.net >= 0 ? "#10b981" : "#ef4444",
              fontWeight: 600,
            }}
          >
            {fmtCurrency(m.net)}
          </span>
        ),
      },
    ],
    [],
  );

  const marginColumns: DataTableColumn<MarginReportItem>[] = useMemo(
    () => [
      { key: "personName", header: "Worker" },
      {
        key: "totalBilled",
        header: "Billed",
        render: (m) => fmtCurrency(m.totalBilled),
      },
      {
        key: "totalPaid",
        header: "Paid",
        render: (m) => fmtCurrency(m.totalPaid),
      },
      { key: "margin", header: "Margin", render: (m) => fmtCurrency(m.margin) },
      {
        key: "marginPercent",
        header: "Margin %",
        render: (m) => (
          <span
            style={{
              color: getMarginColor(m.marginPercent),
              fontWeight: 600,
            }}
          >
            {(m.marginPercent ?? 0).toFixed(1)}%
          </span>
        ),
      },
    ],
    [],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "pnl", label: "P&L" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "margin", label: "Margins" },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? "primary" : "default"}
            size="sm"
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          <h3 style={{ margin: "0 0 16px" }}>💹 Financial Overview</h3>
          {renderOverviewContent(dashLoading, dashboard)}
        </div>
      )}

      {activeTab === "pnl" && pnl && (
        <div>
          <h3 style={{ margin: "0 0 16px" }}>📈 Profit & Loss</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <StatCard
              label="Revenue"
              value={fmtCurrency(pnl.revenue)}
              color="#10b981"
            />
            <StatCard
              label="Payroll Cost"
              value={fmtCurrency(pnl.payroll)}
              color="#ef4444"
            />
            <StatCard
              label="Other Expenses"
              value={fmtCurrency(pnl.expenses)}
              color="#f59e0b"
            />
            <StatCard
              label="Net Income"
              value={fmtCurrency(pnl.netIncome)}
              color={pnl.netIncome >= 0 ? "#10b981" : "#ef4444"}
            />
          </div>
        </div>
      )}

      {activeTab === "cashflow" && (
        <DataTable<CashFlowMonth>
          columns={cfColumns}
          data={cashFlow}
          keyExtractor={(m) => m.month}
          titleIcon="💸"
          title="Cash Flow (12 months)"
        />
      )}

      {activeTab === "margin" && (
        <DataTable<MarginReportItem>
          columns={marginColumns}
          data={margins}
          keyExtractor={(m) => m.personId}
          titleIcon="📊"
          title="Margin Report"
        />
      )}
    </>
  );
};

function StatCard({
  label,
  value,
  color,
}: Readonly<{
  label: string;
  value: string;
  color: string;
}>) {
  return (
    <div
      style={{
        background: "var(--rm-card-bg, #fff)",
        border: "1px solid var(--rm-border, #e5e7eb)",
        borderRadius: 8,
        padding: 20,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default FinanceDashboardView;
