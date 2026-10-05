import Link from "next/link";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
 
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
 
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen bg-[#F4F6FB] text-[#101A3A] [font-family:var(--font-body)]`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-extrabold tracking-tight [font-family:var(--font-display)]">Slidequill</Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="/#pricing" className="hidden hover:underline sm:inline">Pricing</a>
          <a href="/#faq" className="hidden hover:underline sm:inline">FAQ</a>
          <Link href="/login" className="rounded-full bg-[#101A3A] px-4 py-2 font-medium text-white hover:bg-[#1d2c5e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]">Log in</Link>
        </nav>
      </header>
 
      {children}
 
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[#5a6384]">
        <span>© {new Date().getFullYear()} Slidequill</span>
        <span className="flex gap-5">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
        </span>
      </footer>
    </div>
  );
}