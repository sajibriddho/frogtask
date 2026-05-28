"use client";

/**
 * Roles --- Access Control.
 * Define job roles for staff. List, search, add, edit, delete.
 * API: GET/POST /api/roles, PUT/DELETE /api/roles/:id
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash2, Shield } from "lucide-react";
import type { Role, RoleStatus } from "@/types/role";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";
import { MasterTableHeader } from "@/components/master/MasterTableHeader";
import { MasterTableEmpty } from "@/components/master/MasterTableEmpty";
import { MasterPagination } from "@/components/master/MasterPagination";
import { AlertDialog } from "@/components/ui/alert-dialog";

// --------------
// Schema & types
// --------------

/** Zod schema for the add / edit role form. */
const roleSchema = z.object({
  role_name: z
    .string()
    .min(1, "Role name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less"),
  status: z.enum(["Active", "Inactive"]),
});

type RoleFormValues = z.infer<typeof roleSchema>;

/** Initial form values for add / edit modal. */
const EMPTY_FORM: RoleFormValues = {
  role_name: "",
  description: "",
  status: "Active",
};

// --------------
// Component
// --------------

export default function RolesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { has } = usePermissions();
  const canCreate = has("roles.create");
  const canUpdate = has("roles.update") || has("roles.assign");
  const canDelete = has("roles.delete");

  // ----- State -----
  const [list, setList] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // ----- Form -----
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: EMPTY_FORM,
  });

  const statusValue = watch("status");

  // ----- Data fetching -----
  React.useEffect(() => {
    fetchRoles();
  }, []);

  /** Fetches all roles and normalises _id ? id. */
  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles");
      const data = await parseJsonSafe<{
        success: boolean;
        data: Role[];
        error?: string;
      }>(res);
      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalised = (data.data as any[]).map((d) => ({
          ...d,
          id: d._id ?? d.id,
        }));
        setList(normalised);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setLoading(false);
    }
  };

  // ----- Derived: filtered list + pagination -----
  const filtered = React.useMemo(() => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (r) =>
        r.role_name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [list, searchTerm]);

  type RoleSortKey = "role_name" | "description" | "status";
  const { sorted, sortKey, direction, requestSort } = useSort<Role, RoleSortKey>(
    filtered,
    "role_name",
  );

  const {
    pageData,
    start,
    end,
    totalPages,
    currentPage,
    setCurrentPage,
    goPrev,
    goNext,
  } = usePagination({ items: sorted });

  // ----- CRUD handlers -----
  /** Creates or updates a role. */
  const onSubmit = async (values: RoleFormValues) => {
    const SYSTEM_USER = {
      id: session?.user?.id ?? "system",
      name: session?.user?.name ?? "System",
    };
    const base = { ...values, updated_by: SYSTEM_USER };
    const payload = editingId ? base : { ...base, created_by: SYSTEM_USER };

    try {
      const url = editingId ? `/api/roles/${editingId}` : "/api/roles";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success(
          editingId ? "Role updated successfully" : "Role added successfully",
        );
        fetchRoles();
        closeModal();
      } else {
        toast.error(data.error || "Operation failed");
      }
    } catch (error) {
      console.error("Error saving role:", error);
      toast.error("Error saving role");
    }
  };

  /** Opens the centered delete confirmation dialog. */
  const handleDelete = (id: string) => setDeleteId(id);

  /** Executes the delete after user confirms in the AlertDialog. */
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${deleteId}`, { method: "DELETE" });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success("Role deleted successfully");
        fetchRoles();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      toast.error("Error deleting role");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // ----- Modal handlers -----
  const openAdd = () => {
    router.push("/roles/new");
  };

  const openEdit = (item: Role) => {
    router.push(`/roles/${item.id}`);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    reset(EMPTY_FORM);
  };

  // ----- Render -----
  return (
    <div className="space-y-4">
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        <MasterTableHeader
          icon={Shield}
          title="Role Management"
          description="Define job roles for staff. Staff link to a role."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onAddClick={canCreate ? openAdd : undefined}
        />
        <div className="overflow-x-auto bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="table-header-cell w-12">SL</TableHead>
                  <SortableTableHead
                    sortKey="role_name"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Role name
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="description"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Description
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="status"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Status
                  </SortableTableHead>
                  <TableHead className="py-3.5 px-4 font-medium text-muted-foreground text-sm text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.length === 0 ? (
                  <MasterTableEmpty
                    colSpan={5}
                    hasSearch={!!searchTerm.trim()}
                    messageEmpty="Add your first role"
                  />
                ) : (
                  pageData.map((r, index) => (
                    <TableRow
                      key={r.id}
                      className="group transition-colors hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <TableCell className="py-4 px-4 text-sm text-muted-foreground w-12">
                        {start + index + 1}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <span className="font-medium text-sm text-foreground">
                          {r.role_name}
                        </span>
                      </TableCell>
                      <TableCell className="table-data-cell max-w-xs truncate">
                        {r.description || "---"}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <Badge
                          variant={
                            r.status === "Active" ? "default" : "secondary"
                          }
                          className={cn(
                            r.status === "Inactive" &&
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {canUpdate && (
                            <button
                              className="table-action-btn"
                              title="Edit"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && !r.is_system && (
                            <button
                              className="table-action-btn-delete"
                              title="Delete"
                              onClick={() => handleDelete(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <MasterPagination
          start={start}
          end={end}
          totalItems={filtered.length}
          currentPage={currentPage}
          totalPages={totalPages}
          empty={pageData.length === 0}
          onPrev={goPrev}
          onNext={goNext}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit role" : "Add new role"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="role-name">
                  Role name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role-name"
                  placeholder="e.g. Farm Manager"
                  {...register("role_name")}
                  className={cn(
                    errors.role_name &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {errors.role_name && (
                  <p className="text-xs text-destructive">
                    {errors.role_name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea
                  id="role-description"
                  placeholder="Describe the responsibilities of this role"
                  rows={3}
                  {...register("description")}
                  className={cn(
                    errors.description &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Active"
                      checked={statusValue === "Active"}
                      onChange={() =>
                        setValue("status", "Active" as RoleStatus, {
                          shouldValidate: true,
                        })
                      }
                      className="h-4 w-4 border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Inactive"
                      checked={statusValue === "Inactive"}
                      onChange={() =>
                        setValue("status", "Inactive" as RoleStatus, {
                          shouldValidate: true,
                        })
                      }
                      className="h-4 w-4 border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Inactive</span>
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete role?"
        description="This action cannot be undone. The role will be permanently removed."
        actionLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
        onAction={confirmDelete}
      />
    </div>
  );
}
