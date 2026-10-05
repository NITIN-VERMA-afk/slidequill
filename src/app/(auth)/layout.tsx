/**
 * (auth) route group layout.
 * If the user is already authenticated, redirect to /dashboard.
 * Otherwise render the auth pages with Bricolage Grotesque + Figtree.
 */
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { getSession } from "@/lib/auth";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className={`${display.variable} ${body.variable}`}>
      {children}
    </div>
  );
}
