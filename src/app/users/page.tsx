"use client";

/**
 * Users --- System.
 * Create and manage application users. List, search, add, edit, delete.
 * API: GET/POST /api/users, PUT/DELETE /api/users/:id
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  UserCog,
  CheckCircle2,
  Clock,
  Power,
  PowerOff,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { AppUser } from "@/types/user";
import type { Role } from "@/types/role";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";
import { MasterTableHeader } from "@/components/master/MasterTableHeader";
import { MasterTableEmpty } from "@/components/master/MasterTableEmpty";
import { MasterPagination } from "@/components/master/MasterPagination";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ----------------------
// Schema & types
// ----------------------

const userSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or less"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    isEdit: z.boolean(),
    role_id: z.string().min(1, "Role is required"),
    status: z.enum(["Active", "Inactive", "Pending"]),
  })
  .superRefine((data, ctx) => {
    // Password is required only while creating a user.
    if (!data.isEdit) {
      if (!data.password || data.password.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 6 characters",
          path: ["password"],
        });
      }
      if (!data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Confirm password is required",
          path: ["confirmPassword"],
        });
      }
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match",
          path: ["confirmPassword"],
        });
      }
    }
  });

type UserFormValues = z.infer<typeof userSchema>;

const EMPTY_FORM: UserFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  isEdit: false,
  role_id: "",
  status: "Active",
};

// ----------------------
// Component
// ----------------------

export default function UsersPage() {
  const { data: session } = useSession();
  const { has } = usePermissions();
  const canCreate = has("users.create");
  const canUpdate = has("users.update");
  const canDelete = has("users.delete");
  // ----- State -----
  const [list, setList] = React.useState<AppUser[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "pending" | "active" | "inactive"
  >("all");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  // Pending status-change confirmation. `kind` drives copy + button colour
  // (approve/activate are positive, deactivate is destructive).
  const [statusAction, setStatusAction] = React.useState<{
    user: AppUser;
    nextStatus: "Active" | "Inactive";
    kind: "approve" | "activate" | "deactivate";
  } | null>(null);
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ----- Form -----
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: EMPTY_FORM,
  });

  const statusValue = watch("status");

  // ----- Data fetching -----
  React.useEffect(() => {
    Promise.all([fetchUsers(), fetchRoles()]);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await parseJsonSafe<{
        success: boolean;
        data: AppUser[];
        error?: string;
      }>(res);
      if (data.success) {
        const normalised = (data.data as Array<AppUser & { _id?: string }>).map(
          (d) => ({
            ...d,
            id: d._id ?? d.id,
          }),
        );
        setList(normalised);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles/lookup");
      const data = await parseJsonSafe<{
        success: boolean;
        data: Role[];
        error?: string;
      }>(res);
      if (data.success) {
        const normalised = (data.data as Array<Role & { _id?: string }>).map(
          (d) => ({
            ...d,
            id: d._id ?? d.id,
          }),
        );
        setRoles(normalised);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  // Role lookup map for display
  const roleMap = React.useMemo(
    () => new Map(roles.map((r) => [r.id, r.role_name])),
    [roles],
  );

  // Stable options array for the role dropdown — recomputing this each render
  // hands react-select a fresh reference every time, which (combined with
  // mounting inside a Dialog/portal) can drop the displayed selection.
  const roleOptions = React.useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.role_name })),
    [roles],
  );

  // ----- Derived: filtered list + sort + pagination -----
  const statusCounts = React.useMemo(() => {
    let pending = 0;
    let active = 0;
    let inactive = 0;
    for (const u of list) {
      if (u.status === "Pending") pending++;
      else if (u.status === "Active") active++;
      else if (u.status === "Inactive") inactive++;
    }
    return { all: list.length, pending, active, inactive };
  }, [list]);

  const filtered = React.useMemo(() => {
    let out = list;

    // Status filter chips
    if (statusFilter !== "all") {
      const want =
        statusFilter === "pending"
          ? "Pending"
          : statusFilter === "active"
            ? "Active"
            : "Inactive";
      out = out.filter((u) => u.status === want);
    }

    // Search
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.status || "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [list, searchTerm, statusFilter]);

  // Project a `role` field onto each row so the sort hook can compare it
  // by the displayed name (the raw `role_id` would sort by ObjectId).
  type SortableUser = AppUser & { role: string };
  const sortable = React.useMemo<SortableUser[]>(
    () =>
      filtered.map((u) => ({
        ...u,
        role: u.role_id ? (roleMap.get(u.role_id) ?? "") : "",
      })),
    [filtered, roleMap],
  );

  type UserSortKey = "name" | "email" | "role" | "status";
  const { sorted, sortKey, direction, requestSort } = useSort<
    SortableUser,
    UserSortKey
  >(sortable, "name");

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
  const onSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);
    const SYSTEM_USER = {
      id: session?.user?.id ?? "system",
      name: session?.user?.name ?? "System",
    };
    const base = {
      name: values.name,
      email: values.email,
      role_id: values.role_id,
      status: values.status,
      updated_by: SYSTEM_USER,
    };
    const payload = editingId
      ? base
      : {
          ...base,
          password: values.password,
          created_by: SYSTEM_USER,
        };

    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId && !values.password
            ? payload
            : { ...payload, password: values.password },
        ),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success(
          editingId ? "User updated successfully" : "User created successfully",
        );
        fetchUsers();
        closeModal();
      } else {
        toast.error(data.error || "Operation failed");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error("Error saving user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Status change (approve / activate / deactivate) ────────────────
  //
  // All three actions are flips of `status` on the user document; the
  // only real difference is the conversation we have with the admin
  // before doing it. We funnel them through a single confirmation
  // dialog and a single API call so the audit trail is consistent.
  //
  // Note: when an admin sets a user to "Inactive", that user's session
  // is killed automatically within ~15s — the JWT callback in
  // `auth-options.ts` re-checks the DB on every request and flips
  // `token.valid = false` for any user whose status is no longer
  // "Active". Combined with the authorize() check at sign-in, that
  // guarantees only Active users can ever reach the system.
  const askApprove = (u: AppUser) => {
    if (u.status !== "Pending") return;
    setStatusAction({ user: u, nextStatus: "Active", kind: "approve" });
  };

  const askActivate = (u: AppUser) => {
    if (u.status === "Active") return;
    setStatusAction({ user: u, nextStatus: "Active", kind: "activate" });
  };

  const askDeactivate = (u: AppUser) => {
    if (u.status !== "Active") return;
    setStatusAction({ user: u, nextStatus: "Inactive", kind: "deactivate" });
  };

  const confirmStatusChange = async () => {
    if (!statusAction) return;
    setStatusUpdating(true);
    try {
      const SYSTEM_USER = {
        id: session?.user?.id ?? "system",
        name: session?.user?.name ?? "System",
      };
      const res = await fetch(`/api/users/${statusAction.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusAction.nextStatus,
          updated_by: SYSTEM_USER,
        }),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        const verb =
          statusAction.kind === "approve"
            ? "approved"
            : statusAction.kind === "activate"
              ? "activated"
              : "deactivated";
        toast.success(`${statusAction.user.name} ${verb}`);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error("Failed to update user status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = (id: string) => setDeleteId(id);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error deleting user");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    reset({ ...EMPTY_FORM, isEdit: false });
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEdit = async (item: AppUser) => {
    try {
      const res = await fetch(`/api/users/${item.id}`);
      const data = await parseJsonSafe<{
        success: boolean;
        data: AppUser;
        error?: string;
      }>(res);
      if (!data.success) {
        toast.error(data.error || "Failed to load user");
        return;
      }
      const u = data.data;
      reset({
        name: u.name,
        email: u.email,
        password: "",
        confirmPassword: "",
        isEdit: true,
        role_id: u.role_id ?? "",
        status: u.status,
      });
      setEditingId(item.id);
      setShowPassword(false);
      setModalOpen(true);
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load user data");
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    reset(EMPTY_FORM);
    setShowPassword(false);
  };

  // ----- Render -----
  return (
    <div className="space-y-4">
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        <MasterTableHeader
          icon={UserCog}
          title="User Management"
          description="Create application users and assign roles to control access."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onAddClick={canCreate ? openAdd : undefined}
        />

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
          {(
            [
              { id: "all", label: "All", count: statusCounts.all },
              { id: "pending", label: "Pending", count: statusCounts.pending },
              { id: "active", label: "Active", count: statusCounts.active },
              {
                id: "inactive",
                label: "Inactive",
                count: statusCounts.inactive,
              },
            ] as const
          ).map((chip) => {
            const isActive = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setStatusFilter(chip.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow shadow-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{chip.label}</span>
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                    isActive
                      ? "bg-white/20 text-primary-foreground"
                      : chip.id === "pending" && chip.count > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-card text-muted-foreground",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="table-header-cell w-12">SL</TableHead>
                  <SortableTableHead
                    sortKey="name"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Name
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="email"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Email
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="role"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Role
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
                    colSpan={6}
                    hasSearch={!!searchTerm.trim()}
                    messageEmpty="Add your first user"
                  />
                ) : (
                  pageData.map((u, index) => (
                    <TableRow
                      key={u.id}
                      className="group transition-colors hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <TableCell className="py-4 px-4 text-sm text-muted-foreground w-12">
                        {start + index + 1}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {u.name}
                          </span>
                          <VerifiedBadge verified={!!u.verified} />
                        </div>
                      </TableCell>
                      <TableCell className="table-data-cell">
                        {u.email}
                      </TableCell>
                      <TableCell className="table-data-cell">
                        {u.role_id ? (roleMap.get(u.role_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Approve — only visible for Pending */}
                          {canUpdate && u.status === "Pending" && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/15 dark:text-emerald-300"
                              title="Approve user"
                              onClick={() => askApprove(u)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </button>
                          )}
                          {/* Activate — only visible for Inactive */}
                          {canUpdate && u.status === "Inactive" && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/15 dark:text-emerald-300"
                              title="Activate user"
                              onClick={() => askActivate(u)}
                            >
                              <Power className="h-3.5 w-3.5" />
                              Activate
                            </button>
                          )}
                          {/* Deactivate — Active users only; never self, never
                              system accounts (can_delete === false) */}
                          {canUpdate &&
                            u.status === "Active" &&
                            u.can_delete !== false &&
                            u.id !== session?.user?.id && (
                              <button
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-500/15 dark:text-amber-300"
                                title="Deactivate user"
                                onClick={() => askDeactivate(u)}
                              >
                                <PowerOff className="h-3.5 w-3.5" />
                                Deactivate
                              </button>
                            )}
                          {canUpdate && (
                            <button
                              className="table-action-btn"
                              title="Edit"
                              onClick={() => openEdit(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && u.can_delete !== false && (
                            <button
                              className="table-action-btn-delete"
                              title="Delete"
                              onClick={() => handleDelete(u.id)}
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
              {editingId ? "Edit user" : "Add new user"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. John Doe"
                  {...register("name")}
                  className={cn(
                    errors.name &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. john@example.com"
                  {...register("email")}
                  className={cn(
                    errors.email &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {!editingId && (
                <>
                  {/* Password */}
                  <div className="grid gap-2">
                    <Label htmlFor="password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        {...register("password")}
                        className={cn(
                          "pr-10",
                          errors.password &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">
                      Confirm password
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        {...register("confirmPassword")}
                        className={cn(
                          "pr-10",
                          errors.confirmPassword &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Role */}
              <div className="grid gap-2">
                <Label htmlFor="role_id">
                  Role <span className="text-destructive">*</span>
                </Label>
                {/* `Controller` keeps the dropdown's value in lockstep with
                    react-hook-form across reset()/setValue() — `watch` + a
                    plain controlled input had subtle re-render gaps that
                    sometimes left the edit dialog showing a stale role.
                    Menu is portaled to <body> so the Dialog's transform +
                    overflow:auto can't clip it. Outside-pointer-down on the
                    dialog ignores clicks inside `.ss__menu` (see below). */}
                <Controller
                  name="role_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger
                        id="role_id"
                        className={cn(
                          errors.role_id &&
                            "border-destructive focus:ring-destructive",
                        )}
                      >
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.role_id && (
                  <p className="text-xs text-destructive">
                    {errors.role_id.message}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                  {(["Active", "Pending", "Inactive"] as const).map(
                    (option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          value={option}
                          checked={statusValue === option}
                          onChange={() =>
                            setValue("status", option, {
                              shouldValidate: true,
                            })
                          }
                          className="h-4 w-4 border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">{option}</span>
                      </label>
                    ),
                  )}
                </div>
                {statusValue !== "Active" && (
                  <p className="text-xs text-muted-foreground">
                    {statusValue === "Pending"
                      ? "Pending users cannot sign in until approved."
                      : "Inactive users cannot sign in."}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Delete user"
        description="This action cannot be undone. The user will permanently lose access."
        actionLabel={deleting ? "Deleting…" : "Delete"}
        variant="destructive"
        loading={deleting}
        onAction={confirmDelete}
      />

      {/* Approve / Activate / Deactivate confirmation */}
      <AlertDialog
        open={!!statusAction}
        onOpenChange={(o) => {
          if (!o && !statusUpdating) setStatusAction(null);
        }}
        title={
          statusAction?.kind === "approve"
            ? `Approve ${statusAction.user.name}?`
            : statusAction?.kind === "activate"
              ? `Activate ${statusAction.user.name}?`
              : statusAction?.kind === "deactivate"
                ? `Deactivate ${statusAction.user.name}?`
                : ""
        }
        description={
          statusAction?.kind === "approve"
            ? "Their account will be set to Active and they'll be able to sign in immediately with the role you assigned."
            : statusAction?.kind === "activate"
              ? "They'll be able to sign in again with their existing credentials. No password reset needed."
              : statusAction?.kind === "deactivate"
                ? "They will be signed out within 15 seconds and won't be able to sign in until reactivated. Their data is preserved."
                : ""
        }
        actionLabel={
          statusUpdating
            ? "Updating…"
            : statusAction?.kind === "approve"
              ? "Approve"
              : statusAction?.kind === "activate"
                ? "Activate"
                : "Deactivate"
        }
        variant={statusAction?.kind === "deactivate" ? "destructive" : "default"}
        loading={statusUpdating}
        onAction={confirmStatusChange}
      />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Color-coded status pill matching the User Status enum. */
function StatusBadge({ status }: { status: string }) {
  if (status === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === "Active") {
    return (
      <Badge variant="default">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      Inactive
    </Badge>
  );
}

/** Verified / Unverified icon shown next to the user's name. */
function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span
        title="Verified"
        aria-label="Verified"
        className="inline-flex items-center text-sky-600 dark:text-sky-400"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      title="Unverified"
      aria-label="Unverified"
      className="inline-flex items-center text-muted-foreground"
    >
      <ShieldAlert className="h-4 w-4" />
    </span>
  );
}
