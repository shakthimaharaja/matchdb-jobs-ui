/**
 * VendorsManagementView — Enhanced vendor company management.
 */
import React, { useState, useMemo, useCallback } from "react";
import { DataTable, Button, Input, Select } from "matchdb-component-library";
import type { DataTableColumn } from "matchdb-component-library";
import {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  type VendorCompanyEnhanced,
} from "../../../api/jobsApi";
import { getApiErrorMessage } from "../../../utils";
import { PAGE_SIZE } from "../../../constants";
import type { ActiveView } from "../employerHelpers";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "STAFFING", label: "Staffing" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "CONSULTING", label: "Consulting" },
  { value: "OTHER", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  INACTIVE: "#6b7280",
  SUSPENDED: "#ef4444",
};

interface Props {
  navigateTo: (view: ActiveView) => void;
}

const VendorsManagementView: React.FC<Props> = ({ navigateTo }) => {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorCompanyEnhanced | null>(null);

  const { data: vendorsData, isLoading } = useGetVendorsQuery({
    status: statusFilter || undefined,
    search: search || undefined,
  });
  const vendors = vendorsData?.data ?? [];

  const [createVendor, { isLoading: creating }] = useCreateVendorMutation();
  const [updateVendor] = useUpdateVendorMutation();

  const [formData, setFormData] = useState<Partial<VendorCompanyEnhanced>>({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    paymentTerms: 30,
    category: "STAFFING",
    status: "ACTIVE",
  });

  const handleSave = useCallback(async () => {
    try {
      if (editingVendor) {
        await updateVendor({ id: editingVendor._id, ...formData }).unwrap();
      } else {
        await createVendor(formData).unwrap();
      }
      setShowForm(false);
      setEditingVendor(null);
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to save vendor"));
    }
  }, [createVendor, updateVendor, formData, editingVendor]);

  const columns: DataTableColumn<VendorCompanyEnhanced>[] = useMemo(() => [
    { key: "name", header: "Company Name" },
    { key: "contactName", header: "Contact", render: (v) => v.contactName || "—" },
    { key: "email", header: "Email", render: (v) => v.email || "—" },
    { key: "phone", header: "Phone", render: (v) => v.phone || "—" },
    { key: "category", header: "Category" },
    { key: "paymentTerms", header: "Terms", render: (v) => `Net ${v.paymentTerms}` },
    {
      key: "status", header: "Status",
      render: (v) => <span style={{ color: STATUS_COLORS[v.status], fontWeight: 600 }}>{v.status}</span>,
    },
    {
      key: "actions", header: "Actions",
      render: (v) => (
        <Button size="sm" variant="default" onClick={() => { setEditingVendor(v); setFormData(v); setShowForm(true); }}>
          Edit
        </Button>
      ),
    },
  ], []);

  return (
    <>
      <DataTable<VendorCompanyEnhanced>
        columns={columns}
        data={vendors}
        keyExtractor={(v) => v._id}
        loading={isLoading}
        paginated
        pageSize={PAGE_SIZE}
        titleIcon="🤝"
        title="Vendor Companies"
        titleExtra={
          <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Button onClick={() => { setEditingVendor(null); setFormData({ name: "", contactName: "", email: "", phone: "", paymentTerms: 30, category: "STAFFING", status: "ACTIVE" }); setShowForm(true); }}>
              + New Vendor
            </Button>
          </div>
        }
      />

      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { setShowForm(false); setEditingVendor(null); }}
        >
          <div
            style={{ background: "var(--rm-card-bg, #fff)", borderRadius: 8, padding: 24, minWidth: 500, maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{editingVendor ? "Edit Vendor" : "New Vendor"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Input placeholder="Company Name *" value={formData.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Contact Name" value={formData.contactName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, contactName: e.target.value }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input placeholder="Email" value={formData.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, email: e.target.value }))} />
                <Input placeholder="Phone" value={formData.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <Input placeholder="Address" value={formData.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, address: e.target.value }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Input placeholder="City" value={formData.city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, city: e.target.value }))} />
                <Input placeholder="State" value={formData.state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, state: e.target.value }))} />
                <Input placeholder="ZIP" value={formData.zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, zip: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label>
                  Category
                  <select value={formData.category} onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as "STAFFING" }))} style={{ display: "block", width: "100%" }}>
                    {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <Input type="number" placeholder="Payment Terms" value={formData.paymentTerms} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, paymentTerms: +e.target.value }))} />
              </div>
              <Input placeholder="Tax ID" value={formData.taxId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p) => ({ ...p, taxId: e.target.value }))} />
              <textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={2} style={{ width: "100%" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="default" onClick={() => { setShowForm(false); setEditingVendor(null); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={creating || !formData.name}>{creating ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VendorsManagementView;
