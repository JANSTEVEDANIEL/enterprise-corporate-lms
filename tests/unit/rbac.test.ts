import test from "node:test";
import assert from "node:assert/strict";
import {
  CORPORATE_PERSONAS,
  getUserById,
  hasPermission,
  requireRole,
  getAllPersonas,
} from "@/lib/auth";

test("Corporate personas are properly configured", () => {
  const personas = getAllPersonas();
  assert.equal(personas.length, 5);

  const alex = getUserById("usr_alex_rivera");
  assert.ok(alex);
  assert.equal(alex?.role, "EMPLOYEE");
  assert.equal(alex?.department, "Engineering");

  const elena = getUserById("usr_elena_rostova");
  assert.ok(elena);
  assert.equal(elena?.role, "EMPLOYEE");
  assert.equal(elena?.department, "Security");

  const sarah = getUserById("usr_sarah_jenkins");
  assert.ok(sarah);
  assert.equal(sarah?.role, "MANAGER");

  const marcus = getUserById("usr_marcus_vance");
  assert.ok(marcus);
  assert.equal(marcus?.role, "COMPLIANCE_OFFICER");

  const david = getUserById("usr_david_kim");
  assert.ok(david);
  assert.equal(david?.role, "SUPER_ADMIN");
});

test("Role hierarchy and permissions enforcement", () => {
  // Super admin has permission for all roles
  assert.equal(hasPermission("SUPER_ADMIN", "EMPLOYEE"), true);
  assert.equal(hasPermission("SUPER_ADMIN", "MANAGER"), true);
  assert.equal(hasPermission("SUPER_ADMIN", "COMPLIANCE_OFFICER"), true);
  assert.equal(hasPermission("SUPER_ADMIN", "SUPER_ADMIN"), true);

  // Compliance officer has permission for manager and employee
  assert.equal(hasPermission("COMPLIANCE_OFFICER", "MANAGER"), true);
  assert.equal(hasPermission("COMPLIANCE_OFFICER", "EMPLOYEE"), true);
  assert.equal(hasPermission("COMPLIANCE_OFFICER", "SUPER_ADMIN"), false);

  // Manager has permission for employee
  assert.equal(hasPermission("MANAGER", "EMPLOYEE"), true);
  assert.equal(hasPermission("MANAGER", "MANAGER"), true);
  assert.equal(hasPermission("MANAGER", "COMPLIANCE_OFFICER"), false);

  // Employee only has permission for employee
  assert.equal(hasPermission("EMPLOYEE", "EMPLOYEE"), true);
  assert.equal(hasPermission("EMPLOYEE", "MANAGER"), false);
  assert.equal(hasPermission("EMPLOYEE", "COMPLIANCE_OFFICER"), false);
  assert.equal(hasPermission("EMPLOYEE", "SUPER_ADMIN"), false);
});
