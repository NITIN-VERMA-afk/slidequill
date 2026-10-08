"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Mail, MapPin, Phone, Send, Sparkles } from "lucide-react";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
        e.currentTarget.reset();
      } else {
        const body = await res.json();
        setStatus("error");
        setMessage(body.error || "Failed to send message.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white [font-family:var(--font-body)] overflow-hidden relative">
      {/* Background glowing effects */}
      <div className="absolute top-0 -left-1/4 w-[150%] h-[500px] bg-gradient-to-b from-[#2F5BFF]/20 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#9b51e0]/10 via-[#2F5BFF]/10 to-transparent blur-[150px] rounded-full pointer-events-none" />

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column - Info */}
          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 mb-8 backdrop-blur-sm w-fit">
              <Sparkles size={16} className="text-[#2F5BFF]" />
              <span className="text-sm font-medium text-white/80">Get in touch with us</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-extrabold [font-family:var(--font-display)] leading-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/60">
              Let's craft <br /> something great.
            </h1>
            
            <p className="text-lg text-white/60 mb-12 max-w-lg leading-relaxed">
              Have questions about Slidequill, need technical support, or want to explore enterprise options? Our team is ready to help you succeed.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#2F5BFF]/10 border border-[#2F5BFF]/20 flex items-center justify-center shrink-0">
                  <Mail className="text-[#2F5BFF]" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Email Us</h3>
                  <a href="mailto:nitinvermanv61506@gmail.com" className="text-white/70 hover:text-white transition-colors duration-200">
                    nitinvermanv61506@gmail.com
                  </a>
                </div>
              </div>
              


              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Phone className="text-white/80" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Call Us</h3>
                  <p className="text-white/70">
                    Mon-Fri from 9am to 6pm<br />
                    +91 9015308881
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#2F5BFF]/20 to-[#9b51e0]/20 blur-[80px] rounded-3xl" />
            
            <div className="relative bg-[#101A3A]/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 shadow-2xl">
              <h2 className="text-2xl font-bold mb-8 [font-family:var(--font-display)]">Send a message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold mb-2 text-white/80">Full Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="John Doe"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-5 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-[#2F5BFF] focus:bg-white/10 transition-all duration-300"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold mb-2 text-white/80">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="john@example.com"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-5 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-[#2F5BFF] focus:bg-white/10 transition-all duration-300"
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold mb-2 text-white/80">How can we help?</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    placeholder="Tell us about your project or inquiry..."
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-5 py-3.5 text-white placeholder:text-white/30 outline-none focus:border-[#2F5BFF] focus:bg-white/10 transition-all duration-300 resize-none"
                  />
                </div>

                {status === "success" && (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm font-medium">
                    <CheckCircle2 size={18} /> 
                    Thank you! Your message has been sent successfully.
                  </div>
                )}

                {status === "error" && (
                  <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium">
                    <AlertCircle size={18} /> 
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full group flex items-center justify-center gap-2 rounded-xl bg-[#2F5BFF] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#2F5BFF]/25 hover:bg-[#2548cc] hover:shadow-[#2F5BFF]/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      Send Message
                      <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
