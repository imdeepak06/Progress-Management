import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Wifi,
  Camera,
  Zap,
  MonitorSmartphone,
  ShieldCheck,
  Clock3,
  LogIn,
  ArrowRight,
  ClipboardList,
  Wrench,
  Cable,
  Activity,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Scroll-reveal wrapper — fades/slides content in
   the first time it enters the viewport.
───────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Live date & time
───────────────────────────────────────────── */
function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="font-mono text-[13px] font-medium text-slate-700 tracking-wide tabular-nums">
          {time}
        </span>
      </div>
      <span className="text-[10.5px] text-slate-400 mt-0.5 tracking-wide">{date}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Hero network diagram — pure SVG + CSS,
   represents Control Room <-> WiFi / Camera / Power
───────────────────────────────────────────── */
function NetworkDiagram() {
  const nodes = [
    { icon: Wifi, label: "WiFi", top: "6%", left: "50%" },
    { icon: Camera, label: "Camera", top: "50%", left: "92%" },
    { icon: Zap, label: "Power", top: "94%", left: "50%" },
    { icon: MonitorSmartphone, label: "Field Site", top: "50%", left: "8%" },
  ];

  return (
    <div className="relative w-full aspect-square max-w-[420px] mx-auto select-none">
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full overflow-visible">
        <line x1="200" y1="200" x2="200" y2="24" className="flow-line" style={{ animationDelay: "0s" }} />
        <line x1="200" y1="200" x2="376" y2="200" className="flow-line" style={{ animationDelay: "0.35s" }} />
        <line x1="200" y1="200" x2="200" y2="376" className="flow-line" style={{ animationDelay: "0.7s" }} />
        <line x1="200" y1="200" x2="24" y2="200" className="flow-line" style={{ animationDelay: "1.05s" }} />
        <circle cx="200" cy="200" r="58" fill="none" stroke="rgba(79,110,247,0.18)" strokeWidth="1.5" />
      </svg>

      {/* Hub — Control Room */}
      <div
        className="absolute flex flex-col items-center gap-1.5"
        style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
      >
        <span className="absolute -inset-3 rounded-full bg-brand-500/10 animate-ping-slow" />
        <div className="relative w-20 h-20 rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/20 flex items-center justify-center">
          <Activity className="w-8 h-8 text-brand-400" />
        </div>
        <span className="text-[11px] font-semibold text-slate-700 tracking-wide">Control Room</span>
      </div>

      {/* Outer nodes */}
      {nodes.map(({ icon: Icon, label, top, left }) => (
        <div
          key={label}
          className="absolute flex flex-col items-center gap-1.5"
          style={{ top, left, transform: "translate(-50%,-50%)" }}
        >
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-md shadow-slate-900/5 flex items-center justify-center">
            <Icon className="w-5 h-5 text-brand-600" />
          </div>
          <span className="text-[10.5px] font-medium text-slate-500 tracking-wide">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Services — editorial alternating rows
───────────────────────────────────────────── */
const SERVICES = [
  {
    n: "01",
    icon: Wifi,
    title: "WiFi Connectivity",
    desc: "We plan, install and fine-tune wireless networks across every site so field teams and equipment stay reliably connected, however remote the location.",
  },
  {
    n: "02",
    icon: Camera,
    title: "Camera & CCTV Surveillance",
    desc: "From mounting to alignment to firmware upkeep, our engineers keep every camera feeding a clear, continuous picture back to your control room.",
  },
  {
    n: "03",
    icon: Zap,
    title: "Power & Electrical Backup",
    desc: "Solar, generator and grid backup solutions, wired and maintained to keep every camera, router and control point running through any outage.",
  },
  {
    n: "04",
    icon: MonitorSmartphone,
    title: "Control Room Integration",
    desc: "Every WiFi link, camera and power unit is wired back into one central control room dashboard, giving your team a single live view of the field.",
  },
];

function ServiceRow({ n, icon: Icon, title, desc, reverse }) {
  return (
    <Reveal>
      <div
        className={`flex flex-col ${
          reverse ? "md:flex-row-reverse" : "md:flex-row"
        } items-center gap-8 md:gap-16 py-10 md:py-14 border-b border-slate-200 last:border-b-0`}
      >
        <div className="flex-1 w-full">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-display text-sm font-bold text-brand-500 tracking-widest">{n}</span>
            <span className="h-px flex-1 max-w-[60px] bg-slate-200" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 mb-3">{title}</h3>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md">{desc}</p>
        </div>
        <div className="w-full md:w-auto flex justify-center">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Icon className="w-11 h-11 sm:w-12 sm:h-12 text-slate-800" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   Process timeline
───────────────────────────────────────────── */
const PROCESS = [
  { icon: ClipboardList, title: "Site Survey & Planning", desc: "We assess connectivity, power and camera coverage needs on the ground." },
  { icon: Cable, title: "Installation", desc: "WiFi, cameras and power infrastructure installed by certified field engineers." },
  { icon: Wrench, title: "Control Room Integration", desc: "Every device is wired into the central dashboard for unified oversight." },
  { icon: ShieldCheck, title: "Live Monitoring & Support", desc: "Continuous monitoring with rapid on-ground support whenever it's needed." },
];

function ProcessSection() {
  return (
    <div className="relative grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6">
      <div className="hidden md:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-slate-200" />
      {PROCESS.map(({ icon: Icon, title, desc }, i) => (
        <Reveal key={title} delay={i * 120}>
          <div className="relative flex flex-col items-center text-center gap-4">
            <div className="relative z-10 w-14 h-14 rounded-full bg-white border-2 border-brand-500 flex items-center justify-center">
              <Icon className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-slate-900 mb-1.5">{title}</div>
              <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed max-w-[220px] mx-auto">{desc}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stats with count-up animation
───────────────────────────────────────────── */
function useCountUp(target, active, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf;
    const startTime = performance.now();
    const tick = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function StatItem({ target, suffix = "", label }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const value = useCountUp(target, active);
  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-3xl sm:text-4xl font-extrabold text-white">
        {value}
        {suffix}
      </div>
      <div className="mt-2 text-[11px] sm:text-xs uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Home Page
───────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen w-full bg-white font-sans antialiased">
      <style>{`
        .flow-line {
          stroke: rgba(79,110,247,0.45);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-dasharray: 5 9;
          animation: flowDash 1.4s linear infinite;
        }
        @keyframes flowDash { to { stroke-dashoffset: -28; } }
        @keyframes pingSlow {
          0%   { transform: scale(0.9); opacity: 0.55; }
          80%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .animate-ping-slow { animation: pingSlow 2.6s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      {/* ── HEADER ── */}
      <header
        className={`sticky top-0 z-30 bg-white/85 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? "shadow-sm border-b border-slate-200" : "border-b border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/logo.jpeg" alt="Super Tech Power Engineers logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-bold text-slate-900 leading-tight truncate">
                Super Tech Power Engineers
              </div>
              <div className="text-[10.5px] text-slate-400 leading-tight">Pvt. Ltd.</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo("services")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Services
            </button>
            <button onClick={() => scrollTo("process")} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              How We Work
            </button>
          </nav>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden lg:block">
              <LiveClock />
            </div>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Login
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage: "linear-gradient(to bottom, black, transparent 90%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold tracking-widest uppercase mb-6">
                Field Infrastructure Specialists
              </span>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold text-slate-900 leading-[1.08] tracking-tight">
                Every site online.
                <br />
                <span className="text-brand-500">Every feed, live.</span>
              </h1>
              <p className="mt-6 text-slate-600 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                Super Tech Power Engineers Pvt. Ltd. installs and maintains the WiFi, cameras
                and power infrastructure that keep field sites connected — all wired live into
                a central control room.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3">
                <button
                  onClick={() => navigate("/login")}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
                >
                  Portal Login
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollTo("services")}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-lg border border-slate-300 hover:border-slate-400 text-slate-700 font-medium transition-colors"
                >
                  Explore Our Work
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <NetworkDiagram />
          </Reveal>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <Reveal>
            <div className="mb-2">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-brand-500">What We Do</span>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-slate-900 max-w-lg">
                Complete field infrastructure, handled end to end
              </h2>
            </div>
          </Reveal>
          <div className="mt-8">
            {SERVICES.map((s, i) => (
              <ServiceRow key={s.n} {...s} reverse={i % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESS ── */}
      <section id="process" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <Reveal>
            <div className="text-center max-w-lg mx-auto mb-14">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-brand-500">How We Work</span>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                From first survey to live monitoring
              </h2>
            </div>
          </Reveal>
          <ProcessSection />
        </div>
      </section>

      {/* ── STATS / CTA ── */}
      <section className="bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <StatItem target={24} suffix="/7" label="Live Monitoring" />
            <StatItem target={99} suffix="%" label="Uptime Focus" />
            <StatItem target={4} label="Core Services" />
            <StatItem target={100} suffix="%" label="Field-Verified Work" />
          </div>
          <Reveal>
            <div className="text-center">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white max-w-xl mx-auto">
                Already a partner site? Sign in to your control room dashboard.
              </h2>
              <button
                onClick={() => navigate("/login")}
                className="mt-7 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Portal Login
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo.jpeg" alt="Super Tech Power Engineers logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Super Tech Power Engineers Pvt. Ltd.</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock3 className="w-3.5 h-3.5" />
            &copy; {new Date().getFullYear()} All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}