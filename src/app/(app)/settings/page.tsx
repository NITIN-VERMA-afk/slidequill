import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
        Settings
      </h2>
      <p className="mt-1 text-sm text-[#5a6384]">
        Manage your account preferences
      </p>

      <div className="mt-16 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
          <Settings size={28} className="text-[#5a6384]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">
          Settings coming soon
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[#5a6384]">
          Change your name, email, and password here.
        </p>
      </div>
    </div>
  );
}
