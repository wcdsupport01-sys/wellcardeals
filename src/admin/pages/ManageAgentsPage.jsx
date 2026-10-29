import AdminRecordCollection from "../components/AdminRecordCollection";
import AdminDialog from "../components/AdminDialog";
import CredentialField from "../components/CredentialField";
import { useEffect, useState } from "react";
import { UserPlus, Loader2, AlertCircle, Copy, Check, X, KeyRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { inputClass } from "../components/FormSection";

const STATUS_STYLES = {
  approved: "bg-emerald-500/15 text-emerald-400",
  suspended: "bg-red-500/15 text-red-400",
  pending: "bg-amber-500/15 text-amber-400",
};

export default function ManageAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [credentials, setCredentials] = useState(null); // { agentCode, password, fullName }
  const [resettingId, setResettingId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "agent")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setAgents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    if (!fullName.trim()) {
      setCreateError("Name is required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-agent", {
        body: {
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          agentCode: agentCode.trim() || null,
          password: password.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCredentials(data);
      setFullName("");
      setPhone("");
      setAgentCode("");
      setPassword("");
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err.message || "Couldn't create agent.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(agent) {
    const nextStatus = agent.status === "approved" ? "suspended" : "approved";
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", agent.id);
    if (error) {
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a)));
  }

  async function handleResetPassword(agent) {
    if (!confirm(`Reset password for ${agent.full_name}? Their current password will stop working immediately.`)) {
      return;
    }
    setResettingId(agent.id);
    try {
      const { data, error } = await supabase.functions.invoke("reset-agent-password", {
        body: { agentId: agent.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.password || data.agentCode !== agent.agent_code) throw new Error("Password receipt could not be verified. Review the account before retrying.");
      setCredentials(data);
    } catch (err) {
      alert(err.message || "Couldn't reset password.");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Manage Agents</h1>
          <p className="text-sm text-zinc-400">
            Field agents who upload cars for approved Sell Requests. Set a custom Agent ID &amp; password, or leave blank to auto-generate.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black"
        >
          <UserPlus size={16} /> Add Agent
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-zinc-500">No agents yet.</p>
      ) : (
        <AdminRecordCollection rows={agents} kind="agent" searchable>
          {agents.map((a) => (
            <div
              key={a.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white truncate">{a.full_name}</p>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                    {a.agent_code}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[a.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">{a.phone || "No phone on file"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleResetPassword(a)}
                  disabled={resettingId === a.id}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-60"
                >
                  {resettingId === a.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <KeyRound size={13} />
                  )}
                  Reset Password
                </button>
                <button
                  onClick={() => toggleStatus(a)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                    a.status === "approved"
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                  }`}
                >
                  {a.status === "approved" ? "Suspend" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </AdminRecordCollection>
      )}

      {/* --- Add agent modal --- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Agent</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            {createError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-sm px-3 py-2">
                <AlertCircle size={15} /> {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                className={inputClass}
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
              <input
                className={inputClass}
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="Agent ID (optional)"
                  value={agentCode}
                  onChange={(e) => setAgentCode(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="Password (optional)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-zinc-500 -mt-1">
                Leave Agent ID / Password blank to auto-generate them instead.
              </p>
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-semibold py-2.5 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 size={16} className="animate-spin" />} Create Agent
              </button>
            </form>
          </div>
        </div>
      )}

      {credentials && <AdminDialog title="Agent login credentials" onClose={()=>setCredentials(null)}><p className="aw-muted">Copy the new credentials now and share them with {credentials.fullName}. Closing this window clears the password from the panel.</p><CredentialField label="Agent login ID" value={credentials.agentCode}/><CredentialField label="New password" value={credentials.password} secret/><button type="button" className="aw-button aw-primary" onClick={()=>setCredentials(null)}>Done</button></AdminDialog>}

    </div>
  );
}
