import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Tag, Lock, Headphones, Home } from "lucide-react";
import logo from "../assets/logo1-real.png";
import heroCar from "../assets/auth-hero-car.png";
import bgSkyline from "../assets/bg-skyline.png";

const PERKS = [
  { icon: ShieldCheck, title: "Verified cars", desc: "100% quality checked & verified" },
  { icon: Tag, title: "Best price", desc: "Get the best deals at the right price" },
  { icon: Lock, title: "Secure bidding", desc: "Safe, transparent & secure process" },
];

export default function AuthCard({ title, subtitle, children, wide = false }) {
  const { pathname } = useLocation();
  const isSignup = pathname.includes("signup") || pathname.includes("register");
  const isDealer = pathname.includes("dealer");
  const isAdmin = pathname.includes("admin");

  const roleTargets = {
    buyer: { login: "/login", signup: "/signup" },
    dealer: { login: "/dealer-login", signup: "/dealer-register" },
  };
  const role = isDealer ? "dealer" : "buyer";

  return (
    <div
      className="min-h-screen bg-[#EAF0FB] flex items-center justify-center p-4 lg:p-6 xl:p-10 relative bg-no-repeat bg-cover bg-center overflow-x-hidden"
      style={{ backgroundImage: `url(${bgSkyline})` }}
    >
      <Link
        to="/"
        className="absolute top-5 left-5 z-30 flex items-center gap-1.5 text-sm font-semibold text-[#0B1F4D] bg-white/80 hover:bg-white border border-white rounded-full px-4 py-2 backdrop-blur-sm transition"
      >
        <Home size={15} /> Back to Home
      </Link>
      <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 items-center relative z-20">
        {/* LEFT COLUMN */}
        <div className="hidden lg:flex flex-col relative -mt-6 xl:-mt-10">
          <div className="flex items-center gap-2 mb-6">
            <img src={logo} alt="Well Car Deal" className="h-20 xl:h-24 w-auto object-contain" />
          </div>

          <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#1E4FD9] bg-white/70 border border-[#1E4FD9]/20 rounded-full px-3.5 py-1 mb-3">
            <ShieldCheck size={15} /> India's trusted used car marketplace
          </span>

          <h1 className="text-6xl xl:text-7xl font-extrabold leading-[1.02] text-[#0B1F4D] tracking-tight">
            Find.<br />
            <span className="text-[#1E4FD9]">Bid.</span><br />
            Drive.
          </h1>
          <p className="text-[#4B5C7E] text-base xl:text-lg mt-3 max-w-md">
            Discover verified used cars, place your best bid, and drive home your dream car.
          </p>

          {/* Spacer reserved for the absolutely-positioned car below */}
          <div className="h-52 xl:h-60 w-full" />

          <div className="grid grid-cols-3 gap-3">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white/80 border border-white rounded-2xl p-3.5 shadow-sm backdrop-blur-sm">
                <div className="w-9 h-9 rounded-lg bg-[#E6EEFC] flex items-center justify-center mb-2">
                  <Icon size={18} className="text-[#1E4FD9]" />
                </div>
                <p className="text-sm font-semibold text-[#0B1F4D]">{title}</p>
                <p className="text-[11px] text-[#6B7A9A] mt-0.5 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN (FORM) */}
        <div className={`w-full mx-auto lg:mx-0 lg:ml-auto z-20 ${wide ? "max-w-2xl" : "max-w-lg"}`}>
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <img src={logo} alt="Well Car Deal" className="h-14 w-auto object-contain" />
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-[#0B1F4D]/5 border border-[#E7ECF6] overflow-hidden">
            {!isAdmin && (
              <>
                <div className="grid grid-cols-2 text-center text-base font-semibold">
                  <Link
                    to={isSignup ? roleTargets.buyer.signup : roleTargets.buyer.login}
                    className={`py-5 border-b-2 transition ${
                      !isDealer
                        ? "border-[#1E4FD9] text-[#1E4FD9]"
                        : "border-transparent text-[#93A0BD] hover:text-[#4B5C7E]"
                    }`}
                  >
                    Buyer / Seller
                  </Link>
                  <Link
                    to={isSignup ? roleTargets.dealer.signup : roleTargets.dealer.login}
                    className={`py-5 border-b-2 transition ${
                      isDealer
                        ? "border-[#1E4FD9] text-[#1E4FD9]"
                        : "border-transparent text-[#93A0BD] hover:text-[#4B5C7E]"
                    }`}
                  >
                    Dealer
                  </Link>
                </div>

                <div className="px-8 pt-6 sm:px-11">
                  <div className="flex bg-[#F5F8FD] border border-[#E1E8F5] rounded-xl p-1 text-sm font-semibold">
                    <Link
                      to={roleTargets[role].login}
                      className={`flex-1 text-center py-2 rounded-lg transition ${
                        !isSignup ? "bg-[#1E4FD9] text-white" : "text-[#4B5C7E] hover:text-[#0B1F4D]"
                      }`}
                    >
                      Login
                    </Link>
                    <Link
                      to={roleTargets[role].signup}
                      className={`flex-1 text-center py-2 rounded-lg transition ${
                        isSignup ? "bg-[#1E4FD9] text-white" : "text-[#4B5C7E] hover:text-[#0B1F4D]"
                      }`}
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              </>
            )}

            <div className="px-8 py-8 sm:px-11">
              <h2 className="text-3xl font-bold text-[#0B1F4D]">{title}</h2>
              {subtitle && <p className="text-base text-[#6B7A9A] mt-2 mb-2">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-sm text-[#8593B0] mt-5">
            <Headphones size={16} /> Need help? <a href="tel:" className="text-[#1E4FD9] font-medium">Contact support</a>
          </p>
        </div>
      </div>

      {/* ABSOLUTE CAR — sized/positioned relative to the reserved spacer above */}
      <img
        src={heroCar}
        alt=""
        className="hidden lg:block absolute left-[3%] xl:left-[5%] top-[59%] xl:top-[59%] -translate-y-1/2 w-[52vw] max-w-[850px] min-w-[600px] z-10 pointer-events-none drop-shadow-[0_25px_35px_rgba(0,0,0,0.3)] saturate-[1.25] contrast-[1.05]"
      />
    </div>
  );
}

export const authInputClass =
  "w-full rounded-xl bg-[#F5F8FD] border border-[#E1E8F5] px-4 py-3.5 text-[#0B1F4D] placeholder:text-[#93A0BD] text-base focus:outline-none focus:ring-2 focus:ring-[#1E4FD9]/40 focus:border-[#1E4FD9] transition";
