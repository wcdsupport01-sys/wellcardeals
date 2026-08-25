import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import carImage from "../assets/car.jpg";

const HowItWorksVideo = () => {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            See How It Works
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            A 60-second look at how you go from car number to cash in hand.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, amount: 0.3 }}
          className="relative rounded-3xl overflow-hidden shadow-xl aspect-video bg-[#0B1F4D]"
        >
          {!playing ? (
            <button
              onClick={() => setPlaying(true)}
              className="absolute inset-0 w-full h-full group"
            >
              <img
                src={carImage}
                alt="How Nxcar works — video preview"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-60 transition"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover:scale-105 transition">
                  <Play size={28} className="text-[#0B1F4D] ml-1" fill="currentColor" />
                </span>
              </div>
            </button>
          ) : (
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/REPLACE_WITH_YOUR_VIDEO_ID?autoplay=1"
              title="How it works"
              allow="autoplay; encrypted-media"
              allowFullScreen
            ></iframe>
          )}
        </motion.div>

      </div>
    </section>
  );
};

export default HowItWorksVideo;
