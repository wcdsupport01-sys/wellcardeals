import React from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Truck,
  ShieldCheck,
  Clock,
  Headphones,
} from "lucide-react";
import mapBg from "../assets/city-map-bg.png";

/* Adjusted Faridabad top position slightly (68%) so floating panel doesn't hide it */
const cities = [
  { name: "Meerut", distance: "70 km", top: "10%", left: "70%" },
  { name: "Bahadurgarh", distance: "30 km", top: "41%", left: "28%" },
  { name: "Ghaziabad", distance: "30 km", top: "40%", left: "75%" },
  { name: "Gurugram", distance: "30 km", top: "73%", left: "31%" },
  { name: "Noida", distance: "27 km", top: "70%", left: "72%" },
];

const features = [
  { icon: <Truck size={18} />, title: "Doorstep Service", desc: "We come to you", bg: "bg-amber-50", fg: "text-amber-500" },
  { icon: <ShieldCheck size={18} />, title: "Trusted & Secure", desc: "100% Safe process", bg: "bg-brand-50", fg: "text-brand-600" },
  { icon: <Clock size={18} />, title: "Time Saving", desc: "Quick & Convenient", bg: "bg-emerald-50", fg: "text-emerald-500" },
  { icon: <Headphones size={18} />, title: "Expert Support", desc: "We're here to help", bg: "bg-violet-50", fg: "text-violet-500" },
];

const CityPin = ({ city, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45, delay }}
    className="absolute flex items-center gap-2 -translate-x-1/2 -translate-y-1/2 z-10"
    style={{ top: city.top, left: city.left }}
  >
    <span className="h-8 w-8 shrink-0 rounded-full bg-navy-900 text-white flex items-center justify-center shadow-lift">
      <MapPin size={15} />
    </span>
    <div className="max-w-[92px] sm:max-w-none whitespace-normal sm:whitespace-nowrap bg-white rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 shadow-card border border-slate-100">
      <p className="text-[10px] sm:text-xs font-bold text-navy-900 leading-tight">{city.name}</p>
      <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight">{city.distance}</p>
    </div>
  </motion.div>
);

const CityCoverage = () => {
  return (
    <section className="py-20 md:py-28 bg-surface">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-widest text-brand-600 uppercase">
            Service Coverage
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-navy-900 tracking-tight">
            We're Live In Your City
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Doorstep inspection and pickup available across these locations,
            with more cities launching soon.
          </p>
        </div>

        {/* Map card wrapper */}
        <div className="relative rounded-[24px] overflow-hidden border border-slate-200 shadow-card bg-[#EEF1F4] h-[520px] sm:h-[620px]">
          
          <img
            src={mapBg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-white/10" />

          {/* Delhi hub label */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-card z-10"
          >
            <span className="h-3 w-3 rounded-full bg-brand-600 ring-4 ring-brand-200 mb-1.5" />
            <span className="text-base sm:text-lg font-extrabold tracking-widest text-navy-900">
              DELHI
            </span>
          </motion.div>

          {/* City pins */}
          {cities.map((city, i) => (
            <CityPin key={city.name} city={city} delay={0.1 + i * 0.08} />
          ))}

          {/* Top-left floating info card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-xs bg-white/95 backdrop-blur-sm rounded-2xl shadow-card border border-slate-100 px-4 py-3.5 flex items-center gap-3 z-10"
          >
            <span className="h-11 w-11 shrink-0 rounded-full bg-amber-50 flex items-center justify-center">
              <Truck size={20} className="text-amber-500" />
            </span>
            <div>
              <p className="text-xs sm:text-sm font-bold text-navy-900 leading-snug">
                Doorstep Car Inspection &amp; Pickup Service
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                We come to you, wherever you are.
              </p>
            </div>
          </motion.div>

          {/* FLOATING BOTTOM PANEL */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="absolute left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-lift border border-slate-100 px-4 sm:px-8 py-3.5 z-20"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className={`h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full ${f.bg} ${f.fg} flex items-center justify-center`}>
                    {f.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-navy-900 leading-tight truncate">
                      {f.title}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight truncate">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default CityCoverage;