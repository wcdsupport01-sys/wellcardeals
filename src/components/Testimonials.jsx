import React from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rohit Malhotra",
    location: "Delhi",
    rating: 5,
    text:
      "Sold my sedan within two hours of listing. The valuation was fair and the dealer picked it up from my doorstep the same evening. Payment hit my account instantly.",
    initials: "RM",
  },
  {
    name: "Ankita Sharma",
    location: "Gurugram",
    rating: 5,
    text:
      "I compared three offline dealers before this — none came close to the price I got here. The whole process, from inspection to paperwork, was transparent and quick.",
    initials: "AS",
  },
  {
    name: "Vikram Sethi",
    location: "Noida",
    rating: 4,
    text:
      "As a first-time seller I was nervous about getting a fair deal, but the live bidding meant multiple dealers competed for my car. Ended up getting a great price.",
    initials: "VS",
  },
  {
    name: "Priya Kapoor",
    location: "Delhi",
    rating: 5,
    text:
      "Loved how simple it was — uploaded my car details, got verified offers the same day, and the legal transfer was handled for me. Would recommend to anyone selling a used car.",
    initials: "PK",
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-8">

        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            What Our Customers Say
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            Real experiences from sellers who found a better deal through our dealer network.
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true, amount: 0.3 }}
              className="relative bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col hover:shadow-lg transition duration-300"
            >
              {/* Quote icon */}
              <Quote className="text-[#93c5fd] mb-3" size={28} strokeWidth={1.5} />

              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={15}
                    className={i < t.rating ? "fill-amber-400 text-[#93c5fd]" : "text-gray-300"}
                  />
                ))}
              </div>

              {/* Review text */}
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                "{t.text}"
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3 pt-4 border-t border-gray-200">
                <div className="w-10 h-10 rounded-full bg-[#0B1F4D] text-white flex items-center justify-center text-xs font-semibold">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Testimonials;
