/**
 * (app) route group layout.
 * Server component — fetches the authenticated user (including credits)
 * from the DB and passes them to the client AppShell.
 */
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { getSessionUser } from "@/lib/auth";
import AppShell from "@/components/app/AppShell";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getSessionUser() does both JWT verify + DB fetch for credits etc.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className={`${display.variable} ${body.variable}`}>
      <AppShell user={user}>{children}</AppShell>
    </div>
  );
}
