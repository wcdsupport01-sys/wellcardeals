import React from "react";
import { Facebook, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/logo1-real.png";

const Footer = () => {
    return (
        <footer className="bg-navy-gradient text-navy-100 pt-20 pb-10">
            <div className="max-w-7xl mx-auto px-8">

                {/* TOP GRID */}
                <div className="grid md:grid-cols-4 gap-12">

                    {/* BRAND */}
                    <div>
                        <h3 className="flex items-center gap-2">
                            <span className="h-9 w-9 rounded-full bg-white flex items-center justify-center p-1">
                                <img src={logo} alt="WellCarDeals Logo" className="h-full w-full object-contain" />
                            </span>
                            <span className="text-lg font-bold text-white tracking-tight font-display">WellCarDeals</span>
                        </h3>

                        <p className="mt-4 text-sm text-navy-300 leading-relaxed">
                            A private dealer auction platform built for transparency, speed,
                            and trusted transactions across India.
                        </p>

                        {/* Social */}
                        <div className="flex gap-4 mt-6">
                            <a href="https://www.facebook.com/wellcardeals/" className="p-2 bg-white/10 rounded-xl hover:bg-accent hover:text-white transition-all">
                                <Facebook size={18} />
                            </a>
                            <a href="https://www.instagram.com/wellcardeals/" className="p-2 bg-white/10 rounded-xl hover:bg-accent hover:text-white transition-all">
                                <Instagram size={18} />
                            </a>
                        </div>
                    </div>

                    {/* QUICK LINKS */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 font-display">Quick Links</h3>
                        <ul className="space-y-3 text-sm">
                            {[
                                { name: "Home", path: "/" },
                                { name: "About", path: "/about" },
                                { name: "Services", path: "/services" },
                                { name: "Contact", path: "/contact" },
                            ].map((item, i) => (
                                <li key={i}>
                                    <Link
                                        to={item.path}
                                        className="hover:text-accent-400 transition"
                                    >
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* SERVICES */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 font-display">Services</h3>
                        <ul className="space-y-3 text-sm">
                            {[
                                "Dealer Onboarding",
                                "Vehicle Auctions",
                                "Secure Transactions",
                                "Analytics Dashboard",
                            ].map((item, i) => (
                                <li key={i} className="hover:text-accent-400 transition cursor-pointer">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CONTACT */}
                    <div>
                        <h3 className="text-white font-semibold mb-4 font-display">Contact</h3>

                        <div className="space-y-4 text-sm">

                            <a href="tel:+917289906245" className="flex items-center gap-3 hover:text-accent-400 transition">
                                <Phone size={16} />
                                <span>+91 xxxxxxxxxx</span>
                            </a>

                            <a href="mailto:wcd@wellcardeals.com" className="flex items-center gap-3 hover:text-accent-400 transition">
                                <Mail size={16} />
                                <span>wcd@wellcardeals.com</span>
                            </a>

                            <a
                                href="https://www.google.com/maps/search/?api=1&query=Mata%20Chanan%20Devi%20Hospital%2C%20C1%20Janakpuri%2C%20New%20Delhi"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-start gap-3 hover:text-accent-400 transition"
                            >
                                <MapPin size={16} />
                                <span>Mata Chanan Devi Hospital, C1 Janakpuri</span>
                            </a>

                        </div>
                    </div>

                </div>

                {/* DIVIDER */}
                <div className="border-t border-white/10 mt-16 pt-6 flex flex-col md:flex-row justify-between items-center text-sm text-navy-300">

                    <p>© {new Date().getFullYear()} WellCarDeals. All rights reserved.</p>

                    <div className="flex gap-6 mt-4 md:mt-0">
                        <Link to="/privacy-policy" className="hover:text-accent-400 cursor-pointer">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-accent-400 cursor-pointer">Terms of Service</Link>
                    </div>

                </div>

            </div>
        </footer>
    );
};

export default Footer;