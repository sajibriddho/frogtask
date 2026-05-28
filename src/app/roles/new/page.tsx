"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

type PermissionRow = {
  _id?: string;
  permission_id: string;
  permission_name: string;
  parent_id: string | null;
};

type PermissionTreeNode = {
  id: string;
  label: string;
  children: PermissionTreeNode[];
};

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

const DEFAULTS: RoleFormValues = {
  role_name: "",
  description: "",
  status: "Active",
};

function buildPermissionTree(rows: PermissionRow[]): PermissionTreeNode[] {
  const nodeMap = new Map<string, PermissionTreeNode>();
  const byParent = new Map<string | null, PermissionTreeNode[]>();

  for (const row of rows) {
    nodeMap.set(row.permission_id, {
      id: row.permission_id,
      label: row.permission_name,
      children: [],
    });
  }

  for (const row of rows) {
    const node = nodeMap.get(row.permission_id);
    if (!node) continue;

    const parentId =
      row.parent_id && nodeMap.has(row.parent_id) ? row.parent_id : null;

    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId)!.push(node);
  }

  const attach = (node: PermissionTreeNode): PermissionTreeNode => {
    const children = byParent.get(node.id) ?? [];
    return {
      ...node,
      children: children.map(attach),
    };
  };

  return (byParent.get(null) ?? []).map(attach);
}

function collectDescendants(node: PermissionTreeNode): string[] {
  const ids = [node.id];
  for (const child of node.children) {
    ids.push(...collectDescendants(child));
  }
  return ids;
}

type TreeNodeProps = {
  node: PermissionTreeNode;
  depth: number;
  selectedIds: Set<string>;
  onToggleNode: (node: PermissionTreeNode, checked: boolean) => void;
};

function TreeNode({ node, depth, selectedIds, onToggleNode }: TreeNodeProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const checked = selectedIds.has(node.id);
  const descendantIds = React.useMemo(() => collectDescendants(node), [node]);
  const selectedCount = descendantIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const indeterminate =
    hasChildren && selectedCount > 0 && selectedCount < descendantIds.length;
  const checkboxRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <li className="list-none">
      <div
        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="rounded p-0.5 hover:bg-muted"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <label className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggleNode(node, e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-primary"
          />
          <span className="truncate text-sm font-medium text-foreground">
            {node.label}
          </span>
        </label>
      </div>

      {hasChildren && isOpen && (
        <ul className="ml-3 border-l border-border pl-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onToggleNode={onToggleNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function NewRolePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPermissions, setLoadingPermissions] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [permissionTree, setPermissionTree] = React.useState<
    PermissionTreeNode[]
  >([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: DEFAULTS,
  });

  const statusValue = watch("status");

  React.useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await fetch("/api/permissions");
        const data = await parseJsonSafe<{
          success: boolean;
          data: PermissionRow[];
          error?: string;
        }>(res);

        if (!data.success) {
          toast.error(data.error || "Failed to load permissions");
          setPermissionTree([]);
          return;
        }

        setPermissionTree(buildPermissionTree(data.data ?? []));
      } catch (error) {
        console.error("Error fetching permissions:", error);
        toast.error("Error loading permissions");
        setPermissionTree([]);
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, []);

  const toggleNode = React.useCallback(
    (node: PermissionTreeNode, checked: boolean) => {
      const affected = collectDescendants(node);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          for (const id of affected) next.add(id);
        } else {
          for (const id of affected) next.delete(id);
        }
        return next;
      });
    },
    [],
  );

  const onSubmit = async (values: RoleFormValues) => {
    setSaving(true);

    const SYSTEM_USER = {
      id: session?.user?.id ?? "system",
      name: session?.user?.name ?? "System",
    };

    try {
      const roleRes = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          created_by: SYSTEM_USER,
          updated_by: SYSTEM_USER,
        }),
      });

      const roleData = await parseJsonSafe<{
        success: boolean;
        data?: { _id?: string; id?: string };
        error?: string;
      }>(roleRes);

      if (!roleData.success || !roleData.data) {
        toast.error(roleData.error || "Failed to create role");
        return;
      }

      const roleId = roleData.data._id ?? roleData.data.id;
      if (!roleId) {
        toast.error("Role created but no role id returned");
        return;
      }

      const rolePermissionRes = await fetch(`/api/role-permissions/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permission_ids: Array.from(selectedIds),
          updated_by: SYSTEM_USER,
        }),
      });

      const rolePermissionData = await parseJsonSafe<{
        success: boolean;
        error?: string;
      }>(rolePermissionRes);

      if (!rolePermissionData.success) {
        toast.error(
          rolePermissionData.error ||
            "Role created, but failed to assign permissions",
        );
        return;
      }

      toast.success("Role created successfully");
      router.push("/roles");
    } catch (error) {
      console.error("Error creating role:", error);
      toast.error("Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Add New Role
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter role details and select permissions from the tree.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/roles")}>
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label>Status</Label>
              <div className="flex gap-6 pt-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    value="Active"
                    checked={statusValue === "Active"}
                    onChange={() =>
                      setValue("status", "Active", { shouldValidate: true })
                    }
                    className="h-4 w-4 border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    value="Inactive"
                    checked={statusValue === "Inactive"}
                    onChange={() =>
                      setValue("status", "Inactive", { shouldValidate: true })
                    }
                    className="h-4 w-4 border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Inactive</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              rows={3}
              placeholder="Describe this role"
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
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Permissions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Check or uncheck nodes to grant access for this role.
            </p>
          </div>

          <div className="p-4 md:p-6">
            {loadingPermissions ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : permissionTree.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permissions found.
              </p>
            ) : (
              <ul className="space-y-0">
                {permissionTree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedIds={selectedIds}
                    onToggleNode={toggleNode}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/roles")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || loadingPermissions}>
            {saving ? "Saving..." : "Create Role"}
          </Button>
        </div>
      </form>
    </div>
  );
}
