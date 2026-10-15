import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Auth checker function mirroring /api/admin/funnel security barrier
export function checkAdminFunnelAccess(
  session: { sub?: string } | null,
  user: { role?: string } | null
): { allowed: boolean; status?: number; error?: string } {
  if (!session?.sub) {
    return { allowed: false, status: 401, error: "Unauthorized." };
  }
  if (!user || user.role !== "admin") {
    return { allowed: false, status: 403, error: "Forbidden: Admin access required." };
  }
  return { allowed: true, status: 200 };
}

describe("Admin Funnel Access Control", () => {
  it("rejects unauthenticated (logged-out) access with 401 Unauthorized", () => {
    const res = checkAdminFunnelAccess(null, null);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 401);
    assert.equal(res.error, "Unauthorized.");
  });

  it("rejects session without subject with 401 Unauthorized", () => {
    const res = checkAdminFunnelAccess({}, null);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 401);
  });

  it("rejects non-admin logged-in user with 403 Forbidden", () => {
    const session = { sub: "user-123" };
    const user = { role: "user" };
    const res = checkAdminFunnelAccess(session, user);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
    assert.equal(res.error, "Forbidden: Admin access required.");
  });

  it("rejects user with missing or empty role with 403 Forbidden", () => {
    const session = { sub: "user-456" };
    const user = { role: undefined };
    const res = checkAdminFunnelAccess(session, user);
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
  });

  it("grants access to authenticated administrator with role 'admin'", () => {
    const session = { sub: "admin-999" };
    const adminUser = { role: "admin" };
    const res = checkAdminFunnelAccess(session, adminUser);
    assert.equal(res.allowed, true);
    assert.equal(res.status, 200);
  });
});
