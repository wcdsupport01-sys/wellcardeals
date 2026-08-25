import React from "react";
import { motion } from "framer-motion";

import marutiLogo from "../assets/maruti.png";
import hyundaiLogo from "../assets/hyundai.png";
import hondaLogo from "../assets/honda.png";
import tataLogo from "../assets/tata.png";
import mahindraLogo from "../assets/mahindra.png";
import kiaLogo from "../assets/kia.png";
import toyotaLogo from "../assets/toyota.png";
import vwLogo from "../assets/volkswagen.png";

const brands = [
  { name: "Maruti Suzuki", count: "12,358 Cars", logo: marutiLogo },
  { name: "Hyundai", count: "8,723 Cars", logo: hyundaiLogo },
  { name: "Honda", count: "6,235 Cars", logo: hondaLogo },
  { name: "Tata", count: "5,432 Cars", logo: tataLogo },
  { name: "Mahindra", count: "4,987 Cars", logo: mahindraLogo },
  { name: "Kia", count: "3,421 Cars", logo: kiaLogo },
  { name: "Toyota", count: "2,987 Cars", logo: toyotaLogo },
  { name: "Volkswagen", count: "2,345 Cars", logo: vwLogo },
];

const PopularBrands = () => {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-10">
          <span className="text-xs font-bold tracking-widest text-navy-900 uppercase">Popular Brands</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {brands.map((brand, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              viewport={{ once: true, amount: 0.4 }}
              className="card card-hover flex flex-col items-center justify-center gap-2 py-6 px-3 cursor-pointer"
            >
              <img
                src={brand.logo}
                alt={brand.name}
                className="h-9 w-auto max-w-[70%] object-contain"
              />
              <span className="text-sm font-semibold text-navy-900 text-center leading-tight">
                {brand.name}
              </span>
              <span className="text-[11px] text-navy-700/50">{brand.count}</span>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default PopularBrands;
