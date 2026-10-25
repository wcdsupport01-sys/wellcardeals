import { Navigate } from "react-router-dom";

// Keep existing auction links working while using one dealer auction desk.
// App.jsx protects this route for approved dealers.
export default function LiveAuctions() {
  return <Navigate to="/dealer/dashboard" replace />;
}
