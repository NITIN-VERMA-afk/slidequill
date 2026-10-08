import Link from "next/link";
import Image from "next/image";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen flex flex-col bg-[#F4F6FB] text-[#101A3A] [font-family:var(--font-body)]`}>
      <header className="fixed top-[20px] left-[5%] right-[5%] md:left-[20%] md:right-[20%] z-50 flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-white/20">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight [font-family:var(--font-display)]">
          <Image src="/logo-icon.png" alt="SlideQuill" width={32} height={32} className="shrink-0 rounded-sm" />
          Slidequill
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/#pricing" className="hover:underline">Pricing</a>
          <a href="/#faq" className="hover:underline">FAQ</a>
          <Link href="/login" className="rounded-full bg-[#101A3A] px-5 py-2 font-medium text-white hover:bg-[#1d2c5e] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]">Log in</Link>
        </nav>
      </header>

      <div className="flex-1 w-full flex flex-col pt-32 pb-24">
        {children}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#F4F6FB]/80 backdrop-blur-md border-t border-[#101A3A]/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm text-[#5a6384]">
          <span>© {new Date().getFullYear()} Slidequill</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/refund" className="hover:underline">Refund</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
