import React from "react";
import { Smartphone, Apple, PlayCircle } from "lucide-react";

const DownloadApp = () => {
  return (
    <section className="py-16 bg-[linear-gradient(to_right,#0B1B3D,#163C8C,#163C8C,#0B1B3D)] text-navy-100">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <span className="text-xs font-semibold tracking-widest text-blue-300 uppercase">
            WellCarDeals App
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-white mt-2">
            Buy, Sell &amp; Bid — Right From Your Phone
          </h2>
          <p className="text-slate-300 mt-3 max-w-md">
            Get instant notifications on live auctions, track your bids, and manage listings on the go.
          </p>
        </div>

        <div className="flex items-center gap-4 md:justify-end">
          <a
            href="#"
            className="flex items-center gap-2 bg-white text-[#0B1F4D] px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-100 transition"
          >
            <Apple size={20} />
            App Store
          </a>
          <a
            href="#"
            className="flex items-center gap-2 bg-white text-[#0B1F4D] px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-100 transition"
          >
            <PlayCircle size={20} />
            Google Play
          </a>
        </div>
      </div>
    </section>
  );
};

export default DownloadApp;
