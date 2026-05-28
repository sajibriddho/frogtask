/**
 * scripts/seed.ts
 *
 * Run with:  npm run seed
 *
 * What this does (idempotent - safe to run multiple times):
 *  1. Upsert every permission from MENU_PERMISSION_TREE - `permissions` collection
 *  2. Upsert the "System Admin" role  (is_system: true - cannot be deleted)
 *  3. Upsert a RolePermission granting System Admin ALL permissions
 *  4. Upsert the "General User" role  (is_system: true - cannot be deleted)
 *  5. Upsert a RolePermission granting General User every permission EXCEPT
 *     the System section (users / roles / settings and their children)
 *  6. Upsert the default admin user (role_id linked to System Admin)
 *
 * Default admin credentials:
 *   Email   : admin@example.com
 *   Password: 123456
 */

import "dotenv/config";
import mongoose from "mongoose";

import {
  MENU_PERMISSION_TREE,
  getAllPermissionIds,
  getDirectChildrenMap,
  type MenuPermissionNode,
} from "../src/lib/menu-permissions";

import { hashPassword } from "../src/lib/password";
import Permission from "../src/model/Permission";
import Role from "../src/model/Role";
import RolePermission from "../src/model/RolePermission";
import AppUser from "../src/model/User";

// ---------------------------------------------
// Helpers
// ---------------------------------------------

const SYSTEM_ACTOR = { id: "system", name: "System" };

function flattenTree(
  nodes: MenuPermissionNode[],
  parentId: string | null = null,
): Array<{
  permission_id: string;
  permission_name: string;
  parent_id: string | null;
}> {
  const result: Array<{
    permission_id: string;
    permission_name: string;
    parent_id: string | null;
  }> = [];

  for (const node of nodes) {
    result.push({
      permission_id: node.id,
      permission_name: node.label,
      parent_id: parentId,
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, node.id));
    }
  }

  return result;
}

// ---------------------------------------------
// Step 1 - Seed Permissions
// ---------------------------------------------

async function seedPermissions(): Promise<void> {
  const flat = flattenTree(MENU_PERMISSION_TREE);
  const currentPermissionIds = flat.map((p) => p.permission_id);

  let created = 0;
  let updated = 0;

  for (const perm of flat) {
    const existing = await Permission.findOne({
      permission_id: perm.permission_id,
    });

    if (existing) {
      await Permission.updateOne(
        { permission_id: perm.permission_id },
        {
          $set: {
            permission_name: perm.permission_name,
            parent_id: perm.parent_id,
            is_system: true,
            updated_by: SYSTEM_ACTOR,
          },
        },
      );
      updated++;
    } else {
      await Permission.create({
        ...perm,
        status: "Active",
        is_system: true,
        created_by: SYSTEM_ACTOR,
        updated_by: SYSTEM_ACTOR,
      });
      created++;
    }
  }

  const stale = await Permission.find({
    is_system: true,
    permission_id: { $nin: currentPermissionIds },
  }).select("permission_id");

  if (stale.length > 0) {
    const staleIds = stale.map((p) => p.permission_id);
    await Permission.deleteMany({ permission_id: { $in: staleIds } });
    await RolePermission.updateMany(
      {},
      { $pull: { permission_ids: { $in: staleIds } } },
    );
    console.log(
      `  ------- Permissions : removed ${staleIds.length} stale system permission(s)`,
    );
  }

  console.log(
    `  ------- Permissions : ${created} created, ${updated} updated  (total ${flat.length})`,
  );
}

// ---------------------------------------------
// Step 1b - Migrate legacy parent grants to include new action children
//
// Before action-level permissions existed, granting `users` (or `tasks.all`,
// `roles`, etc.) was the only way to authorise CRUD. Now that those modules
// carry per-action children, an existing role with the parent-only grant
// would suddenly LOSE create/update/delete access (because requirePermission
// matches exactly first, then walks ancestors). To keep existing roles
// behaving identically, expand any role's permission_ids so that "parent
// granted" implies "all direct children granted" — only adding ids that
// aren't already there. Idempotent.
// ---------------------------------------------

async function migrateParentGrants(): Promise<void> {
  const directChildren = getDirectChildrenMap(MENU_PERMISSION_TREE);

  const allRolePerms = await RolePermission.find({});
  let touchedRoles = 0;

  for (const rp of allRolePerms) {
    const ids = new Set<string>(rp.permission_ids ?? []);
    const before = ids.size;

    // Walk every parent the role has; add each missing direct child.
    // Repeat until stable (so granting `users` adds users.create, granting
    // `tasks` adds tasks.all + tasks.calendar, then granting tasks.all adds
    // tasks.all.create, etc.).
    let changed = true;
    while (changed) {
      changed = false;
      for (const parent of Array.from(ids)) {
        const children = directChildren.get(parent);
        if (!children) continue;
        for (const child of children) {
          if (!ids.has(child)) {
            ids.add(child);
            changed = true;
          }
        }
      }
    }

    if (ids.size !== before) {
      await RolePermission.updateOne(
        { _id: rp._id },
        { $set: { permission_ids: Array.from(ids) } },
      );
      touchedRoles++;
    }
  }

  console.log(
    `  ------- Migration   : expanded parent grants on ${touchedRoles} role(s)`,
  );
}

// ---------------------------------------------
// Step 2 - Seed system roles
// ---------------------------------------------

// Top-level permission ids that make up the "System" section in the sidebar.
// General User must NOT receive these (or any of their descendants).
const SYSTEM_SECTION_ROOTS = ["users", "roles", "settings"];

function getNonSystemPermissionIds(): string[] {
  return getAllPermissionIds(MENU_PERMISSION_TREE).filter(
    (id) =>
      !SYSTEM_SECTION_ROOTS.some(
        (root) => id === root || id.startsWith(`${root}.`),
      ),
  );
}

async function seedRole(name: string, description: string): Promise<string> {
  const existing = await Role.findOne({ role_name: name });

  if (existing) {
    await Role.updateOne(
      { _id: existing._id },
      {
        $set: {
          is_system: true,
          status: "Active",
          description,
          updated_by: SYSTEM_ACTOR,
        },
      },
    );
    console.log(
      `  ------- Role        : "${name}" already exists - ensured is_system=true`,
    );
    return existing._id.toString();
  }

  const role = await Role.create({
    role_name: name,
    description,
    status: "Active",
    is_system: true,
    created_by: SYSTEM_ACTOR,
    updated_by: SYSTEM_ACTOR,
  });

  console.log(`  ------- Role        : "${name}" created`);
  return role._id.toString();
}

// ---------------------------------------------
// Step 3 - Seed RolePermission for a given role
// ---------------------------------------------

async function seedRolePermission(
  roleId: string,
  permissionIds: string[],
  label: string,
): Promise<void> {
  const existing = await RolePermission.findOne({ role_id: roleId });

  if (existing) {
    await RolePermission.updateOne(
      { role_id: roleId },
      {
        $set: {
          permission_ids: permissionIds,
          is_system: true,
          updated_by: SYSTEM_ACTOR,
        },
      },
    );
    console.log(
      `  ------- Permissions : RolePermission for ${label} updated (${permissionIds.length} permissions)`,
    );
  } else {
    await RolePermission.create({
      role_id: roleId,
      permission_ids: permissionIds,
      is_system: true,
      created_by: SYSTEM_ACTOR,
      updated_by: SYSTEM_ACTOR,
    });
    console.log(
      `  ------- Permissions : RolePermission for ${label} created (${permissionIds.length} permissions)`,
    );
  }
}

// ---------------------------------------------
// Step 4 - Seed Admin User
// ---------------------------------------------

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "123456";
const ADMIN_NAME = "System Administrator";
const ADMIN_USER_TYPE = "System";

async function seedAdminUser(roleId: string): Promise<void> {
  const hashedPassword = hashPassword(ADMIN_PASSWORD);
  const existing = await AppUser.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    await AppUser.updateOne(
      { email: ADMIN_EMAIL },
      {
        $set: {
          name: ADMIN_NAME,
          role_id: roleId,
          password: hashedPassword,
          user_type: ADMIN_USER_TYPE,
          can_delete: false,
          verified: true,
          status: "Active",
          updated_by: SYSTEM_ACTOR,
        },
      },
    );
    console.log(
      `  ------- Admin User  : "${ADMIN_EMAIL}" already exists - password & role_id synced`,
    );
    return;
  }

  await AppUser.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hashedPassword,
    user_type: ADMIN_USER_TYPE,
    can_delete: false,
    verified: true,
    role_id: roleId,
    status: "Active",
    created_by: SYSTEM_ACTOR,
    updated_by: SYSTEM_ACTOR,
  });

  console.log(`  ------- Admin User  : "${ADMIN_EMAIL}" created`);
}

// ---------------------------------------------
// Main
// ---------------------------------------------

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("------  MONGODB_URI is not set. Add it to .env.local");
    process.exit(1);
  }

  console.log("-  Connecting to MongoDB-------");
  await mongoose.connect(uri, { bufferCommands: false });
  console.log("-------  Connected\n");

  console.log("---  Seeding permissions-------");
  await seedPermissions();

  console.log("\n---  Migrating role grants-------");
  await migrateParentGrants();

  console.log("\n--------   Seeding roles-------");
  const adminRoleId = await seedRole(
    "System Admin",
    "Default system administrator role with full access. Cannot be deleted.",
  );
  const generalRoleId = await seedRole(
    "General User",
    "Default general user role with access to everything except the System section (users, roles, settings). Cannot be deleted.",
  );

  console.log("\n---  Seeding role permissions-------");
  await seedRolePermission(
    adminRoleId,
    getAllPermissionIds(MENU_PERMISSION_TREE),
    "System Admin",
  );
  await seedRolePermission(
    generalRoleId,
    getNonSystemPermissionIds(),
    "General User",
  );

  console.log("\n--  Seeding admin user-------");
  await seedAdminUser(adminRoleId);

  console.log("\n---------------------------------------------");
  console.log("-------  Seed complete!\n");
  console.log("  Login credentials:");
  console.log(`    Email   : ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log("---------------------------------------------\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("------  Seed failed:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
