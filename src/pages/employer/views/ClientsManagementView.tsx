/**
 * ClientsManagementView — Enhanced client company management with rate cards.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Input, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useGetClientRateCardsQuery,
  useCreateRateCardMutation,
  type ClientCompanyEnhanced,
  type ClientRateCard,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "PROSPECT", label: "Prospect" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  INACTIVE: "#6b7280",
  SUSPENDED: "#ef4444",
  PROSPECT: "#3b82f6",
};

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const ClientsManagementView: React.FC<Props> = ({ navigateTo }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompanyEnhanced | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showRateCardForm, setShowRateCardForm] = useState(false);

  const { data: clientsData, isLoading } = useGetClientsQuery({
    status: statusFilter || undefined,
    search: search || undefined,
  });
  const clients = clientsData?.data ?? [];

  const { data: rateCardsData } = useGetClientRateCardsQuery(
    selectedClientId!,
    { skip: !selectedClientId },
  );
  const rateCards = rateCardsData?.data ?? [];

  const [createClient, { isLoading: creating }] = useCreateClientMutation();
  const [updateClient] = useUpdateClientMutation();
  const [createRateCard, { isLoading: creatingRC }] = useCreateRateCardMutation();

  const [formData, setFormData] = useState<Partial<ClientCompanyEnhanced>>({
    name: "",
    legalName: "",
    billingEmail: "",
    phone: "",
    paymentTerms: 30,
    status: "PROSPECT",
  });

  const [rcForm, setRcForm] = useState({
    personId: "",
    personName: "",
    jobTitle: "",
    billRate: 0,
    payRate: 0,
    overtimeBillRate: 0,
    overtimePayRate: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  const handleSave = useCallback(async () => {
    try {
      if (editingClient) {
        await updateClient({ id: editingClient._id, ...formData }).unwrap();
      } else {
        await createClient(formData).unwrap();
      }
      setShowCreate(false);
      setEditingClient(null);
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to save client"));
    }
  }, [createClient, updateClient, formData, editingClient]);

  const handleCreateRateCard = useCallback(async () => {
    if (!selectedClientId) return;
    try {
      await createRateCard({ clientId: selectedClientId, ...rcForm } as Parameters<typeof createRateCard>[0]).unwrap();
      setShowRateCardForm(false);
      setRcForm({ personId: "", personName: "", jobTitle: "", billRate: 0, payRate: 0, overtimeBillRate: 0, overtimePayRate: 0, effectiveDate: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to create rate card"));
    }
  }, [createRateCard, selectedClientId, rcForm]);

  const columns: DataTableColumn<ClientCompanyEnhanced>[] = useMemo(
    () => [
      { key: "name", header: "Company Name" },
      { key: "legalName", header: "Legal Name", render: (c) => c.legalName || "—" },
      { key: "billingEmail", header: "Billing Email", render: (c) => c.billingEmail || "—" },
      { key: "phone", header: "Phone", render: (c) => c.phone || "—" },
      {
        key: "paymentTerms",
        header: "Terms",
        render: (c) => `Net ${c.paymentTerms}`,
      },
      {
        key: "creditLimit",
        header: "Credit Limit",
        render: (c) => fmtCurrency(c.creditLimit),
      },
      {
        key: "status",
        header: "Status",
        render: (c) => (
          <span style={{ color: STATUS_COLORS[c.status], fontWeight: 600 }}>
            {c.status}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        render: (c) => (
          <div style={{ display: "flex", gap: 4 }}>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setEditingClient(c);
                setFormData(c);
                setShowCreate(true);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              onClick={() => setSelectedClientId(c._id)}
            >
              Rate Cards
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const rcColumns: DataTableColumn<ClientRateCard>[] = useMemo(
    () => [
      { key: "personName", header: "Worker", render: (r) => r.personName || r.personId },
      { key: "jobTitle", header: "Job Title", render: (r) => r.jobTitle || "—" },
      { key: "billRate", header: "Bill Rate", render: (r) => fmtCurrency(r.billRate) },
      { key: "payRate", header: "Pay Rate", render: (r) => fmtCurrency(r.payRate) },
      { key: "margin", header: "Margin", render: (r) => fmtCurrency(r.margin) },
      {
        key: "marginPercent",
        header: "Margin %",
        render: (r) => `${(r.marginPercent ?? 0).toFixed(1)}%`,
      },
      {
        key: "effectiveDate",
        header: "Effective",
        render: (r) =>
          new Date(r.effectiveDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
      },
      {
        key: "isActive",
        header: "Active",
        render: (r) => (r.isActive ? "✅" : "❌"),
      },
    ],
    [],
  );

  // Rate Cards detail panel
  if (selectedClientId) {
    const client = clients.find((c) => c._id === selectedClientId);
    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <Button variant="default" onClick={() => setSelectedClientId(null)}>
            ← Back to Clients
          </Button>
        </div>
        <DataTable<ClientRateCard>
          columns={rcColumns}
          data={rateCards}
          keyExtractor={(r) => r._id}
          titleIcon="💹"
          title={`Rate Cards — ${client?.name ?? "Client"}`}
          titleExtra={
            <Button onClick={() => setShowRateCardForm(true)} style={{ marginLeft: 12 }}>
              + New Rate Card
            </Button>
          }
        />
        {showRateCardForm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowRateCardForm(false)}
          >
            <div
              style={{
                background: "var(--rm-card-bg, #fff)",
                borderRadius: 8,
                padding: 24,
                minWidth: 400,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0 }}>New Rate Card</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Input
                  placeholder="Worker ID"
                  value={rcForm.personId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, personId: e.target.value }))}
                />
                <Input
                  placeholder="Worker Name"
                  value={rcForm.personName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, personName: e.target.value }))}
                />
                <Input
                  placeholder="Job Title"
                  value={rcForm.jobTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, jobTitle: e.target.value }))}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Input
                    type="number"
                    placeholder="Bill Rate"
                    value={rcForm.billRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, billRate: +e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Pay Rate"
                    value={rcForm.payRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, payRate: +e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="OT Bill Rate"
                    value={rcForm.overtimeBillRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, overtimeBillRate: +e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="OT Pay Rate"
                    value={rcForm.overtimePayRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRcForm((p) => ({ ...p, overtimePayRate: +e.target.value }))}
                  />
                </div>
                <input
                  type="date"
                  value={rcForm.effectiveDate}
                  onChange={(e) => setRcForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="default" onClick={() => setShowRateCardForm(false)}>Cancel</Button>
                  <Button onClick={handleCreateRateCard} disabled={creatingRC || !rcForm.personId}>
                    {creatingRC ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <DataTable<ClientCompanyEnhanced>
        columns={columns}
        data={clients}
        keyExtractor={(c) => c._id}
        loading={isLoading}
        paginated
        pageSize={PAGE_SIZE}
        titleIcon="🏢"
        title="Client Companies"
        titleExtra={
          <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            <Input
              placeholder="Search clients…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 140 }}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Button
              onClick={() => {
                setEditingClient(null);
                setFormData({
                  name: "",
                  legalName: "",
                  billingEmail: "",
                  phone: "",
                  paymentTerms: 30,
                  status: "PROSPECT",
                });
                setShowCreate(true);
              }}
            >
              + New Client
            </Button>
          </div>
        }
      />

      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{
              background: "var(--rm-card-bg, #fff)",
              borderRadius: 8,
              padding: 24,
              minWidth: 500,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              {editingClient ? "Edit Client" : "New Client"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Input
                placeholder="Company Name *"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                placeholder="Legal Name"
                value={formData.legalName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, legalName: e.target.value }))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input
                  placeholder="Billing Email"
                  value={formData.billingEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, billingEmail: e.target.value }))}
                />
                <Input
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Address"
                value={formData.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, address: e.target.value }))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, city: e.target.value }))}
                />
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, state: e.target.value }))}
                />
                <Input
                  placeholder="ZIP"
                  value={formData.zip}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, zip: e.target.value }))}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input
                  type="number"
                  placeholder="Payment Terms (days)"
                  value={formData.paymentTerms}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, paymentTerms: +e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Credit Limit"
                  value={formData.creditLimit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, creditLimit: +e.target.value }))}
                />
              </div>
              <Input
                placeholder="Tax ID"
                value={formData.taxId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, taxId: e.target.value }))}
              />
              <textarea
                placeholder="Notes"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingClient(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={creating || !formData.name}
                >
                  {creating ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientsManagementView;
