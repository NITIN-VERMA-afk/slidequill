"use client";

import { useState } from "react";
import { Settings, Loader2, Check, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setSaving(true);

    const body: Record<string, string> = {};
    if (name.trim()) body.name = name.trim();
    if (newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    if (!Object.keys(body).length) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Something went wrong." });
      } else {
        setResult({ ok: true, msg: "Changes saved." });
        setCurrentPassword("");
        setNewPassword("");
        if (data.name) setName(data.name);
      }
    } catch {
      setResult({ ok: false, msg: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)] flex items-center gap-2">
        <Settings size={22} /> Settings
      </h2>
      <p className="mt-1 text-sm text-[#5a6384]">Update your name or password.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[#101A3A]">Display name</label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            disabled={saving}
            className="rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] placeholder:text-[#9aa3bf] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 disabled:opacity-60"
          />
        </div>

        <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-5 space-y-4">
          <p className="text-sm font-semibold text-[#101A3A]">Change password</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#5a6384]">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              className="rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#5a6384]">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              disabled={saving}
              className="rounded-xl border border-[#101A3A]/15 bg-white px-4 py-3 text-sm text-[#101A3A] shadow-sm outline-none transition focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/15 disabled:opacity-60"
            />
          </div>
        </div>

        {result && (
          <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {result.ok ? <Check size={15} /> : <AlertCircle size={15} />}
            {result.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || (!name.trim() && !newPassword)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] py-3 text-sm font-semibold text-white shadow-lg shadow-[#2F5BFF]/25 transition hover:bg-[#2449d6] disabled:opacity-50"
        >
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Save changes"}
        </button>
      </form>
    </div>
  );
}
