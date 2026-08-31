import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import LiveAuctions from "./pages/LiveAuctions";
import RealCarDetail from "./pages/RealCarDetail";
import BuyCar from "./pages/BuyCar";
import SellCar from "./pages/SellCar";
import RCCheck from "./pages/RCCheck";
import ChallanCheck from "./pages/ChallanCheck";
import CarLoanEmi from "./pages/CarLoanEmi";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import AutoSignupPopup from "./components/AutoSignupPopup";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import Unauthorized from "./pages/Unauthorized";

import BuyerLogin from "./pages/buyer/BuyerLogin";
import BuyerSignup from "./pages/buyer/BuyerSignup";
import { ForgotPassword, ResetPassword } from "./pages/buyer/PasswordPages";
import BuyerLayout from "./pages/buyer/BuyerLayout";
import BuyerDashboard from "./pages/buyer/BuyerDashboard";
import MyListingsPage from "./pages/buyer/MyListingsPage";
import OrdersPage from "./pages/buyer/OrdersPage";
import SavedCarsPage from "./pages/buyer/SavedCarsPage";
import MessagesPage from "./pages/buyer/MessagesPage";
import ProfilePage from "./pages/buyer/ProfilePage";
import SettingsPage from "./pages/buyer/SettingsPage";
import HelpSupportPage from "./pages/buyer/HelpSupportPage";

import DealerLogin from "./pages/dealer/DealerLogin";
import DealerRegister from "./pages/dealer/DealerRegister";
import DealerPending from "./pages/dealer/DealerPending";
import DealerVerifyCode from "./pages/dealer/DealerVerifyCode";
import DealerLayout from "./pages/dealer/DealerLayout";
import DealerDashboard from "./pages/dealer/DealerDashboard";
import DealerProfilePage from "./pages/dealer/DealerProfilePage";

import AgentLogin from "./pages/agent/AgentLogin";
import AgentLayout from "./pages/agent/AgentLayout";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AgentUploadCarPage from "./pages/agent/AgentUploadCarPage";
import AgentAddCarPage from "./pages/agent/AgentAddCarPage";
import AgentProfilePage from "./pages/agent/AgentProfilePage";

import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import AddCarPage from "./admin/pages/AddCarPage";
import Dashboard from "./admin/pages/Dashboard";
import ManageLookupsPage from "./admin/pages/ManageLookupsPage";
import ManageDealersPage from "./admin/pages/ManageDealersPage";
import DealerApplicationsPage from "./admin/pages/DealerApplicationsPage";
import ManageAgentsPage from "./admin/pages/ManageAgentsPage";
import ManageUsersPage from "./admin/pages/ManageUsersPage";
import InventoryPage from "./admin/pages/InventoryPage";
import AuctionBidsPage from "./admin/pages/AuctionBidsPage";
import NegotiatePage from "./admin/pages/NegotiatePage";
import ManageBuyRequestsPage from "./admin/pages/ManageBuyRequestsPage";
import ManageAuctionRequestsPage from "./admin/pages/ManageAuctionRequestsPage";
import ManageAgentSubmissionsPage from "./admin/pages/ManageAgentSubmissionsPage";
import ManageEnquiriesPage from "./admin/pages/ManageEnquiriesPage";
import StaffOnly from "./auth/StaffOnly";

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

function PublicSite() {
  const { role, loading } = useAuth();

  // Still resolving the session — don't flash the public site for a
  // split second before we know this is actually an agent.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400">
        Loading...
      </div>
    );
  }

  // Agents only ever work inside their own panel. If they land here —
  // whether by typing a URL, clicking an old link, or hitting the
  // browser's Back/Forward button — send them straight back to the
  // agent dashboard instead of showing the buyer-facing website.
  if (role === "agent") {
    return <Navigate to="/agent/dashboard" replace />;
  }

  return (
    <>
      <Navbar />
      <AutoSignupPopup />
      {/* Padding for fixed navbar */}
      <div className="pt-20 md:pt-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buy-car" element={<BuyCar />} />
          <Route path="/sell-car" element={<SellCar />} />
          <Route path="/rc-check" element={<RCCheck />} />
          <Route path="/challan-check" element={<ChallanCheck />} />
          <Route path="/car-loan-emi" element={<CarLoanEmi />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          {/* Live Auction System = dealer bidding only. Buyers/guests are
              redirected to /dealer-login (this route isn't for them —
              buyers buy directly from a car's detail page instead). */}
          <Route
            path="/live-auctions"
            element={
              <ProtectedRoute allowedRoles={["dealer"]} loginPath="/dealer-login">
                <LiveAuctions />
              </ProtectedRoute>
            }
          />
          <Route path="/cars/:id" element={<RealCarDetail />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          {/* ---------------- Buyer auth ---------------- */}
          <Route path="/login" element={<BuyerLogin />} />
          <Route path="/signup" element={<BuyerSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ---------------- Buyer portal (isolated) ---------------- */}
          <Route
            path="/buyer"
            element={
              <ProtectedRoute allowedRoles={["buyer"]} loginPath="/login">
                <BuyerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BuyerDashboard />} />
            <Route path="my-listings" element={<MyListingsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="saved-cars" element={<SavedCarsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpSupportPage />} />
          </Route>

          {/* ---------------- Dealer auth ---------------- */}
          <Route path="/dealer-login" element={<DealerLogin />} />
          <Route path="/dealer-register" element={<DealerRegister />} />
          <Route path="/dealer/pending" element={<DealerPending />} />
          <Route path="/dealer/verify-code" element={<DealerVerifyCode />} />

          {/* ---------------- Dealer portal (isolated) ---------------- */}
          <Route
            path="/dealer"
            element={
              <ProtectedRoute allowedRoles={["dealer"]} loginPath="/dealer-login">
                <DealerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DealerDashboard />} />
            <Route path="profile" element={<DealerProfilePage />} />
          </Route>

          {/* ---------------- Agent auth (admin creates accounts, no signup) ---------------- */}
          <Route path="/agent-login" element={<AgentLogin />} />

          {/* ---------------- Agent portal (isolated) ---------------- */}
          <Route
            path="/agent"
            element={
              <ProtectedRoute allowedRoles={["agent"]} loginPath="/agent-login">
                <AgentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AgentDashboard />} />
            <Route path="upload/:requestId" element={<AgentUploadCarPage />} />
            <Route path="add-car" element={<AgentAddCarPage />} />
            <Route path="profile" element={<AgentProfilePage />} />
          </Route>

          {/* ---------------- Admin auth: hidden route, no signup ---------------- */}
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* ---------------- Admin portal (isolated, strict) ---------------- */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route
              path="add-car"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <AddCarPage />
                </StaffOnly>
              }
            />
            <Route
              path="bids"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <AuctionBidsPage />
                </StaffOnly>
              }
            />
            <Route
              path="negotiate"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <NegotiatePage />
                </StaffOnly>
              }
            />
            <Route
              path="dealers"
              element={
                <StaffOnly allow={["admin", "manager"]}>
                  <ManageDealersPage />
                </StaffOnly>
              }
            />
            <Route
              path="dealer-applications"
              element={
                <StaffOnly allow={["admin", "manager"]}>
                  <DealerApplicationsPage />
                </StaffOnly>
              }
            />
            <Route
              path="agents"
              element={
                <StaffOnly allow={["admin"]}>
                  <ManageAgentsPage />
                </StaffOnly>
              }
            />
            <Route
              path="users"
              element={
                <StaffOnly allow={["admin"]}>
                  <ManageUsersPage />
                </StaffOnly>
              }
            />
            <Route
              path="buy-requests"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <ManageBuyRequestsPage />
                </StaffOnly>
              }
            />
            <Route
              path="auction-requests"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <ManageAuctionRequestsPage />
                </StaffOnly>
              }
            />
            <Route
              path="agent-submissions"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <ManageAgentSubmissionsPage />
                </StaffOnly>
              }
            />
            <Route
              path="lookups"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <ManageLookupsPage />
                </StaffOnly>
              }
            />
            <Route
              path="enquiries"
              element={
                <StaffOnly allow={["admin", "manager", "team_lead"]}>
                  <ManageEnquiriesPage />
                </StaffOnly>
              }
            />
          </Route>

          {/* ---------------- Shared ---------------- */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ---------------- Public Buyer-facing site ---------------- */}
          <Route path="/*" element={<PublicSite />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
