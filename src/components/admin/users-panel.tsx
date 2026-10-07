"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, ApiClientError } from "@/lib/http/client";
import {
  productionRoles,
  roleLabels,
  type AppRole,
} from "@/modules/identity/types";
import type { AdminUser, PageResult } from "@/modules/admin/types";
import { StatusBadge, RoleBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  displayTimezone,
} from "@/components/shared/data-display";
import { AdminDialog } from "./admin-dialog";
type Action = { kind: "create" } | { kind: "role" | "status"; user: AdminUser };
export function UsersPanel() {
  const [page, setPage] = useState<PageResult<AdminUser> | null>(null);
  const [filters, setFilters] = useState({ search: "", role: "", active: "" });
  const [cursors, setCursors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [stale, setStale] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const generation = useRef<object>({});
  const load = useCallback(() => {
    const current = {};
    generation.current = current;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
    const cursor = cursors.at(-1);
    if (cursor) query.set("cursor", cursor);
    return api<PageResult<AdminUser>>(`/api/admin/users?${query}`)
      .then((result) => {
        if (current === generation.current) {
          setPage(result);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (current !== generation.current) return;
        setPage(null);
        setError(
          failure instanceof Error
            ? failure.message
            : "Users could not be loaded.",
        );
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
  }, [filters, cursors]);
  useEffect(() => {
    void load();
    return () => {
      generation.current = {};
    };
  }, [load]);
  useEffect(() => {
    if (discarding) keepEditingRef.current?.focus();
    else
      formRef.current?.querySelector<HTMLInputElement>("input,select")?.focus();
  }, [discarding]);
  useEffect(() => {
    if (dialogError) errorRef.current?.focus();
  }, [dialogError]);
  function keepEditing() {
    setDiscarding(false);
  }
  function close() {
    if (discarding) {
      keepEditing();
      return;
    }
    if (dirty) {
      setDiscarding(true);
      return;
    }
    setAction(null);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setCursors([]);
    setFilters({
      search: String(data.get("search") ?? ""),
      role: String(data.get("role") ?? ""),
      active: String(data.get("active") ?? ""),
    });
  }
  function open(next: Action) {
    setDirty(false);
    setDiscarding(false);
    setStale(false);
    setDialogError("");
    setFieldErrors({});
    setNotice("");
    setAction(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !action) return;
    const values = new FormData(event.currentTarget);
    setSaving(true);
    setDialogError("");
    setFieldErrors({});
    try {
      if (action.kind === "create")
        await api<AdminUser>("/api/admin/users", {
          method: "POST",
          body: {
            email: values.get("email"),
            fullName: values.get("fullName"),
            role: values.get("newRole"),
            temporaryPassword: values.get("temporaryPassword"),
          },
        });
      else
        await api<AdminUser>(
          `/api/admin/users/${action.user.id}/${action.kind}`,
          {
            method: "PATCH",
            body: {
              expectedRevision: action.user.revision,
              ...(action.kind === "role"
                ? { role: values.get("newRole") }
                : { isActive: !action.user.isActive }),
            },
          },
        );
      setAction(null);
      setNotice(
        action.kind === "create" ? "User created." : "Account updated.",
      );
      setLoading(true);
      await load();
    } catch (failure) {
      setDialogError(
        failure instanceof Error
          ? failure.message
          : "The account could not be saved.",
      );
      if (failure instanceof ApiClientError) {
        setFieldErrors(failure.fieldErrors);
        if (failure.status === 409) {
          setStale(true);
          setLoading(true);
          void load();
        }
      }
    } finally {
      const password = formRef.current?.elements.namedItem("temporaryPassword");
      if (password instanceof HTMLInputElement) password.value = "";
      setSaving(false);
    }
  }
  const title =
    action?.kind === "create"
      ? "Add User"
      : action?.kind === "role"
        ? "Change Role"
        : action?.user.isActive
          ? "Deactivate account"
          : "Activate account";
  const description =
    action?.kind === "create"
      ? "Create an active production account with a temporary password."
      : action
        ? `${action.user.fullName} (${action.user.email}). ${action.kind === "role" ? "The new role applies on the next request." : action.user.isActive ? "Application access will be denied after deactivation." : "Application access will be restored."}`
        : "";
  function field(name: string) {
    return fieldErrors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {fieldErrors[name]?.join(" ")}
      </p>
    ) : null;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Users</h1>
          <p className="intro">Manage production accounts and access.</p>
        </div>
        <button
          className="button primary"
          onClick={() => open({ kind: "create" })}
        >
          Add User
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
      <form className="filters" onSubmit={search}>
        <div className="field search-field">
          <label htmlFor="search">Search users</label>
          <input
            id="search"
            name="search"
            placeholder="Name or email"
            maxLength={100}
          />
        </div>
        <div className="field">
          <label htmlFor="role-filter">Role</label>
          <select id="role-filter" name="role">
            <option value="">All roles</option>
            {(["SYSTEM_ADMIN", ...productionRoles] as AppRole[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="active-filter">Status</label>
          <select id="active-filter" name="active">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <button className="button secondary" type="submit" disabled={loading}>
          Search
        </button>
      </form>
      {loading ? (
        <p role="status">Loading users…</p>
      ) : (
        page && (
          <>
            <div
              className="table-region"
              role="region"
              aria-label="User accounts"
              tabIndex={0}
            >
              <table>
                <caption>Application accounts · {displayTimezone}</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((user) => (
                    <tr key={user.id}>
                      <td className="primary-data">{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>
                        <StatusBadge
                          status={user.isActive ? "ACTIVE" : "INACTIVE"}
                        />
                      </td>
                      <td>
                        <HumanDateTime value={user.createdAt} stacked />
                      </td>
                      <td>
                        {user.role === "SYSTEM_ADMIN" ? (
                          <StatusBadge status="PROTECTED" />
                        ) : (
                          <div className="actions">
                            <button
                              className="button secondary"
                              aria-label={`Change role for ${user.fullName}`}
                              onClick={() => open({ kind: "role", user })}
                            >
                              Change Role
                            </button>
                            <button
                              className={`button secondary ${user.isActive ? "reject-entry" : ""}`}
                              aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${user.fullName}`}
                              onClick={() => open({ kind: "status", user })}
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.items.length === 0 && (
              <p className="empty-state">No users match these filters.</p>
            )}
            <div className="pagination">
              <button
                className="button secondary"
                disabled={!cursors.length}
                onClick={() => {
                  setLoading(true);
                  setCursors((old) => old.slice(0, -1));
                }}
              >
                Previous
              </button>
              <span>Page {cursors.length + 1}</span>
              <button
                className="button secondary"
                disabled={!page.nextCursor}
                onClick={() => {
                  if (page.nextCursor) {
                    const next = page.nextCursor;
                    setLoading(true);
                    setCursors((old) => [...old, next]);
                  }
                }}
              >
                Next
              </button>
            </div>
          </>
        )
      )}
      <AdminDialog
        open={Boolean(action)}
        title={discarding ? "Discard changes?" : title}
        description={
          discarding
            ? "The unsaved account details will be discarded."
            : description
        }
        busy={saving}
        onCancel={close}
      >
        {discarding && (
          <div className="actions">
            <button
              className="button secondary"
              ref={keepEditingRef}
              onClick={keepEditing}
            >
              Keep editing
            </button>
            <button
              className="button destructive"
              onClick={() => {
                setAction(null);
                setDirty(false);
                setDiscarding(false);
              }}
            >
              Discard changes
            </button>
          </div>
        )}
        {dialogError && !discarding && (
          <div
            className="alert error"
            role="alert"
            ref={errorRef}
            tabIndex={-1}
          >
            {dialogError}
          </div>
        )}
        <form
          ref={formRef}
          className="form-stack"
          hidden={discarding}
          onChange={() => setDirty(true)}
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-busy={saving}
        >
          {action?.kind === "create" && (
            <>
              <div className="field">
                <label htmlFor="fullName">Full name (required)</label>
                <input
                  id="fullName"
                  name="fullName"
                  required
                  maxLength={200}
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={
                    fieldErrors.fullName ? "fullName-error" : undefined
                  }
                />
                {field("fullName")}
              </div>
              <div className="field">
                <label htmlFor="new-email">Email (required)</label>
                <input
                  id="new-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                />
                {field("email")}
              </div>
            </>
          )}
          {(action?.kind === "create" || action?.kind === "role") && (
            <div className="field">
              <label htmlFor="new-role">Production role (required)</label>
              <select
                id="new-role"
                name="newRole"
                defaultValue={
                  action.kind === "role"
                    ? action.user.role
                    : "CUTTING_SUPERVISOR"
                }
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.role)}
                aria-describedby={fieldErrors.role ? "role-error" : undefined}
              >
                {productionRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              {field("role")}
            </div>
          )}
          {action?.kind === "create" && (
            <div className="field">
              <label htmlFor="temporary-password">
                Temporary password (required)
              </label>
              <input
                id="temporary-password"
                name="temporaryPassword"
                type="password"
                required
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.temporaryPassword)}
                aria-describedby={
                  fieldErrors.temporaryPassword
                    ? "password-policy temporaryPassword-error"
                    : "password-policy"
                }
              />
              <p id="password-policy" className="helper">
                At least 6 characters. The project password policy also applies.
              </p>
              {field("temporaryPassword")}
            </div>
          )}
          <div className="actions">
            <button
              type="button"
              className="button secondary"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button ${action?.kind === "status" && action.user.isActive ? "destructive" : "primary"}`}
              disabled={saving || stale}
            >
              {saving
                ? "Saving…"
                : action?.kind === "create"
                  ? "Create User"
                  : action?.kind === "role"
                    ? "Save Role"
                    : action?.user.isActive
                      ? "Deactivate"
                      : "Activate"}
            </button>
          </div>
        </form>
      </AdminDialog>
    </>
  );
}
