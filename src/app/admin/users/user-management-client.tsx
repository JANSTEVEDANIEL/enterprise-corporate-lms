"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Edit,
  CheckCircle2,
  X,
  BookOpen,
  Send,
  UserCheck,
  Check,
} from "lucide-react";
import type { Role } from "@/types";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  job_title: string;
  manager_id?: string | null;
  manager_name?: string | null;
  is_active: number;
  created_at: string;
  enrollments_count: number;
  completed_count: number;
  certificates_count: number;
}

interface ManagerRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface CourseOption {
  id: string;
  title: string;
  category: string;
}

interface UserManagementClientProps {
  initialUsers: UserRecord[];
  managers: ManagerRecord[];
  courses: CourseOption[];
}

export function UserManagementClient({
  initialUsers,
  managers,
  courses,
}: UserManagementClientProps) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  // Selected User for edit or assign
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Provision Form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("EMPLOYEE");
  const [newDept, setNewDept] = useState("Engineering");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newManagerId, setNewManagerId] = useState("");

  // Edit Form
  const [editRole, setEditRole] = useState<Role>("EMPLOYEE");
  const [editDept, setEditDept] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // Assign Form
  const [assignCourseId, setAssignCourseId] = useState(courses[0]?.id || "");
  const [assignDueDate, setAssignDueDate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleBadges: Record<Role, { bg: string; label: string }> = {
    SUPER_ADMIN: { bg: "bg-purple-100 text-purple-800 border-purple-200", label: "Super Admin" },
    COMPLIANCE_OFFICER: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Compliance Officer" },
    MANAGER: { bg: "bg-blue-100 text-blue-800 border-blue-200", label: "Manager" },
    EMPLOYEE: { bg: "bg-slate-100 text-slate-700 border-slate-200", label: "Employee" },
  };

  const openEditModal = (user: UserRecord) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditDept(user.department);
    setEditJobTitle(user.job_title);
    setEditManagerId(user.manager_id || "");
    setEditIsActive(Boolean(user.is_active));
    setError(null);
    setIsEditOpen(true);
  };

  const openAssignModal = (user: UserRecord) => {
    setSelectedUser(user);
    setAssignCourseId(courses[0]?.id || "");
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setAssignDueDate(in30Days);
    setError(null);
    setIsAssignOpen(true);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          department: newDept,
          jobTitle: newJobTitle,
          managerId: newManagerId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const mgrName = managers.find((m) => m.id === newManagerId)?.name || null;
        setUsers([
          {
            ...data.user,
            manager_name: mgrName,
            enrollments_count: 0,
            completed_count: 0,
            certificates_count: 0,
          },
          ...users,
        ]);
        setSuccessNote(`Employee ${newName} provisioned with role ${newRole}!`);
        setIsProvisionOpen(false);
        setNewName("");
        setNewEmail("");
        setNewJobTitle("");
        setTimeout(() => setSuccessNote(null), 4000);
      } else {
        setError(data.error || "Failed to provision user");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          department: editDept,
          jobTitle: editJobTitle,
          managerId: editManagerId || null,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const mgrName = managers.find((m) => m.id === editManagerId)?.name || null;
        setUsers(
          users.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  role: editRole,
                  department: editDept,
                  job_title: editJobTitle,
                  manager_id: editManagerId || null,
                  manager_name: mgrName,
                  is_active: editIsActive ? 1 : 0,
                }
              : u
          )
        );
        setSuccessNote(`User ${selectedUser.name} updated successfully!`);
        setIsEditOpen(false);
        setTimeout(() => setSuccessNote(null), 4000);
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          courseId: assignCourseId,
          dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const courseTitle = courses.find((c) => c.id === assignCourseId)?.title || "Course";
        setSuccessNote(`Assigned "${courseTitle}" to ${selectedUser.name}!`);
        setIsAssignOpen(false);
        // increment enrollments count
        setUsers(
          users.map((u) =>
            u.id === selectedUser.id
              ? { ...u, enrollments_count: u.enrollments_count + 1 }
              : u
          )
        );
        setTimeout(() => setSuccessNote(null), 4000);
      } else {
        setError(data.error || "Failed to assign course");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {successNote && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Total Directory: <span className="font-bold text-slate-800">{users.length}</span> active corporate users
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsProvisionOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors cursor-pointer shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision Employee</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role Badge</th>
                <th className="py-3 px-4">Department & Title</th>
                <th className="py-3 px-4">Manager</th>
                <th className="py-3 px-4">Courses / Certs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px] uppercase border border-slate-300">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        roleBadges[user.role]?.bg || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {roleBadges[user.role]?.label || user.role}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{user.job_title}</div>
                    <div className="text-[11px] text-slate-400">{user.department}</div>
                  </td>

                  <td className="py-3 px-4">
                    {user.manager_name ? (
                      <span className="font-medium text-slate-700">{user.manager_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">None (Executive)</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">
                      {user.completed_count}/{user.enrollments_count} Completed
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {user.certificates_count} Certificates
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openAssignModal(user)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
                        title="Assign compliance course"
                      >
                        <BookOpen className="w-3 h-3 text-slate-500" />
                        <span>Assign</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1"
                        title="Edit role and department"
                      >
                        <Edit className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Employee Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                <h4 className="text-sm font-bold text-slate-900">Provision New Employee</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. jordan.hayes@enterprise.corp"
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department *</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Security">Security</option>
                    <option value="People Ops">People Ops</option>
                    <option value="Operations">Operations</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. Infrastructure Engineer"
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Assign Manager</label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="">None (Top-Level Executive)</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department} - {m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Provisioning..." : "Provision Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Update User: {selectedUser.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Role *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department *</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Security">Security</option>
                    <option value="People Ops">People Ops</option>
                    <option value="Operations">Operations</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Assign Manager</label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="">None (Top-Level Executive)</option>
                  {managers
                    .filter((m) => m.id !== selectedUser.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.department})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="activeCheck" className="text-xs text-slate-700 font-medium">
                  Active User Account (can authenticate and enroll)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Course Modal */}
      {isAssignOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Assign Course to {selectedUser.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAssign} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Course *</label>
                <select
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Completion Deadline</label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full h-8 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Assigning..." : "Assign Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
