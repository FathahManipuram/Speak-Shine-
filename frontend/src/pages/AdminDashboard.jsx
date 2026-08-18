import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import Modal from "../components/Modal.jsx";
import RoleSelector from "../components/RoleSelector.jsx";
import SubmissionControls from "../components/SubmissionControls.jsx";
import { useConfirm } from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import StreakBadge from "../components/StreakBadge.jsx";

const CATS = ["Daily Life","Opinion","Personal Experience","English Growth","Future Goals","Fun Topic","Free Talk"];
const PIE_COLORS = ["#7c6fff","#4ade80","#fbbf24","#ff6b9d","#38bdf8","#fb923c","#a78bfa"];
const tt = { background:"#16162a", border:"1px solid #252545", borderRadius:10, fontSize:12 };
const TABS = [{id:"overview",l:"📊 Overview"},{id:"today",l:"📅 Today"},{id:"users",l:"👥 Users"},{id:"registrations",l:"📋 Registrations"},{id:"reports",l:"📈 Reports"},{id:"points",l:"⭐ Points"},{id:"submissions",l:"📝 Submissions"},{id:"questions",l:"❓ Questions"},{id:"manual-questions",l:"📝 Manual Questions"},{id:"live",l:"🎥 Live Sessions"},{id:"payments",l:"💳 Payments"},{id:"whatsapp",l:"📱 WhatsApp"},{id:"monitoring",l:"🖥️ Monitor"},{id:"settings",l:"⚙️ Settings"}];

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const isAdminsTier = currentUser?.role === "admins"; // limited admin role
  const [tab, setTab] = useState("overview");
  const [dash, setDash] = useState(null);
  const [users, setUsers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [qForm, setQForm] = useState({ category:"", topic:"", question:"" });
  const [editQ, setEditQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);
  const [search, setSearch] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [qActionBusy, setQActionBusy] = useState(""); // "generating" | "cleaning" | ""
  const [qCat, setQCat] = useState("");
  const [modal, setModal] = useState(null);
  const [fineInput, setFineInput] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waSendingPoster, setWaSendingPoster] = useState(false);
  const [waSendingReport, setWaSendingReport] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState("all");
  const [settings, setSettings] = useState({
    posterSendTime: "08:00",
    questionGenerateTime: "07:00",
    submissionReportEnabled: true,
    submissionReportTimes: ["18:00", "21:00"],
    vocabWordCount: 5,
    vocabRequiredCount: 3,
    vocabNormalWordCount: 5,
    vocabNormalRequiredCount: 3,
    vocabStoryWordCount: 5,
    vocabStoryRequiredCount: 3,
    vocabPictureWordCount: 5,
    vocabPictureRequiredCount: 3,
    vocabLevel: "B2",
    storyWordCount: 200,
    storyLevel: "B1",
    allowPrivateVideos: true,
    storyDay: 6,
    pictureDescriptionDay: 4,
    paymentAmount: 5,
    durationDefaultMax: 300,
    durationDefaultFull: 300,
    durationStoryMax: 180,
    durationStoryFull: 180,
    durationWeeklyMax: 420,
    durationWeeklyFull: 300,
    durationMonthlyReflectionMax: 420,
    durationMonthlyReflectionFull: 420,
    durationMonthlyGoalsMax: 600,
    durationMonthlyGoalsFull: 420,
    durationPictureMax: 180,
    durationPictureFull: 180,
  });
  const [savingSection, setSavingSection] = useState(null); // null, "schedule", "vocab", "duration"
  const [resetting, setResetting] = useState("");
  const [publishQ, setPublishQ] = useState(null); // selected question for webapp publish
  const [publishCustom, setPublishCustom] = useState({ topic:"", question:"", category:"" }); // manual entry
  const [newMember, setNewMember] = useState({ name:"", phone:"", password:"", role:"user" });
  const [newMemberLoading, setNewMemberLoading] = useState(false);
  // Admin OTP verification state for adding members
  const [adminOtpStep, setAdminOtpStep] = useState("idle"); // "idle" | "sent" | "verified"
  const [adminOtp, setAdminOtp] = useState("");
  const [adminOtpLoading, setAdminOtpLoading] = useState(false);
  const [adminOtpError, setAdminOtpError] = useState("");
  const [adminActionToken, setAdminActionToken] = useState("");
  const [pendingRegs, setPendingRegs] = useState([]);
  const [pendingRegsLoading, setPendingRegsLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Lazy loading flags to track what's been loaded
  const [dataLoaded, setDataLoaded] = useState({
    dashboard: false,
    users: false,
    questions: false,
    reports: false,
    settings: false,
  });

  // Load only essential data on mount (dashboard overview)
  const loadInitial = async () => {
    setLoading(true);
    try {
      // Load dashboard + questions + weekly + users together for a complete overview
      const [d, q, w, u] = await Promise.all([
        api.get("/dashboard"),
        api.get("/questions?limit=200"),
        api.get("/dashboard/report/weekly"),
        api.get("/users"),
      ]);
      setDash(d.data);
      setDataLoaded(prev => ({ ...prev, dashboard: true }));
      if (q.data.questions) {
        setQuestions(q.data.questions);
        setDataLoaded(prev => ({ ...prev, questions: true }));
      }
      setWeekly(w.data);
      setUsers(u.data);
      setDataLoaded(prev => ({ ...prev, reports: true, users: true }));
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      try {
        const d = await api.get("/dashboard");
        setDash(d.data);
        setDataLoaded(prev => ({ ...prev, dashboard: true }));
      } catch {}
      msg(err?.response?.data?.error || "Failed to load dashboard", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Load users data (for Users, Today, Submissions tabs)
  const loadUsers = async () => {
    if (dataLoaded.users) return; // Already loaded
    try {
      const u = await api.get("/users");
      setUsers(u.data);
      setDataLoaded(prev => ({ ...prev, users: true }));
    } catch (err) {
      console.error("Failed to load users:", err);
      msg("Failed to load users", "danger");
    }
  };

  // Load questions data (for Questions tab)
  const loadQuestions = async () => {
    if (dataLoaded.questions) return; // Already loaded
    try {
      const q = await api.get("/questions?limit=50"); // Reduced from 200 to 50
      setQuestions(q.data.questions);
      setDataLoaded(prev => ({ ...prev, questions: true }));
    } catch (err) {
      console.error("Failed to load questions:", err);
      msg("Failed to load questions", "danger");
    }
  };

  // Force-refresh questions regardless of dataLoaded flag
  const refreshQuestions = async () => {
    try {
      const q = await api.get("/questions?limit=50");
      setQuestions(q.data.questions);
      setDataLoaded(prev => ({ ...prev, questions: true }));
    } catch (err) {
      console.error("Failed to refresh questions:", err);
      msg("Failed to refresh questions", "danger");
    }
  };

  // Load reports data (for Reports tab)
  const loadReports = async () => {
    if (dataLoaded.reports) return; // Already loaded
    try {
      const [w, m] = await Promise.all([
        api.get("/dashboard/report/weekly"),
        api.get("/dashboard/report/monthly"),
      ]);
      setWeekly(w.data);
      setMonthly(m.data);
      setDataLoaded(prev => ({ ...prev, reports: true }));
    } catch (err) {
      console.error("Failed to load reports:", err);
      msg("Failed to load reports", "danger");
    }
  };

  // Load pending registrations
  const loadPendingRegs = async () => {
    setPendingRegsLoading(true);
    try {
      const r = await api.get("/auth/pending");
      setPendingRegs(r.data);
    } catch (err) {
      msg("Failed to load pending registrations", "danger");
    } finally {
      setPendingRegsLoading(false);
    }
  };

  // Load payment transactions (for Payments tab)
  const loadPayments = async () => {
    setPaymentLoading(true);
    try {
      const r = await api.get("/payments/admin/all?limit=100");
      setPaymentData(r.data);
    } catch (err) {
      msg("Failed to load payment data", "danger");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Load settings data (for Settings tab)
  const loadSettings = async () => {
    if (dataLoaded.settings) return; // Already loaded
    try {
      const s = await api.get("/dashboard/settings");
      setSettings({
        posterSendTime: s.data.posterSendTime || "08:00",
        questionGenerateTime: s.data.questionGenerateTime || "07:00",
        submissionReportEnabled: s.data.submissionReportEnabled !== false,
        submissionReportTimes: Array.isArray(s.data.submissionReportTimes) && s.data.submissionReportTimes.length > 0
          ? s.data.submissionReportTimes
          : [s.data.submissionReportTime1 || "18:00", s.data.submissionReportTime2 || "21:00"].filter(Boolean),
        vocabWordCount: s.data.vocabWordCount ?? 5,
        vocabRequiredCount: s.data.vocabRequiredCount ?? 3,
        vocabNormalWordCount: s.data.vocabNormalWordCount ?? 5,
        vocabNormalRequiredCount: s.data.vocabNormalRequiredCount ?? 3,
        vocabStoryWordCount: s.data.vocabStoryWordCount ?? 5,
        vocabStoryRequiredCount: s.data.vocabStoryRequiredCount ?? 3,
        vocabPictureWordCount: s.data.vocabPictureWordCount ?? 5,
        vocabPictureRequiredCount: s.data.vocabPictureRequiredCount ?? 3,
        vocabLevel: s.data.vocabLevel || "B2",
        storyWordCount: s.data.storyWordCount ?? 200,
        storyLevel: s.data.storyLevel || "B1",
        allowPrivateVideos: s.data.allowPrivateVideos ?? true,
        storyDay: s.data.storyDay ?? 6,
        pictureDescriptionDay: s.data.pictureDescriptionDay ?? 4,
        paymentAmount: s.data.paymentAmount ?? 5,
        durationDefaultMax: s.data.durationDefaultMax ?? 300,
        durationDefaultFull: s.data.durationDefaultFull ?? 300,
        durationStoryMax: s.data.durationStoryMax ?? 180,
        durationStoryFull: s.data.durationStoryFull ?? 180,
        durationWeeklyMax: s.data.durationWeeklyMax ?? 420,
        durationWeeklyFull: s.data.durationWeeklyFull ?? 300,
        durationMonthlyReflectionMax: s.data.durationMonthlyReflectionMax ?? 420,
        durationMonthlyReflectionFull: s.data.durationMonthlyReflectionFull ?? 420,
        durationMonthlyGoalsMax: s.data.durationMonthlyGoalsMax ?? 600,
        durationMonthlyGoalsFull: s.data.durationMonthlyGoalsFull ?? 420,
        durationPictureMax:  s.data.durationPictureMax  ?? 180,
        durationPictureFull: s.data.durationPictureFull ?? 180,
      });
      setDataLoaded(prev => ({ ...prev, settings: true }));
    } catch (err) {
      console.error("Failed to load settings:", err);
      msg("Failed to load settings", "danger");
    }
  };

  const loadWhatsAppStatus = async () => {
    try {
      setWaLoading(true);
      const res = await api.get("/whatsapp/status");
      if (res.data?.success) {
        setWaStatus(res.data);
      }
    } catch (err) {
      console.warn("Failed to load WhatsApp status:", err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleSendPosterToGroup = async () => {
    try {
      setWaSendingPoster(true);
      const res = await api.post("/whatsapp/send-poster");
      if (res.data?.success) {
        msg("✅ Poster and caption sent to WhatsApp group successfully!", "success");
      }
    } catch (err) {
      msg(err.response?.data?.error || "Failed to send poster to WhatsApp group", "danger");
    } finally {
      setWaSendingPoster(false);
    }
  };

  const handleSendSubmissionReportToGroup = async () => {
    try {
      setWaSendingReport(true);
      const res = await api.post("/whatsapp/send-submission-report");
      if (res.data?.success) {
        msg(`✅ Submission report sent to group! (${res.data.submittedCount}/${res.data.totalPaid} paid students submitted)`, "success");
        loadWhatsAppStatus();
      }
    } catch (err) {
      msg(err.response?.data?.error || "Failed to send submission report to WhatsApp group", "danger");
    } finally {
      setWaSendingReport(false);
    }
  };

  const handleReconnectWhatsApp = async () => {
    try {
      await api.post("/whatsapp/reconnect");
      msg("🔄 Generating fresh WhatsApp QR code...", "info");
      loadWhatsAppStatus();
    } catch (err) {
      msg("Failed to trigger reconnect", "danger");
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm("Are you sure you want to disconnect WhatsApp and clear credentials?")) return;
    try {
      await api.post("/whatsapp/logout");
      msg("🚪 Disconnected from WhatsApp.", "info");
      loadWhatsAppStatus();
    } catch (err) {
      msg("Failed to log out from WhatsApp", "danger");
    }
  };

  // Load initial data on mount
  useEffect(() => {
    loadInitial();
    loadWhatsAppStatus();
  }, []);

  // Poll WhatsApp status while on WhatsApp tab or if QR scan needed
  useEffect(() => {
    if (tab === "whatsapp" || (!waStatus?.isConnected && tab === "today")) {
      loadWhatsAppStatus();
      const interval = setInterval(loadWhatsAppStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [tab, waStatus?.isConnected]);

  // Load data based on active tab
  useEffect(() => {
    if (tab === "overview") {
      // Overview needs dashboard data (already loaded)
    } else if (tab === "today" || tab === "users" || tab === "submissions" || tab === "points") {
      loadUsers();
    } else if (tab === "questions" || tab === "manual-questions") {
      loadQuestions();
    } else if (tab === "reports") {
      loadReports();
    } else if (tab === "registrations") {
      loadPendingRegs();
    } else if (tab === "payments") {
      loadPayments();
    } else if (tab === "settings") {
      loadSettings();
    } else if (tab === "whatsapp") {
      loadWhatsAppStatus();
    }
  }, [tab]);

  const msg = (text, type="success") => { setFlash({text,type}); setTimeout(()=>setFlash(null),3000); };
  
  // Smart reload - only reload what's currently visible/needed
  const reload = async (dataTypes = []) => {
    const promises = [];
    
    if (dataTypes.includes('dashboard') || dataTypes.length === 0) {
      promises.push(api.get("/dashboard").then(d => setDash(d.data)));
    }
    if (dataTypes.includes('users') || dataTypes.length === 0) {
      promises.push(api.get("/users").then(u => setUsers(u.data)));
    }
    if (dataTypes.includes('questions')) {
      promises.push(api.get("/questions?limit=50").then(q => setQuestions(q.data.questions)));
    }
    if (dataTypes.includes('reports')) {
      promises.push(
        Promise.all([
          api.get("/dashboard/report/weekly"),
          api.get("/dashboard/report/monthly"),
        ]).then(([w, m]) => {
          setWeekly(w.data);
          setMonthly(m.data);
        })
      );
    }
    
    if (promises.length > 0) {
      await Promise.all(promises).catch(err => {
        console.error("Reload failed:", err);
      });
    }
  };
  
  const toggleUser = async (phone) => { 
    await api.patch(`/users/${phone}/toggle`); 
    msg("Status toggled"); 
    reload(['users']); // Only reload users
  };
  
  const viewStudentDetail = (user) => {
    setSelectedStudent(user);
    setTab("student-detail");
  };

  const handleSubmissionUpdate = (type, newValue) => {
    if (!selectedStudent) return;
    // Update the selected student's submission count
    setSelectedStudent(prev => ({
      ...prev,
      [`${type}Submissions`]: newValue
    }));
    // Also update in the users list
    setUsers(prev => prev.map(u => 
      u.phone === selectedStudent.phone 
        ? { ...u, [`${type}Submissions`]: newValue }
        : u
    ));
  };

  const deleteUser = async (phone) => {
    setModal({
      type: "danger", title: "Remove User",
      message: "This user will be permanently removed. Are you sure?",
      confirmText: "Remove",
      onConfirm: async () => { 
        setModal(null); 
        await api.delete(`/users/${phone}`); 
        msg("Removed","danger"); 
        reload(['users', 'dashboard']); // Reload users and dashboard stats
      },
    });
  };
  const adjustFine = (phone, cur) => {
    setFineInput("0");
    setModal({
      type: "confirm", title: "Adjust Fine",
      message: `Current fine: ₹${cur}. Enter amount to add (negative to deduct):`,
      confirmText: "Apply",
      isFineInput: true,
      phone,
    });
  };
  const resetFine = async (phone) => {
    setModal({
      type: "danger", title: "Reset Fine",
      message: "Reset this user's fine to ₹0?",
      confirmText: "Reset",
      onConfirm: async () => {
        setModal(null);
        const u = users.find(x=>x.phone===phone);
        if (!u) return;
        await api.patch(`/users/${phone}/fine`,{amount:-(u.fine||0)});
        msg("Fine reset"); 
        reload(['users', 'dashboard']); // Reload users and dashboard stats
      },
    });
  };
  const saveQ = async (e) => { 
    e.preventDefault(); 
    if(editQ){
      await api.patch(`/questions/${editQ._id}`,qForm);
      setEditQ(null);
      msg("Updated!");
    }else{
      await api.post("/questions",qForm);
      msg("Added!");
    } 
    setQForm({category:"",topic:"",question:""}); 
    reload(['questions']); // Only reload questions
  };
  const deleteQ = async (id) => {
    setModal({
      type: "danger", title: "Delete Question",
      message: "This question will be permanently deleted.",
      confirmText: "Delete",
      onConfirm: async () => { 
        setModal(null); 
        await api.delete(`/questions/${id}`); 
        msg("Deleted","danger"); 
        reload(['questions']); // Only reload questions
      },
    });
  };
  const startEdit = (q) => { setEditQ(q); setQForm({category:q.category,topic:q.topic,question:q.question}); window.scrollTo({top:0,behavior:"smooth"}); };

  const saveSettings = async (e, section) => {
    e.preventDefault();
    setSavingSection(section);
    try {
      await api.patch("/dashboard/settings", settings);
      // Re-fetch fresh values to update state (bypasses 30s GET cache)
      const fresh = await api.get("/dashboard/settings?_t=" + Date.now());
      setSettings(s => ({
        ...s,
        posterSendTime: fresh.data.posterSendTime || "08:00",
        questionGenerateTime: fresh.data.questionGenerateTime || "07:00",
        submissionReportEnabled: fresh.data.submissionReportEnabled !== false,
        submissionReportTimes: Array.isArray(fresh.data.submissionReportTimes) && fresh.data.submissionReportTimes.length > 0
          ? fresh.data.submissionReportTimes
          : [fresh.data.submissionReportTime1 || "18:00", fresh.data.submissionReportTime2 || "21:00"].filter(Boolean),
        vocabWordCount: fresh.data.vocabWordCount ?? 5,
        vocabRequiredCount: fresh.data.vocabRequiredCount ?? 3,
        vocabNormalWordCount: fresh.data.vocabNormalWordCount ?? 5,
        vocabNormalRequiredCount: fresh.data.vocabNormalRequiredCount ?? 3,
        vocabStoryWordCount: fresh.data.vocabStoryWordCount ?? 5,
        vocabStoryRequiredCount: fresh.data.vocabStoryRequiredCount ?? 3,
        vocabPictureWordCount: fresh.data.vocabPictureWordCount ?? 5,
        vocabPictureRequiredCount: fresh.data.vocabPictureRequiredCount ?? 3,
        vocabLevel: fresh.data.vocabLevel || "B2",
        storyWordCount: fresh.data.storyWordCount ?? 200,
        storyLevel: fresh.data.storyLevel || "B1",
        storyDay: fresh.data.storyDay ?? 6,
        paymentAmount: fresh.data.paymentAmount ?? 5,
        durationDefaultMax: fresh.data.durationDefaultMax ?? 300,
        durationDefaultFull: fresh.data.durationDefaultFull ?? 300,
        durationStoryMax: fresh.data.durationStoryMax ?? 180,
        durationStoryFull: fresh.data.durationStoryFull ?? 180,
        durationWeeklyMax: fresh.data.durationWeeklyMax ?? 420,
        durationWeeklyFull: fresh.data.durationWeeklyFull ?? 300,
        durationMonthlyReflectionMax: fresh.data.durationMonthlyReflectionMax ?? 420,
        durationMonthlyReflectionFull: fresh.data.durationMonthlyReflectionFull ?? 420,
        durationMonthlyGoalsMax: fresh.data.durationMonthlyGoalsMax ?? 600,
        durationMonthlyGoalsFull: fresh.data.durationMonthlyGoalsFull ?? 420,
        durationPictureMax:  fresh.data.durationPictureMax  ?? 180,
        durationPictureFull: fresh.data.durationPictureFull ?? 180,
      }));
      msg("Settings saved!");
    } catch (err) {
      msg(err?.response?.data?.error || "Failed to save settings", "danger");
    } finally {
      setSavingSection(null);
    }
  };

  const resetWeekly = () => {
    setModal({
      type: "danger", title: "Reset Weekly Submissions",
      message: "This will reset ALL users' weekly submission count to 0. Continue?",
      confirmText: "Reset Weekly",
      onConfirm: async () => {
        setModal(null);
        setResetting("weekly");
        try {
          await api.post("/users/reset/weekly");
          msg("Weekly submissions reset for all users");
          reload(['users', 'dashboard', 'reports']); // Reload affected data
        } catch (err) {
          msg(err?.response?.data?.error || "Reset failed", "danger");
        } finally { setResetting(""); }
      },
    });
  };

  const resetMonthly = () => {
    setModal({
      type: "danger", title: "Reset Monthly Submissions",
      message: "This will reset ALL users' monthly submission count to 0. Are you sure?",
      confirmText: "Reset Monthly",
      onConfirm: async () => {
        setModal(null);
        setResetting("monthly");
        try {
          await api.post("/users/reset/monthly");
          msg("Monthly submissions reset for all users");
          reload(['users', 'dashboard', 'reports']); // Reload affected data
        } catch (err) {
          msg(err?.response?.data?.error || "Reset failed", "danger");
        } finally { setResetting(""); }
      },
    });
  };

  const filteredUsers = useMemo(()=>users.filter(u=>{const s=search.toLowerCase();return(u.registeredName||u.name||"").toLowerCase().includes(s)||(u.phone||"").includes(s)}),[users,search]);
  const filteredQ = useMemo(()=>questions.filter(q=>(qCat?q.category===qCat:true)&&(q.question.toLowerCase().includes(qSearch.toLowerCase())||q.topic.toLowerCase().includes(qSearch.toLowerCase()))),[questions,qSearch,qCat]);

  const pieSub = [{name:"Submitted",value:dash?.stats?.completed||0,color:"#4ade80"},{name:"Pending",value:dash?.stats?.pending||0,color:"#f87171"}];
  const catCount = questions.reduce((a,q)=>{a[q.category]=(a[q.category]||0)+1;return a},{});
  const catPie = Object.entries(catCount).map(([name,value])=>({name,value}));
  const fineBar = [...users].filter(u=>(u.fine||0)>0).sort((a,b)=>(b.fine||0)-(a.fine||0)).slice(0,10).map(u=>({name:(u.registeredName||u.name||"?").slice(0,8),fine:u.fine||0}));

  if (loading) return <Layout title="Admin Dashboard"><div className="spinner-wrap"><div className="spinner"/></div></Layout>;

  return (
    <Layout title="Admin Dashboard">
      {modal && (
        <Modal
          type={modal.type}
          title={modal.title}
          message={
            modal.isFineInput ? (
              <div>
                <p style={{ marginBottom: "0.75rem", color: "var(--muted)", fontSize: "0.9rem" }}>{modal.message}</p>
                <input
                  className="form-input"
                  type="number"
                  value={fineInput}
                  onChange={e => setFineInput(e.target.value)}
                  style={{ textAlign: "center", fontSize: "1.1rem" }}
                  autoFocus
                />
              </div>
            ) : modal.message
          }
          confirmText={modal.confirmText}
          onConfirm={modal.isFineInput ? async () => {
            if (isNaN(+fineInput)) return;
            setModal(null);
            await api.patch(`/users/${modal.phone}/fine`, { amount: +fineInput });
            msg(`Fine adjusted ₹${fineInput}`); 
            reload(['users', 'dashboard']); // Reload users and dashboard stats
          } : modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {flash && <div className={`flash ${flash.type}`}>{flash.text}</div>}

      <div className="stat-grid">
        <StatCard icon="👥" label="Total Users"     value={dash?.stats?.total||0}     color="#7c6fff"/>
        <StatCard icon="✅" label="Submitted Today" value={dash?.stats?.completed||0} color="#4ade80"/>
        <StatCard icon="❌" label="Pending Today"   value={dash?.stats?.pending||0}   color="#f87171"/>
        <StatCard icon="🧊" label="Streak Freezes"  value={users.reduce((s,u)=>s+(u.streakFreeze||0),0)} color="#38bdf8"/>
      </div>

      <div className="tab-bar">
        {TABS.map(t=><button key={t.id} className={`tab-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
        {selectedStudent&&<button className={`tab-btn${tab==="student-detail"?" active":""}`} onClick={()=>setTab("student-detail")}>👤 {(selectedStudent.registeredName||selectedStudent.name||"").slice(0,12)}</button>}
      </div>

      {/* OVERVIEW */}
      {tab==="overview" && (
        <>
          {/* ── Today's question banner ── */}
          {dash?.today?.question ? (
            <div style={{
              background: "linear-gradient(135deg, rgba(124,111,255,0.12), rgba(79,70,229,0.06))",
              border: "1px solid rgba(124,111,255,0.25)",
              borderRadius: 16, padding: "1rem 1.25rem",
              marginBottom: "1rem",
              display: "flex", alignItems: "flex-start", gap: "0.75rem",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: "rgba(124,111,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem",
              }}>📌</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>
                  Today's Question · {dash.today.category || dash.today.topic || "General"}
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.45 }}>
                  {dash.today.question}
                </div>
              </div>
              <div style={{
                flexShrink: 0, fontSize: "0.72rem", fontWeight: 700,
                padding: "0.25rem 0.65rem", borderRadius: 20,
                background: "rgba(74,222,128,0.15)", color: "#4ade80",
                border: "1px solid rgba(74,222,128,0.3)",
              }}>✅ Live</div>
            </div>
          ) : (
            <div style={{
              background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 16, padding: "0.85rem 1.25rem",
              marginBottom: "1rem", fontSize: "0.85rem", color: "#fbbf24",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              ⏳ No question published yet today
            </div>
          )}

          {/* ── Row 1: Submission donut + Streak leaderboard ── */}
          <div className="grid-cols-2" style={{ marginBottom: "1rem" }}>

            {/* Submission donut — redesigned */}
            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="section-title" style={{ marginBottom: "0.5rem" }}>📊 Today's Submissions</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieSub} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3} startAngle={90} endAngle={-270}>
                        {pieSub.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                      {dash?.stats?.total ? Math.round((dash.stats.completed / dash.stats.total) * 100) : 0}%
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "var(--muted)", fontWeight: 600 }}>done</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {[
                    { label: "Submitted", value: dash?.stats?.completed || 0, color: "#4ade80" },
                    { label: "Pending",   value: dash?.stats?.pending   || 0, color: "#f87171" },
                    { label: "Total",     value: dash?.stats?.total     || 0, color: "#7c6fff" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)", flex: 1 }}>{label}</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color }}>{value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: "0.25rem" }}>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: "linear-gradient(90deg, #4ade80, #22c55e)",
                        width: `${dash?.stats?.total ? (dash.stats.completed / dash.stats.total) * 100 : 0}%`,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak leaderboard — redesigned */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: "0.75rem" }}>🏆 Top Streaks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {(dash?.topStreak || []).map((u, i) => {
                  const medals = ["🥇","🥈","🥉"];
                  const pct = dash.topStreak[0]?.streak ? Math.round((u.streak / dash.topStreak[0].streak) * 100) : 0;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      background: i === 0 ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.02)",
                      borderRadius: 10,
                      border: i === 0 ? "1px solid rgba(251,191,36,0.15)" : "1px solid transparent",
                    }}>
                      <span style={{ fontSize: i < 3 ? "1.1rem" : "0.8rem", fontWeight: 700, color: "var(--muted)", width: 24, textAlign: "center", flexShrink: 0 }}>
                        {medals[i] || `${i+1}`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {u.name || u.userId?.split("@")[0]} {u.currentBadge && <StreakBadge badge={u.currentBadge} compact />}
                        </div>
                        <div style={{ height: 3, background: "var(--border)", borderRadius: 99, marginTop: "0.3rem", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#7c6fff", width: `${pct}%` }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f97316" }}>🔥 {u.streak}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)", background: "var(--bg-secondary)", padding: "0.15rem 0.4rem", borderRadius: 6 }}>{u.weeklySubmissions}/7</span>
                      </div>
                    </div>
                  );
                })}
                {(!dash?.topStreak || dash.topStreak.length === 0) && (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.82rem", padding: "1rem" }}>No streak data yet</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Row 2: Weekly bar + Fine bar + Category pie ── */}
          <div className="grid-cols-3" style={{ gap: "1rem" }}>

            {/* Weekly submissions bar */}
            <div className="card">
              <div className="section-title">📅 Weekly Submissions</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekly.slice(0,8).map(u=>({name:(u.name||"?").slice(0,6),days:u.weeklySubmissions||0}))} margin={{top:4,right:4,left:-20,bottom:20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" stroke="#55557a" fontSize={9} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0}/>
                  <YAxis domain={[0,7]} stroke="#55557a" fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={tt} cursor={{fill:"rgba(124,111,255,0.06)"}}/>
                  <Bar dataKey="days" radius={[6,6,0,0]}>
                    {weekly.slice(0,8).map((u,i)=>(
                      <Cell key={i} fill={(u.weeklySubmissions||0)>=5?"#4ade80":(u.weeklySubmissions||0)>=3?"#7c6fff":"#f87171"}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pending Submissions */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div className="section-title" style={{ margin: 0 }}>⏳ Pending Today</div>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 700,
                  padding: "0.15rem 0.5rem", borderRadius: 20,
                  background: "rgba(248,113,113,0.12)",
                  color: "#f87171",
                }}>
                  {users.filter(u => !u.completed).length} left
                </span>
              </div>
              {users.filter(u => !u.completed).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.82rem", padding: "1.5rem 0" }}>
                  🎉 Everyone submitted today!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 200, overflowY: "auto" }}>
                  {users.filter(u => !u.completed).map((u, i) => (
                    <div key={u.userId || u.phone} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.35rem 0.5rem", borderRadius: 8,
                      background: "rgba(248,113,113,0.05)",
                      border: "1px solid rgba(248,113,113,0.1)",
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(248,113,113,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700, color: "#f87171",
                      }}>
                        {(u.registeredName || u.name || "?")[0]?.toUpperCase()}
                      </div>
                      <span style={{
                        flex: 1, fontSize: "0.78rem", color: "var(--text)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        minWidth: 0,
                      }}>
                        {u.registeredName || u.name || u.phone}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#f97316", flexShrink: 0 }}>
                        🔥{u.streak || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Questions by category */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div className="section-title" style={{ margin: 0 }}>❓ Question Bank</div>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 700,
                  padding: "0.15rem 0.5rem", borderRadius: 20,
                  background: questions.length <= 7 ? "rgba(248,113,113,0.15)" : questions.length <= 14 ? "rgba(251,191,36,0.15)" : "rgba(74,222,128,0.15)",
                  color: questions.length <= 7 ? "#f87171" : questions.length <= 14 ? "#fbbf24" : "#4ade80",
                }}>
                  {questions.length} total
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {CATS.map((cat, i) => {
                  const count = questions.filter(q => q.category === cat).length;
                  const maxCat = Math.max(...CATS.map(c => questions.filter(q => q.category === c).length), 1);
                  const pct = Math.round((count / maxCat) * 100);
                  const color = count === 0 ? "#f87171" : count <= 1 ? "#fbbf24" : PIE_COLORS[i % PIE_COLORS.length];
                  return (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: "0.72rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                      <div style={{ width: 50, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 99, background: color, width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color, width: 16, textAlign: "right", flexShrink: 0 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* TODAY */}
      {tab==="today" && (
        <>
          {dash?.today?.question
            ? <div className="today-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div className="today-label">📌 Today's Question</div>
                    <div className="today-q">{dash.today.question}</div>
                    {dash.today.topic && <span className="today-topic">{dash.today.topic}</span>}
                  </div>
                  <button
                    className="btn-sm btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    onClick={waStatus?.isConnected ? handleSendPosterToGroup : () => setTab("whatsapp")}
                    disabled={waSendingPoster}
                  >
                    {waSendingPoster ? "⏳ Sending..." : waStatus?.isConnected ? "🚀 Send Poster to WhatsApp Group" : "📱 Connect WhatsApp to Send Poster"}
                  </button>
                </div>
              </div>
            : <div className="warn-box"><p>⏳ No question set for today yet.</p></div>}

          {/* Publish question to webapp */}
          <div className="card" style={{marginBottom:"1rem"}}>
            <div className="section-title">📢 Publish Question to Webapp</div>
            <p style={{color:"var(--muted)",fontSize:"0.85rem",marginBottom:"1rem"}}>Set today's question so all webapp users can see and submit their video.</p>

            {/* Pick from bank */}
            <div style={{marginBottom:"1rem"}}>
              <label className="form-label">Pick from Question Bank</label>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                <select className="form-input" style={{flex:1,minWidth:200}}
                  value={publishQ?._id||""}
                  onChange={e=>{
                    const q=questions.find(x=>x._id===e.target.value);
                    setPublishQ(q||null);
                    if(q) setPublishCustom({topic:q.topic,question:q.question,category:q.category});
                  }}>
                  <option value="">— Select a question —</option>
                  {questions.map(q=>(
                    <option key={q._id} value={q._id}>[{q.category}] {q.topic}: {q.question.slice(0,55)}…</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Or type manually */}
            <div style={{marginBottom:"1rem"}}>
              <label className="form-label">Or Enter Manually</label>
              <input className="form-input" style={{marginBottom:"0.5rem"}} placeholder="Topic (e.g. Future Goals)"
                value={publishCustom.topic} onChange={e=>{ setPublishQ(null); setPublishCustom(p=>({...p,topic:e.target.value})); }}/>
              <textarea className="form-input" rows={2} placeholder="Question text…"
                style={{resize:"vertical"}}
                value={publishCustom.question} onChange={e=>{ setPublishQ(null); setPublishCustom(p=>({...p,question:e.target.value})); }}/>
            </div>

            {/* Preview */}
            {publishCustom.question && (
              <div style={{padding:"0.75rem",background:"var(--bg-secondary)",borderRadius:8,fontSize:"0.9rem",marginBottom:"1rem",border:"1px solid var(--border)"}}>
                <div style={{color:"var(--muted)",fontSize:"0.75rem",marginBottom:"0.25rem"}}>Preview:</div>
                <strong>{publishCustom.topic}</strong>{publishCustom.topic?" — ":""}{publishCustom.question}
              </div>
            )}

            <button className="btn-primary" onClick={async()=>{
              if(!publishCustom.question.trim()){msg("Enter or select a question first","danger");return;}
              try{
                await api.patch("/dashboard/today-question",{
                  topic:publishCustom.topic,
                  question:publishCustom.question,
                  category:publishCustom.category||"General"
                });
                msg("✅ Question published! Users can now see it.");
                setPublishQ(null);
                setPublishCustom({topic:"",question:"",category:""});
                reload(['dashboard']); // Reload dashboard to show new question
              }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
            }}>📢 Publish to Webapp</button>
          </div>

          <div className="card">
            <div className="section-title">Submission Status</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Phone</th><th>Streak</th><th>Status</th><th>🧊 Freeze</th><th>⭐ Score</th></tr></thead>
                <tbody>{users.map(u=>(
                  <tr key={u.userId}>
                    <td style={{fontWeight:500}}>{u.registeredName||u.name||"—"}</td>
                    <td style={{color:"var(--muted)"}}>{u.phone}</td>
                    <td>🔥 {u.streak||0}</td>
                    <td><span style={{color:u.completed?"var(--success)":"var(--danger)",fontWeight:600}}>{u.completed?"✅ Submitted":"⏳ Pending"}</span></td>
                    <td style={{color:"#38bdf8",fontWeight:600}}>🧊 {u.streakFreeze||0}</td>
                    <td style={{color:"#a78bfa",fontWeight:600}}>⭐ {u.monthlyScore||0}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* USERS */}
      {tab==="users" && (
        <>
          {/* Add Member — requires admin OTP verification first */}
          <div className="card" style={{marginBottom:"1rem"}}>
            <div className="section-title">➕ Add New Member</div>

            {/* Step 1: Admin identity verification */}
            {adminOtpStep === "idle" && (
              <div>
                <p style={{color:"var(--muted)",fontSize:"0.85rem",marginBottom:"1rem"}}>
                  To add a member, first verify your identity via OTP sent to your registered phone.
                </p>
                {adminOtpError && (
                  <div style={{color:"#f87171",fontSize:"0.82rem",marginBottom:"0.75rem"}}>❌ {adminOtpError}</div>
                )}
                <button className="btn-primary" disabled={adminOtpLoading} onClick={async()=>{
                  setAdminOtpLoading(true); setAdminOtpError("");
                  try {
                    await api.post("/users/admin-send-otp");
                    setAdminOtpStep("sent");
                  } catch(e) {
                    setAdminOtpError(e?.response?.data?.error || "Failed to send OTP");
                  } finally { setAdminOtpLoading(false); }
                }}>
                  {adminOtpLoading ? "Sending…" : "🔐 Verify My Identity (Send OTP)"}
                </button>
              </div>
            )}

            {/* Step 2: Enter OTP */}
            {adminOtpStep === "sent" && (
              <div>
                <p style={{color:"var(--muted)",fontSize:"0.85rem",marginBottom:"1rem"}}>
                  Enter the 6-digit OTP sent to your registered phone number.
                </p>
                {adminOtpError && (
                  <div style={{color:"#f87171",fontSize:"0.82rem",marginBottom:"0.75rem"}}>❌ {adminOtpError}</div>
                )}
                <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
                  <input className="form-input" style={{width:160,letterSpacing:"0.2em",textAlign:"center",fontSize:"1.1rem"}}
                    type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                    value={adminOtp} onChange={e=>setAdminOtp(e.target.value.replace(/\D/g,"").slice(0,6))}/>
                  <button className="btn-primary" disabled={adminOtpLoading||adminOtp.length!==6} onClick={async()=>{
                    setAdminOtpLoading(true); setAdminOtpError("");
                    try {
                      const {data} = await api.post("/users/admin-verify-otp",{otp:adminOtp});
                      setAdminActionToken(data.actionToken);
                      setAdminOtpStep("verified");
                      setAdminOtp("");
                    } catch(e) {
                      setAdminOtpError(e?.response?.data?.error || "Invalid OTP");
                      setAdminOtp("");
                    } finally { setAdminOtpLoading(false); }
                  }}>
                    {adminOtpLoading ? "Verifying…" : "Verify OTP"}
                  </button>
                  <button className="btn-ghost" onClick={()=>{setAdminOtpStep("idle");setAdminOtp("");setAdminOtpError("");}}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Add member form (identity verified) */}
            {adminOtpStep === "verified" && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setNewMemberLoading(true);
                try {
                  await api.post("/users/admin-create", { ...newMember, actionToken: adminActionToken });
                  msg(`✅ Account created for ${newMember.name}`);
                  setNewMember({ name:"", phone:"", password:"", role:"user" });
                  setAdminOtpStep("idle");
                  setAdminActionToken("");
                  reload(['users', 'dashboard']); // Reload users and dashboard stats
                } catch (err) {
                  const errMsg = err?.response?.data?.error || "Failed to create account";
                  // If token expired, reset to idle
                  if (errMsg.includes("expired") || errMsg.includes("token")) {
                    setAdminOtpStep("idle");
                    setAdminActionToken("");
                    msg("Session expired. Please re-verify your identity.", "danger");
                  } else {
                    msg(errMsg, "danger");
                  }
                } finally {
                  setNewMemberLoading(false);
                }
              }}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem",color:"#4ade80",fontSize:"0.85rem"}}>
                  ✅ Identity verified — you can now add a member
                  <button type="button" className="btn-ghost" style={{fontSize:"0.75rem",padding:"0.2rem 0.5rem"}}
                    onClick={()=>{setAdminOtpStep("idle");setAdminActionToken("");}}>
                    Re-verify
                  </button>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" placeholder="Member name" value={newMember.name}
                      onChange={e=>setNewMember(p=>({...p,name:e.target.value}))} required minLength={2}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone (10 digits)</label>
                    <input className="form-input" placeholder="9876543210" type="tel" value={newMember.phone}
                      onChange={e=>setNewMember(p=>({...p,phone:e.target.value}))} required maxLength={13}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" placeholder="Min 8 chars, upper+lower+number+symbol" type="password" value={newMember.password}
                      onChange={e=>setNewMember(p=>({...p,password:e.target.value}))} required minLength={8}/>
                    <div style={{fontSize:"0.72rem",color:"var(--muted)",marginTop:"0.3rem"}}>
                      Must contain: uppercase, lowercase, number, special character (!@#$%^&*)
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-input" value={newMember.role}
                      onChange={e=>setNewMember(p=>({...p,role:e.target.value}))}>
                      <option value="user">User</option>
                      <option value="trainer">Trainer</option>
                      <option value="viewer">Viewer (read-only)</option>
                      {!isAdminsTier && <option value="admins">Admins</option>}
                      {!isAdminsTier && <option value="admin">Admin</option>}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={newMemberLoading}>
                  {newMemberLoading ? "Creating…" : "Create Account"}
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
              <div className="section-title" style={{margin:0}}>All Users ({filteredUsers.length})</div>
              <input className="form-input" style={{width:220}} placeholder="Search name or phone…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Streak</th><th>🧊 Freeze</th><th>Weekly</th><th>Monthly</th><th>⭐ Score</th><th>Status</th><th>💳 Paid</th><th>Actions</th></tr></thead>
              <tbody>{filteredUsers.map(u=>(
                <tr key={u.userId}>
                  <td style={{fontWeight:500,whiteSpace:"nowrap"}}>{u.registeredName||u.name||"—"}</td>
                  <td style={{color:"var(--muted)"}}>{u.phone}</td>
                  <td>
                    <RoleSelector 
                      phone={u.phone} 
                      currentRole={u.role || "user"}
                      onRoleChange={() => reload(['users'])} // Only reload users
                    />
                  </td>
                  <td>🔥 {u.streak||0}</td>
                  <td style={{color:"#38bdf8",fontWeight:600}}>🧊 {u.streakFreeze||0}</td>
                  <td>{u.weeklySubmissions||0}/7</td>
                  <td>{u.monthlySubmissions||0}</td>
                  <td style={{color:"#a78bfa",fontWeight:600}}>⭐ {u.monthlyScore||0}</td>
                  <td><span style={{color:u.isActive?"var(--success)":"var(--danger)",fontSize:"0.8rem"}}>{u.isActive?"Active":"Disabled"}</span></td>
                  <td>
                    <button
                      onClick={async()=>{
                        try {
                          const {data} = await api.patch(`/payments/admin/toggle-paid/${encodeURIComponent(u.phone)}`);
                          setUsers(prev => prev.map(x => x.phone===u.phone ? {...x, paid: data.paid, paidAt: data.paidAt} : x));
                          msg(`${u.registeredName||u.name||u.phone} marked as ${data.paid?"✅ Paid":"❌ Unpaid"}`);
                        } catch(e) { msg(e?.response?.data?.error||"Failed","danger"); }
                      }}
                      style={{
                        background: u.paid ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.12)",
                        color: u.paid ? "#4ade80" : "#f87171",
                        border: `1px solid ${u.paid ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.3)"}`,
                        borderRadius: 8,
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.paid ? "✅ Paid" : "❌ Unpaid"}
                    </button>
                  </td>
                  <td style={{whiteSpace:"nowrap"}}>
                    <button className="btn-ghost" style={{marginRight:3}} onClick={()=>viewStudentDetail(u)}>View</button>
                    <button className="btn-ghost" style={{marginRight:3}} onClick={()=>toggleUser(u.phone)}>{u.isActive?"Disable":"Enable"}</button>
                    <button className="btn-ghost" style={{marginRight:3}} onClick={async()=>{
                      try {
                        await api.post(`/video/admin/reset-limit/${u._id || u.userId}`);
                        msg(`Upload limit reset for ${u.registeredName||u.name||u.phone}`);
                      } catch(e) { msg(e?.response?.data?.error||"Reset failed","danger"); }
                    }}>🔄 Limit</button>
                    <button className="btn-ghost danger" onClick={()=>deleteUser(u.phone)}>Remove</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* REPORTS */}
      {tab==="reports" && (
        <>
          <div style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",flexWrap:"wrap"}}>
            <button className="btn-ghost danger" onClick={resetWeekly} disabled={resetting==="weekly"} style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
              {resetting==="weekly" ? "Resetting…" : "🔄 Reset Weekly Submissions"}
            </button>
            <button className="btn-ghost danger" onClick={resetMonthly} disabled={resetting==="monthly"} style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
              {resetting==="monthly" ? "Resetting…" : "🔄 Reset Monthly Submissions"}
            </button>
          </div>
          <div className="card" style={{marginBottom:"1rem"}}>
            <div className="section-title">📅 Weekly Report</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekly.slice(0,15).map(u=>({name:(u.name||"?").slice(0,8),days:u.weeklySubmissions||0,streak:u.streak||0}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252545"/>
                <XAxis dataKey="name" stroke="#8888aa" fontSize={11}/>
                <YAxis domain={[0,7]} stroke="#8888aa" fontSize={11}/>
                <Tooltip contentStyle={tt}/><Legend/>
                <Bar dataKey="days" name="Days" fill="#7c6fff" radius={[4,4,0,0]}/>
                <Bar dataKey="streak" name="Streak" fill="#fbbf24" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="table-wrap" style={{marginTop:"1rem"}}>
              <table className="data-table">
                <thead><tr><th>#</th><th>Name</th><th>Days</th><th>Streak</th><th>🧊 Freeze</th><th>⭐ Score</th></tr></thead>
                <tbody>{weekly.map((u,i)=>(
                  <tr key={i}>
                    <td style={{color:"var(--muted)"}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{u.name||u.userId?.split("@")[0]}</td>
                    <td style={{color:(u.weeklySubmissions||0)>=7?"var(--success)":(u.weeklySubmissions||0)>=4?"var(--warning)":"var(--danger)",fontWeight:600}}>{u.weeklySubmissions||0}/7</td>
                    <td>🔥 {u.streak||0}</td>
                    <td style={{color:"#38bdf8",fontWeight:600}}>🧊 {u.streakFreeze||0}</td>
                    <td style={{color:"#a78bfa",fontWeight:600}}>⭐ {u.monthlyScore||0}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="section-title">📆 Monthly Report</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Name</th><th>Monthly</th><th>Streak</th><th>🧊 Freeze</th><th>⭐ Score</th></tr></thead>
                <tbody>{monthly.map((u,i)=>(
                  <tr key={i}>
                    <td style={{color:"var(--muted)"}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{u.name||u.userId?.split("@")[0]}</td>
                    <td>{u.monthlySubmissions||0}</td>
                    <td>🔥 {u.streak||0}</td>
                    <td style={{color:"#38bdf8",fontWeight:600}}>🧊 {u.streakFreeze||0}</td>
                    <td style={{color:"#a78bfa",fontWeight:600}}>⭐ {u.monthlyScore||0}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* POINTS & FREEZE */}
      {tab==="points" && (
        <>
          <div className="stat-grid" style={{marginBottom:"1rem"}}>
            <StatCard icon="⭐" label="Top Monthly Score"  value={users.length ? Math.max(...users.map(u=>u.monthlyScore||0)) : 0}                        color="#a78bfa"/>
            <StatCard icon="🧊" label="Total Freezes Held" value={users.reduce((s,u)=>s+(u.streakFreeze||0),0)}                                           color="#38bdf8"/>
            <StatCard icon="🔥" label="Longest Streak"     value={users.length ? Math.max(...users.map(u=>u.streak||0)) : 0}                               color="#f97316"/>
            <StatCard icon="🏆" label="Scored This Month"  value={users.filter(u=>(u.monthlyScore||0)>0).length}                                           color="#4ade80"/>
          </div>

          {/* Top scores bar chart */}
          {users.filter(u=>(u.monthlyScore||0)>0).length > 0 && (
            <div className="card" style={{marginBottom:"1rem"}}>
              <div className="section-title">⭐ Top Monthly Scores</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...users].sort((a,b)=>(b.monthlyScore||0)-(a.monthlyScore||0)).slice(0,10).map(u=>({name:(u.registeredName||u.name||"?").slice(0,10),score:u.monthlyScore||0,freeze:u.streakFreeze||0}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252545"/>
                  <XAxis dataKey="name" stroke="#8888aa" fontSize={11}/>
                  <YAxis stroke="#8888aa" fontSize={11}/>
                  <Tooltip contentStyle={tt}/>
                  <Legend/>
                  <Bar dataKey="score" name="Monthly Score" fill="#a78bfa" radius={[4,4,0,0]}/>
                  <Bar dataKey="freeze" name="Streak Freeze" fill="#38bdf8" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div className="section-title">⭐ Points & Streak Freeze Ledger</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>🔥 Streak</th><th>🧊 Freeze</th><th>⭐ Monthly Score</th><th>📅 Submissions</th></tr></thead>
                <tbody>{[...users].sort((a,b)=>(b.monthlyScore||0)-(a.monthlyScore||0)).map((u,i)=>(
                  <tr key={u.userId||i}>
                    <td style={{color:"var(--muted)",fontWeight:600}}>{i+1}</td>
                    <td style={{fontWeight:500}}>{u.registeredName||u.name||"—"}</td>
                    <td style={{color:"var(--muted)",fontSize:"0.82rem"}}>{u.phone}</td>
                    <td style={{color:"#f97316",fontWeight:600}}>🔥 {u.streak||0}</td>
                    <td style={{color:"#38bdf8",fontWeight:700,fontSize:"1rem"}}>
                      {(u.streakFreeze||0) > 0
                        ? <span>🧊 {u.streakFreeze}</span>
                        : <span style={{color:"var(--muted)"}}>—</span>}
                    </td>
                    <td style={{fontWeight:700}}>
                      <span style={{
                        color: (u.monthlyScore||0)>=80?"#4ade80":(u.monthlyScore||0)>=50?"#a78bfa":"var(--text)",
                        background: (u.monthlyScore||0)>=80?"rgba(74,222,128,0.1)":(u.monthlyScore||0)>=50?"rgba(167,139,250,0.1)":"transparent",
                        padding:"0.15rem 0.5rem",borderRadius:6,
                      }}>⭐ {u.monthlyScore||0}</span>
                    </td>
                    <td style={{color:"var(--muted)",fontSize:"0.85rem"}}>{u.monthlySubmissions||0} this month</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* QUESTIONS */}
      {tab==="questions" && (
        <>
          {/* Low stock warning + Generate Now */}
          {questions.length <= 14 && (
            <div style={{
              background: questions.length <= 7 ? "rgba(248,113,113,0.08)" : "rgba(251,191,36,0.08)",
              border: `1px solid ${questions.length <= 7 ? "rgba(248,113,113,0.3)" : "rgba(251,191,36,0.3)"}`,
              borderRadius: 12, padding: "0.85rem 1.1rem",
              marginBottom: "1rem",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap",
            }}>
              <div>
                <span style={{ fontWeight: 700, color: questions.length <= 7 ? "#f87171" : "#fbbf24", fontSize: "0.9rem" }}>
                  {questions.length <= 7 ? "⚠️ Question bank is critically low!" : "ℹ️ Question bank is running low"}
                </span>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.2rem" }}>
                  {questions.length} question{questions.length !== 1 ? "s" : ""} remaining — auto-generate runs at the scheduled time, or generate now.
                </div>
              </div>
              <button
                className="btn-primary"
                style={{ whiteSpace: "nowrap", fontSize: "0.85rem", padding: "0.5rem 1rem", opacity: qActionBusy ? 0.6 : 1 }}
                disabled={!!qActionBusy}
                onClick={async () => {
                  setQActionBusy("generating");
                  msg("🤖 Generating questions… please wait (30–60s)");
                  try {
                    const res = await api.post("/questions/generate-now", { count: 14 }, { timeout: 95000 });
                    await refreshQuestions();
                    setQActionBusy("");
                    msg(`✅ ${res.data.message}`);
                  } catch (e) {
                    setQActionBusy("");
                    await refreshQuestions(); // still refresh — some may have been inserted
                    if (e?.code === "ECONNABORTED" || e?.message?.includes("timeout")) {
                      msg("⚠️ Request timed out — questions may still be generating. Check the bank in a moment.", "danger");
                    } else {
                      msg(e?.response?.data?.error || "Generation failed", "danger");
                    }
                  }
                }}
              >
                {qActionBusy === "generating" ? "⏳ Generating…" : "🤖 Generate Now"}
              </button>
            </div>
          )}

          <div className="card" style={{marginBottom:"1rem"}}>
            <div className="section-title">{editQ?"✏️ Edit Question":"➕ Add Question"}</div>
            <form onSubmit={saveQ}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={qForm.category} onChange={e=>setQForm({...qForm,category:e.target.value})} required>
                    <option value="">Select category</option>
                    {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Topic</label>
                  <input className="form-input" placeholder="e.g. Morning routines" value={qForm.topic} onChange={e=>setQForm({...qForm,topic:e.target.value})} required/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Question</label>
                <textarea className="form-input" style={{resize:"vertical",minHeight:80}} placeholder="Write the question…" value={qForm.question} onChange={e=>setQForm({...qForm,question:e.target.value})} required/>
              </div>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <button type="submit" className="btn-primary">{editQ?"Update":"Add Question"}</button>
                {editQ && <button type="button" className="btn-ghost" onClick={()=>{setEditQ(null);setQForm({category:"",topic:"",question:""});}}>Cancel</button>}
              </div>
            </form>
          </div>
          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="section-title" style={{margin:0}}>Question Bank ({filteredQ.length}/{questions.length})</div>
                {/* Generate button */}
                <button
                  className="btn-ghost"
                  style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", opacity: qActionBusy ? 0.6 : 1 }}
                  disabled={!!qActionBusy}
                  onClick={async () => {
                    setQActionBusy("generating");
                    msg("🤖 Generating questions… please wait (30–60s)");
                    try {
                      const res = await api.post("/questions/generate-now", { count: 14 }, { timeout: 95000 });
                      await refreshQuestions();
                      setQActionBusy("");
                      msg(`✅ ${res.data.message}`);
                    } catch (e) {
                      setQActionBusy("");
                      await refreshQuestions(); // still refresh — some may have been inserted
                      if (e?.code === "ECONNABORTED" || e?.message?.includes("timeout")) {
                        msg("⚠️ Request timed out — questions may still be generating. Check the bank in a moment.", "danger");
                      } else {
                        msg(e?.response?.data?.error || "Generation failed", "danger");
                      }
                    }
                  }}
                >
                  {qActionBusy === "generating" ? "⏳ Generating…" : "🤖 Generate"}
                </button>

                {/* Clean Generic button */}
                <button
                  className="btn-ghost danger"
                  style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", opacity: qActionBusy ? 0.6 : 1 }}
                  disabled={!!qActionBusy}
                  onClick={async () => {
                    setQActionBusy("cleaning");
                    try {
                      const res = await api.post("/questions/clean-generic");
                      await refreshQuestions();
                      setQActionBusy("");
                      if (res.data.deleted === 0) {
                        msg("✅ Bank is clean — no generic questions found");
                      } else {
                        msg(`🗑️ Removed ${res.data.deleted} generic question${res.data.deleted !== 1 ? "s" : ""}. Bank refreshed.`, "danger");
                      }
                    } catch (e) {
                      setQActionBusy("");
                      msg(e?.response?.data?.error || "Clean failed", "danger");
                    }
                  }}
                >
                  {qActionBusy === "cleaning" ? "⏳ Cleaning…" : "🗑️ Clean Generic"}
                </button>
              </div>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                <select className="form-input" style={{width:"auto"}} value={qCat} onChange={e=>setQCat(e.target.value)}>
                  <option value="">All Categories</option>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <input className="form-input" style={{width:180}} placeholder="Search…" value={qSearch} onChange={e=>setQSearch(e.target.value)}/>
              </div>
            </div>

            {/* Category balance bars */}
            {(() => {
              const maxCount = Math.max(...CATS.map(c => questions.filter(q => q.category === c).length), 1);
              return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  background: "var(--bg-secondary)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                }}>
                  {CATS.map(cat => {
                    const count = questions.filter(q => q.category === cat).length;
                    const pct = Math.round((count / maxCount) * 100);
                    const color = count === 0 ? "#f87171" : count <= 1 ? "#fbbf24" : "#4ade80";
                    return (
                      <div key={cat} style={{ fontSize: "0.72rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                          <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{cat}</span>
                          <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{count}</span>
                        </div>
                        <div style={{ height: 4, background: "var(--border)", borderRadius: 99 }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            width: `${pct}%`,
                            background: color,
                            transition: "width 0.4s ease",
                            minWidth: count > 0 ? 4 : 0,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Category</th><th>Topic</th><th>Question</th><th>Actions</th></tr></thead>
                <tbody>{filteredQ.map(q=>(
                  <tr key={q._id}>
                    <td><span className="badge badge-purple">{q.category}</span></td>
                    <td style={{color:"var(--muted)",whiteSpace:"nowrap"}}>{q.topic}</td>
                    <td style={{maxWidth:320}}>{q.question}</td>
                    <td style={{whiteSpace:"nowrap"}}>
                      <button className="btn-ghost" style={{marginRight:3}} onClick={()=>startEdit(q)}>Edit</button>
                      <button className="btn-ghost danger" onClick={()=>deleteQ(q._id)}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SUBMISSIONS */}
      {tab==="submissions" && (
        <>
          <div className="stat-grid" style={{marginBottom:"1rem"}}>
            <StatCard icon="✅" label="Submitted Today" value={users.filter(u=>u.completed).length} color="#4ade80"/>
            <StatCard icon="⏳" label="Not Submitted"   value={users.filter(u=>!u.completed).length} color="#f87171"/>
            <StatCard icon="👥" label="Total Students"  value={users.length} color="#7c6fff"/>
          </div>

          <div className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
              <div className="section-title" style={{margin:0}}>Student Submissions</div>
              <input className="form-input" style={{width:220}} placeholder="Search name or phone…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Today</th>
                    <th>Streak</th>
                    <th>Weekly</th>
                    <th>Monthly</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u=>(
                    <tr key={u.userId}>
                      <td style={{fontWeight:500}}>{u.registeredName||u.name||"—"}</td>
                      <td style={{color:"var(--muted)"}}>{u.phone}</td>
                      <td>
                        <span style={{
                          padding:"0.25rem 0.65rem",
                          borderRadius:20,
                          fontSize:"0.75rem",
                          fontWeight:600,
                          background:u.completed?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",
                          color:u.completed?"#4ade80":"#f87171"
                        }}>
                          {u.completed?"✅":"⏳"}
                        </span>
                      </td>
                      <td>🔥 {u.streak||0}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                          <span style={{minWidth:35}}>{u.weeklySubmissions||0}/7</span>
                          <div style={{display:"flex",gap:"0.25rem"}}>
                            <button
                              className="btn-ghost"
                              style={{padding:"0.2rem 0.4rem",fontSize:"0.75rem",minWidth:28}}
                              onClick={async()=>{
                                try{
                                  const res=await api.patch(`/submissions/${u.phone}/weekly`,{delta:-1});
                                  setUsers(prev=>prev.map(user=>user.phone===u.phone?{...user,weeklySubmissions:res.data.weeklySubmissions}:user));
                                }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
                              }}
                              disabled={(u.weeklySubmissions||0)===0}
                            >−</button>
                            <button
                              className="btn-ghost"
                              style={{padding:"0.2rem 0.4rem",fontSize:"0.75rem",minWidth:28}}
                              onClick={async()=>{
                                try{
                                  const res=await api.patch(`/submissions/${u.phone}/weekly`,{delta:1});
                                  setUsers(prev=>prev.map(user=>user.phone===u.phone?{...user,weeklySubmissions:res.data.weeklySubmissions}:user));
                                }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
                              }}
                            >+</button>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                          <span style={{minWidth:25}}>{u.monthlySubmissions||0}</span>
                          <div style={{display:"flex",gap:"0.25rem"}}>
                            <button
                              className="btn-ghost"
                              style={{padding:"0.2rem 0.4rem",fontSize:"0.75rem",minWidth:28}}
                              onClick={async()=>{
                                try{
                                  const res=await api.patch(`/submissions/${u.phone}/monthly`,{delta:-1});
                                  setUsers(prev=>prev.map(user=>user.phone===u.phone?{...user,monthlySubmissions:res.data.monthlySubmissions}:user));
                                }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
                              }}
                              disabled={(u.monthlySubmissions||0)===0}
                            >−</button>
                            <button
                              className="btn-ghost"
                              style={{padding:"0.2rem 0.4rem",fontSize:"0.75rem",minWidth:28}}
                              onClick={async()=>{
                                try{
                                  const res=await api.patch(`/submissions/${u.phone}/monthly`,{delta:1});
                                  setUsers(prev=>prev.map(user=>user.phone===u.phone?{...user,monthlySubmissions:res.data.monthlySubmissions}:user));
                                }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
                              }}
                            >+</button>
                          </div>
                        </div>
                      </td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <button
                          className="btn-ghost"
                          style={{
                            marginRight:4,
                            fontSize:"0.78rem",
                            color: u.completed ? "#4ade80" : "#f87171",
                            borderColor: u.completed ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
                          }}
                          onClick={async()=>{
                            try{
                              const res = await api.patch(`/users/${u.phone}/toggle-submitted`);
                              setUsers(prev=>prev.map(user=>user.phone===u.phone?{...user,completed:res.data.completed}:user));
                              msg(res.data.completed?"Marked as submitted":"Marked as not submitted");
                            }catch(e){msg(e?.response?.data?.error||"Failed","danger");}
                          }}
                        >
                          {u.completed ? "✅ Submitted" : "⏳ Not Submitted"}
                        </button>
                        <button className="btn-ghost" onClick={()=>viewStudentDetail(u)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* PAYMENTS */}
      {tab==="payments" && (
        <>
          {paymentLoading ? (
            <div className="spinner-wrap"><div className="spinner"/></div>
          ) : paymentData ? (
            <>
              {/* Stats row */}
              <div className="stat-grid" style={{marginBottom:"1rem"}}>
                <div className="card" style={{textAlign:"center"}}>
                  <div style={{fontSize:"1.8rem",fontWeight:900,color:"#4ade80"}}>₹{paymentData.stats?.totalRevenue||0}</div>
                  <div style={{fontSize:"0.75rem",color:"var(--muted)",marginTop:"0.25rem"}}>Total Revenue</div>
                </div>
                <div className="card" style={{textAlign:"center"}}>
                  <div style={{fontSize:"1.8rem",fontWeight:900,color:"#7c6fff"}}>{paymentData.stats?.totalPaid||0}</div>
                  <div style={{fontSize:"0.75rem",color:"var(--muted)",marginTop:"0.25rem"}}>Paid Users</div>
                </div>
                <div className="card" style={{textAlign:"center"}}>
                  <div style={{fontSize:"1.8rem",fontWeight:900,color:"#fbbf24"}}>{paymentData.stats?.totalManual||0}</div>
                  <div style={{fontSize:"0.75rem",color:"var(--muted)",marginTop:"0.25rem"}}>Manual Activations</div>
                </div>
                <div className="card" style={{textAlign:"center"}}>
                  <div style={{fontSize:"1.8rem",fontWeight:900,color:"#38bdf8"}}>{paymentData.pagination?.total||0}</div>
                  <div style={{fontSize:"0.75rem",color:"var(--muted)",marginTop:"0.25rem"}}>Total Transactions</div>
                </div>
              </div>

              {/* Transactions table */}
              <div className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
                  <div className="section-title" style={{margin:0}}>💳 All Transactions</div>
                  <button className="btn-ghost" onClick={loadPayments} style={{fontSize:"0.8rem"}}>🔄 Refresh</button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Name / Phone</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Source</th>
                        <th>Payment ID</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentData.transactions||[]).map((tx,i)=>(
                        <tr key={tx._id||i}>
                          <td style={{color:"var(--muted)",whiteSpace:"nowrap",fontSize:"0.8rem"}}>
                            {new Date(tx.createdAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                          </td>
                          <td>
                            <div style={{fontWeight:600,fontSize:"0.85rem"}}>{tx.name||"—"}</div>
                            <div style={{color:"var(--muted)",fontSize:"0.75rem"}}>{tx.phone}</div>
                          </td>
                          <td style={{fontWeight:700,color:"#4ade80"}}>{tx.amount>0?`₹${tx.amount}`:"—"}</td>
                          <td>
                            <span style={{
                              background: tx.status==="success"?"rgba(74,222,128,0.12)":tx.status==="manual"?"rgba(251,191,36,0.12)":"rgba(248,113,113,0.12)",
                              color: tx.status==="success"?"#4ade80":tx.status==="manual"?"#fbbf24":"#f87171",
                              border: `1px solid ${tx.status==="success"?"rgba(74,222,128,0.3)":tx.status==="manual"?"rgba(251,191,36,0.3)":"rgba(248,113,113,0.3)"}`,
                              borderRadius:8,padding:"0.2rem 0.6rem",fontSize:"0.72rem",fontWeight:700,
                            }}>
                              {tx.status==="success"?"✅ Success":tx.status==="manual"?"🔧 Manual":tx.status==="refunded"?"↩️ Refunded":"❌ Failed"}
                            </span>
                          </td>
                          <td style={{fontSize:"0.8rem",color:"var(--muted)"}}>{tx.source==="admin"?"👤 Admin":"💳 Razorpay"}</td>
                          <td style={{fontFamily:"monospace",fontSize:"0.75rem",color:"var(--muted)"}}>
                            {tx.razorpayPaymentId?tx.razorpayPaymentId.slice(-12):"—"}
                          </td>
                          <td style={{fontSize:"0.78rem",color:"var(--muted)"}}>{tx.note||"—"}</td>
                        </tr>
                      ))}
                      {(paymentData.transactions||[]).length===0&&(
                        <tr><td colSpan={7} style={{textAlign:"center",color:"var(--muted)",padding:"2rem"}}>No transactions yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="warn-box"><p>Failed to load payment data. <button className="btn-ghost" onClick={loadPayments}>Retry</button></p></div>
          )}
        </>
      )}

      {/* MONITORING */}
      {tab==="monitoring" && <MonitoringPanel />}

      {/* REGISTRATIONS */}
      {tab==="registrations" && (
        <div className="card">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
            <div className="section-title" style={{ margin:0 }}>📋 Pending Registrations</div>
            <button className="btn-ghost" style={{ fontSize:"0.8rem" }} onClick={loadPendingRegs} disabled={pendingRegsLoading}>
              {pendingRegsLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {pendingRegsLoading && <div style={{ textAlign:"center", color:"var(--muted)", padding:"2rem" }}>Loading…</div>}

          {!pendingRegsLoading && pendingRegs.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--muted)", padding:"2rem" }}>
              <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>✅</div>
              No pending registrations
            </div>
          )}

          {!pendingRegsLoading && pendingRegs.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
              {pendingRegs.map(p => {
                const hoursLeft = Math.max(0, Math.round((new Date(p.expiresAt) - Date.now()) / 3600000));
                const urgent = hoursLeft < 4;
                return (
                  <div key={p.id} style={{
                    display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap",
                    background: urgent ? "rgba(248,113,113,0.06)" : "var(--bg2)",
                    border: `1px solid ${urgent ? "rgba(248,113,113,0.25)" : "var(--border)"}`,
                    borderRadius:12, padding:"0.85rem 1rem",
                  }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:"rgba(124,111,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", fontWeight:700, color:"#a78bfa", flexShrink:0 }}>
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:"0.9rem", color:"var(--text)" }}>{p.name}</div>
                      <div style={{ fontSize:"0.75rem", color:"var(--muted)" }}>📱 {p.phone}</div>
                      <div style={{ fontSize:"0.68rem", color: urgent ? "#f87171" : "var(--muted)", marginTop:"0.15rem" }}>
                        {urgent ? "⚠️" : "⏳"} Expires in {hoursLeft}h · {new Date(p.createdAt).toLocaleString("en-IN", { dateStyle:"short", timeStyle:"short" })}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:"0.5rem", flexShrink:0 }}>
                      <button
                        className="btn-primary"
                        style={{ fontSize:"0.8rem", padding:"0.4rem 0.9rem", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#065f46" }}
                        onClick={async () => {
                          try {
                            await api.post(`/auth/pending/${p.id}/approve`);
                            msg(`✅ ${p.name} approved — they can now log in`);
                            loadPendingRegs();
                          } catch (e) { msg(e.response?.data?.error || "Approve failed", "danger"); }
                        }}
                      >✅ Approve</button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize:"0.8rem", padding:"0.4rem 0.9rem", color:"#f87171", borderColor:"rgba(248,113,113,0.3)" }}
                        onClick={async () => {
                          try {
                            await api.delete(`/auth/pending/${p.id}`);
                            msg(`Rejected ${p.name}`, "danger");
                            loadPendingRegs();
                          } catch (e) { msg(e.response?.data?.error || "Reject failed", "danger"); }
                        }}
                      >❌ Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WHATSAPP TAB */}
      {tab === "whatsapp" && (
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Card 1: Connection & QR Code Scanner */}
          <div className="card" style={{ flex: "1 1 480px", maxWidth: 540, margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div className="section-title" style={{ margin: 0 }}>📱 WhatsApp Scanner &amp; Connection</div>
              <button 
                className="btn-sm btn-ghost" 
                onClick={loadWhatsAppStatus} 
                disabled={waLoading}
                title="Refresh Status"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Status Banner */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.85rem 1.1rem",
              borderRadius: 12,
              background: waStatus?.isConnected ? "rgba(34, 197, 94, 0.12)" : waStatus?.hasSavedCredentials ? "rgba(56, 189, 248, 0.12)" : "rgba(234, 179, 8, 0.12)",
              border: `1px solid ${waStatus?.isConnected ? "rgba(34, 197, 94, 0.35)" : waStatus?.hasSavedCredentials ? "rgba(56, 189, 248, 0.35)" : "rgba(234, 179, 8, 0.35)"}`,
              marginBottom: "1.5rem",
            }}>
              <span style={{ fontSize: "1.4rem" }}>{waStatus?.isConnected ? "🟢" : waStatus?.hasSavedCredentials ? "🔵" : "🟡"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: waStatus?.isConnected ? "#4ade80" : waStatus?.hasSavedCredentials ? "#38bdf8" : "#fbbf24" }}>
                  {waStatus?.isConnected
                    ? `Connected as ${waStatus.userPhone}`
                    : waStatus?.hasSavedCredentials
                    ? `Reconnecting Session (${waStatus.userPhone})...`
                    : waStatus?.qrCodeDataUrl
                    ? "QR Code Ready — Scan with WhatsApp"
                    : "Connecting to WhatsApp..."}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  {waStatus?.isConnected
                    ? "Linked to your WhatsApp number. Daily posters will be sent to the group from this number."
                    : waStatus?.hasSavedCredentials
                    ? "Saved session authenticated. Socket is establishing live connection..."
                    : "Open WhatsApp on your phone > Linked Devices > Link a Device to scan"}
                </div>
              </div>
            </div>

            {/* Middle panel */}
            {waStatus?.isConnected ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(34, 197, 94, 0.05)",
                padding: "2rem 1.5rem",
                borderRadius: 16,
                border: "1px solid rgba(34, 197, 94, 0.2)",
                marginBottom: "1.5rem",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📱✨</div>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: "1.1rem", marginBottom: "0.3rem" }}>
                  WhatsApp Linked: {waStatus.userPhone}
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", maxWidth: 360, margin: 0 }}>
                  Ready to send daily question posters directly to your target group.
                </p>
              </div>
            ) : waStatus?.hasSavedCredentials && !waStatus?.qrCodeDataUrl ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(56, 189, 248, 0.05)",
                padding: "2rem 1.5rem",
                borderRadius: 16,
                border: "1px solid rgba(56, 189, 248, 0.2)",
                marginBottom: "1.5rem",
                textAlign: "center"
              }}>
                <div className="spinner" style={{ margin: "0 auto 1rem" }}></div>
                <div style={{ fontWeight: 600, color: "#fff", marginBottom: "0.4rem" }}>
                  Reconnecting to {waStatus.userPhone}...
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", maxWidth: 360, margin: 0 }}>
                  Your phone is already linked. Syncing socket with WhatsApp servers...
                </p>
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(15, 10, 30, 0.7)",
                padding: "1.5rem",
                borderRadius: 16,
                border: "1px dashed rgba(167, 139, 250, 0.4)",
                marginBottom: "1.5rem",
                textAlign: "center"
              }}>
                {waStatus?.qrCodeDataUrl ? (
                  <>
                    <div style={{
                      padding: "12px",
                      background: "#ffffff",
                      borderRadius: 16,
                      boxShadow: "0 8px 32px rgba(124, 111, 255, 0.3)",
                      display: "inline-block",
                      marginBottom: "1rem"
                    }}>
                      <img
                        src={waStatus.qrCodeDataUrl}
                        alt="WhatsApp QR Code"
                        style={{ width: 240, height: 240, display: "block" }}
                      />
                    </div>
                    <div style={{ fontWeight: 600, color: "#fff", marginBottom: "0.4rem" }}>
                      Scan this QR code with WhatsApp
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem", maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
                      1. Open WhatsApp on your phone<br/>
                      2. Tap <strong>Settings</strong> (iOS) or <strong>⋮ Menu</strong> (Android)<br/>
                      3. Select <strong>Linked Devices</strong> → <strong>Link a Device</strong><br/>
                      4. Point camera at this screen
                    </p>
                  </>
                ) : (
                  <div style={{ padding: "2rem 1rem", color: "var(--muted)" }}>
                    <div className="spinner" style={{ margin: "0 auto 1rem" }}></div>
                    <div>Generating fresh WhatsApp QR code...</div>
                  </div>
                )}
              </div>
            )}

            {/* Connection Actions */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button 
                className="btn-secondary" 
                onClick={handleReconnectWhatsApp}
                style={{ flex: 1 }}
              >
                🔄 {waStatus?.hasSavedCredentials ? "Reconnect Socket" : "Refresh QR"}
              </button>
              {(waStatus?.isConnected || waStatus?.hasSavedCredentials) && (
                <button 
                  className="btn-danger" 
                  onClick={handleLogoutWhatsApp}
                >
                  🚪 Disconnect &amp; Unlink
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Group Dispatch & Today's Question Poster */}
          <div className="card" style={{ flex: "1 1 480px", maxWidth: 540, margin: 0 }}>
            <div className="section-title">📤 Target WhatsApp Group &amp; Poster Dispatch</div>

            {/* Target Group Info */}
            <div style={{
              padding: "1rem",
              borderRadius: 12,
              background: "rgba(124, 111, 255, 0.08)",
              border: "1px solid rgba(124, 111, 255, 0.2)",
              marginBottom: "1.25rem",
            }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                CONFIGURED TARGET GROUP JID
              </div>
              <div style={{
                fontFamily: "monospace",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: waStatus?.targetGroup ? "#a78bfa" : "#ef4444",
                wordBreak: "break-all"
              }}>
                {waStatus?.targetGroup || "⚠️ TARGET_GROUP not set"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                Auto-sends every morning at <strong style={{ color: "var(--accent)" }}>{settings?.posterSendTime || "08:00"} IST</strong>
              </div>
            </div>

            {/* Today's Question / Task Preview */}
            <div style={{
              padding: "1rem",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: "1.5rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.4rem" }}>
                <span style={{
                  fontSize: "0.74rem",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: waStatus?.todayQuestion?.contentType === "picture_description"
                    ? "rgba(56, 189, 248, 0.2)"
                    : waStatus?.todayQuestion?.contentType === "story_audio"
                    ? "rgba(167, 139, 250, 0.2)"
                    : "rgba(124, 111, 255, 0.2)",
                  color: waStatus?.todayQuestion?.contentType === "picture_description"
                    ? "#38bdf8"
                    : waStatus?.todayQuestion?.contentType === "story_audio"
                    ? "#a78bfa"
                    : "#c084fc",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase"
                }}>
                  {waStatus?.todayQuestion?.contentType === "picture_description"
                    ? "🖼️ Picture Description"
                    : waStatus?.todayQuestion?.contentType === "story_audio"
                    ? "🎧 Story Summary"
                    : "💬 Speaking Question"}
                </span>

                {waStatus?.todayQuestion?.category && (
                  <span style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#e2e8f0",
                    fontWeight: 600
                  }}>
                    {waStatus.todayQuestion.category}
                  </span>
                )}
              </div>

              {/* Picture thumbnail if picture challenge */}
              {waStatus?.todayQuestion?.imageUrl && (
                <div style={{ marginBottom: "0.75rem", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", maxHeight: 180 }}>
                  <img
                    src={waStatus.todayQuestion.imageUrl}
                    alt="Challenge Photo"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              )}

              {/* Audio badge if story challenge */}
              {waStatus?.todayQuestion?.audioUrl && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: 8,
                  background: "rgba(167, 139, 250, 0.12)",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                  marginBottom: "0.75rem",
                  fontSize: "0.8rem",
                  color: "#c084fc",
                  fontWeight: 600
                }}>
                  🎵 Audio Story Attached (will be sent as voice/audio to group)
                </div>
              )}

              <div style={{ fontWeight: 700, color: "#fff", fontSize: "1.05rem", marginBottom: "0.35rem" }}>
                {waStatus?.todayQuestion?.topic || dash?.today?.topic || "Speaking Practice"}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                {waStatus?.todayQuestion?.imageInstructions || waStatus?.todayQuestion?.question || dash?.today?.question || "No daily challenge published yet."}
              </div>
            </div>

            {/* Send Button */}
            <button
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.9rem",
                fontSize: "1rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              disabled={!waStatus?.isConnected || waSendingPoster}
              onClick={handleSendPosterToGroup}
            >
              {waSendingPoster
                ? "⏳ Sending to WhatsApp Group..."
                : waStatus?.todayQuestion?.contentType === "picture_description"
                ? "🚀 Send Picture Challenge to Group Now"
                : waStatus?.todayQuestion?.contentType === "story_audio"
                ? "🚀 Send Story & Audio to Group Now"
                : "🚀 Send Today's Poster to Group Now"}
            </button>

            {/* Submission Status Report to Group */}
            <div style={{
              marginTop: "1.5rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  📊 Daily Submission Status Report
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 6, background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", fontWeight: 700 }}>
                    ✅ {waStatus?.submissionSummary?.submittedCount ?? 0} Submitted
                  </span>
                  <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 6, background: "rgba(248, 113, 113, 0.15)", color: "#f87171", fontWeight: 700 }}>
                    ⏳ {waStatus?.submissionSummary?.pendingCount ?? 0} Pending
                  </span>
                  <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 6, background: "rgba(124, 111, 255, 0.15)", color: "#a78bfa", fontWeight: 700 }}>
                    👥 {waStatus?.submissionSummary?.totalPaid ?? 0} Paid Students
                  </span>
                </div>
              </div>

              <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 1rem", lineHeight: 1.45 }}>
                Send a formatted WhatsApp message to your group listing all <strong>Submitted Paid Students</strong> (with streaks) and <strong>Pending Paid Students</strong> who still need to submit today.
              </p>

              <button
                className="btn-secondary"
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  border: "1px solid rgba(124, 111, 255, 0.4)",
                  background: "rgba(124, 111, 255, 0.12)",
                  color: "#c084fc",
                }}
                disabled={!waStatus?.isConnected || waSendingReport}
                onClick={handleSendSubmissionReportToGroup}
              >
                {waSendingReport ? "⏳ Sending Submission Report..." : "📊 Send Submission Report to WhatsApp Group Now"}
              </button>
            </div>

            {!waStatus?.isConnected && (
              <div style={{ color: "#fbbf24", fontSize: "0.8rem", marginTop: "0.6rem", textAlign: "center" }}>
                ⚠️ Connect your WhatsApp number above to enable sending.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab==="settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
          
          {/* Settings Header & Category Nav */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "1.25rem 1.5rem",
            background: "var(--card-bg, rgba(22, 18, 45, 0.7))",
            borderRadius: 16,
            border: "1px solid var(--border, rgba(124, 111, 255, 0.2))",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  ⚙️ Admin System Settings
                </h2>
                <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Manage WhatsApp automation, speaking duration limits, vocabulary rules, pricing, and system resets.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                <span>🕒 Server Timezone: <strong style={{ color: "var(--accent)" }}>IST (UTC+5:30)</strong></span>
              </div>
            </div>

            {/* Segmented Filter Pills */}
            <div style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              paddingTop: "0.75rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}>
              {[
                { id: "all", label: "🌐 All Settings" },
                { id: "schedules", label: "⏰ Bot & Schedules" },
                { id: "duration", label: "⏱️ Video Duration" },
                { id: "vocab", label: "📚 Vocabulary & Tasks" },
                { id: "pricing", label: "💳 Pricing & Privacy" },
                { id: "resets", label: "⚠️ System Resets" },
              ].map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSettingsSubTab(sub.id)}
                  style={{
                    padding: "0.45rem 0.9rem",
                    borderRadius: 20,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    border: settingsSubTab === sub.id ? "1px solid #7c6fff" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: settingsSubTab === sub.id ? "rgba(124, 111, 255, 0.22)" : "rgba(255, 255, 255, 0.04)",
                    color: settingsSubTab === sub.id ? "#c084fc" : "var(--muted)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: BOT SCHEDULES & AUTOMATION */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(settingsSubTab === "all" || settingsSubTab === "schedules") && (
            <div className="card" style={{ margin: 0, padding: "1.5rem", borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <div className="section-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                    ⏰ Bot Automation &amp; Schedules
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.83rem", margin: "0.25rem 0 0" }}>
                    Configure automated daily dispatches and submission reports to your WhatsApp group (IST, 24-hour format).
                  </p>
                </div>
                <div style={{ fontSize: "0.76rem", padding: "4px 10px", borderRadius: 20, background: "rgba(124, 111, 255, 0.12)", color: "#a78bfa", fontWeight: 600 }}>
                  ⚡ Auto-syncs every minute
                </div>
              </div>

              <form onSubmit={e => saveSettings(e, "schedule")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                  
                  {/* Poster Send Time */}
                  <div style={{
                    padding: "1rem 1.25rem",
                    borderRadius: 12,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      🖼️ Poster Send Time
                    </label>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
                      Daily question / story audio poster is automatically sent to the WhatsApp group.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        className="form-input"
                        type="time"
                        value={settings.posterSendTime}
                        onChange={e => setSettings(s => ({ ...s, posterSendTime: e.target.value }))}
                        required
                        style={{ width: 140, fontSize: "1.05rem", padding: "0.45rem 0.6rem" }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 600 }}>
                        Currently: {settings.posterSendTime} IST
                      </span>
                    </div>
                  </div>

                  {/* Question Generate Time */}
                  <div style={{
                    padding: "1rem 1.25rem",
                    borderRadius: 12,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      🤖 Question Generate Time
                    </label>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
                      AI automatically pre-generates 14 upcoming questions if bank stock is low.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        className="form-input"
                        type="time"
                        value={settings.questionGenerateTime}
                        onChange={e => setSettings(s => ({ ...s, questionGenerateTime: e.target.value }))}
                        required
                        style={{ width: 140, fontSize: "1.05rem", padding: "0.45rem 0.6rem" }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 600 }}>
                        Currently: {settings.questionGenerateTime} IST
                      </span>
                    </div>
                  </div>

                </div>

                {/* Submission Report Schedule Box */}
                <div style={{
                  padding: "1.25rem",
                  borderRadius: 14,
                  background: "rgba(124, 111, 255, 0.05)",
                  border: "1px solid rgba(124, 111, 255, 0.25)",
                  marginBottom: "1.5rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        📊 WhatsApp Daily Submission Report (Paid Students)
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                        Auto-broadcasts daily attendance (submitted vs pending paid students) to your group at each configured time.
                      </div>
                    </div>

                    {/* Active / Paused Toggle Pill */}
                    <div
                      onClick={() => setSettings(s => ({ ...s, submissionReportEnabled: !s.submissionReportEnabled }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        cursor: "pointer",
                        userSelect: "none",
                        background: settings.submissionReportEnabled ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                        border: `1px solid ${settings.submissionReportEnabled ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
                        borderRadius: 24,
                        padding: "0.4rem 0.95rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: settings.submissionReportEnabled ? "#4ade80" : "#f87171",
                        boxShadow: `0 0 8px ${settings.submissionReportEnabled ? "#4ade80" : "#f87171"}`,
                      }} />
                      <span style={{
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        color: settings.submissionReportEnabled ? "#4ade80" : "#f87171",
                      }}>
                        {settings.submissionReportEnabled ? "🟢 Active (Auto-Send ON)" : "🔴 Paused (Auto-Send OFF)"}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Multi-Times List */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                    {(settings.submissionReportTimes || ["18:00", "21:00"]).map((timeStr, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.6rem 0.85rem",
                          background: "var(--bg-secondary)",
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap" }}>
                          ⏰ Time #{idx + 1}
                        </span>
                        <input
                          className="form-input"
                          type="time"
                          value={timeStr}
                          onChange={e => {
                            const newTime = e.target.value;
                            setSettings(s => {
                              const list = [...(s.submissionReportTimes || ["18:00"])];
                              list[idx] = newTime;
                              return { ...s, submissionReportTimes: list };
                            });
                          }}
                          required
                          style={{ flex: 1, fontSize: "0.95rem", padding: "0.35rem 0.5rem" }}
                        />
                        {(settings.submissionReportTimes || []).length > 1 && (
                          <button
                            type="button"
                            title="Remove time"
                            onClick={() => {
                              setSettings(s => {
                                const list = (s.submissionReportTimes || []).filter((_, i) => i !== idx);
                                return { ...s, submissionReportTimes: list.length > 0 ? list : ["18:00"] };
                              });
                            }}
                            style={{
                              background: "rgba(248,113,113,0.15)",
                              border: "1px solid rgba(248,113,113,0.3)",
                              color: "#f87171",
                              borderRadius: 8,
                              padding: "0.35rem 0.55rem",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSettings(s => {
                        const current = s.submissionReportTimes || [];
                        const lastTime = current[current.length - 1] || "18:00";
                        const [h, m] = lastTime.split(":").map(Number);
                        const nextHour = String((h + 2) % 24).padStart(2, "0");
                        const nextTime = `${nextHour}:${String(m || 0).padStart(2, "0")}`;
                        return { ...s, submissionReportTimes: [...current, nextTime] };
                      });
                    }}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: 10,
                      border: "1px dashed rgba(124, 111, 255, 0.4)",
                      background: "rgba(124, 111, 255, 0.08)",
                      color: "#c084fc",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                    }}
                  >
                    ➕ Add Another Auto-Send Time Slot
                  </button>

                  <div style={{
                    marginTop: "0.85rem",
                    padding: "0.6rem 0.85rem",
                    borderRadius: 8,
                    background: settings.submissionReportEnabled ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                    border: `1px solid ${settings.submissionReportEnabled ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    fontSize: "0.78rem",
                    color: settings.submissionReportEnabled ? "#4ade80" : "#f87171",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <span>
                      {settings.submissionReportEnabled
                        ? "✅ Auto-sending is ACTIVE — reports will automatically broadcast at the times above."
                        : "⚠️ Auto-sending is PAUSED — click the switch above to turn it ON, then click 'Save Schedule & Automation'."}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button type="submit" className="btn-primary" disabled={savingSection !== null} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}>
                    {savingSection === "schedule" ? "Saving Schedules…" : "💾 Save Schedule & Automation"}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: "0.75rem 1.25rem",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      border: "1px solid rgba(124, 111, 255, 0.4)",
                      background: "rgba(124, 111, 255, 0.12)",
                      color: "#c084fc",
                      cursor: "pointer",
                    }}
                    disabled={!waStatus?.isConnected || waSendingReport}
                    onClick={handleSendSubmissionReportToGroup}
                  >
                    {waSendingReport ? "⏳ Sending Report..." : "⚡ Send Test Report to Group Now"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: DURATION SCORING SETTINGS */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(settingsSubTab === "all" || settingsSubTab === "duration") && (
            <div className="card" style={{ margin: 0, padding: "1.5rem", borderRadius: 16 }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <div className="section-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                  ⏱️ Duration Targets &amp; Video Limits
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.83rem", margin: "0.25rem 0 0" }}>
                  Configure recording duration targets in seconds. Students earn full duration score when reaching "Full Score Target" and can record up to "Max Limit".
                </p>
              </div>

              <form onSubmit={e => saveSettings(e, "duration")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  
                  {[
                    { id: "default", icon: "📅", title: "Default Daily Questions", full: "durationDefaultFull", max: "durationDefaultMax", color: "#7c6fff" },
                    { id: "story", icon: "📚", title: "Story Summary Day", full: "durationStoryFull", max: "durationStoryMax", color: "#a78bfa" },
                    { id: "weekly", icon: "🔍", title: "Weekly Reflection Day", full: "durationWeeklyFull", max: "durationWeeklyMax", color: "#4ade80" },
                    { id: "monthly", icon: "💬", title: "Monthly Reflection Day", full: "durationMonthlyReflectionFull", max: "durationMonthlyReflectionMax", color: "#60a5fa" },
                    { id: "goals", icon: "🎯", title: "Monthly Goals Day", full: "durationMonthlyGoalsFull", max: "durationMonthlyGoalsMax", color: "#f472b6" },
                    { id: "picture", icon: "🖼️", title: "Picture Description Day", full: "durationPictureFull", max: "durationPictureMax", color: "#38bdf8" },
                  ].map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: "1rem 1.15rem",
                        borderRadius: 12,
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.88rem", color: item.color }}>
                        <span>{item.icon}</span> {item.title}
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: "0.73rem", marginBottom: "0.2rem" }}>
                            Full Score (sec)
                          </label>
                          <input
                            className="form-input"
                            type="number"
                            min={60} max={1200}
                            value={settings[item.full]}
                            onChange={e => setSettings(s => ({ ...s, [item.full]: parseInt(e.target.value) || 60 }))}
                            required
                            style={{ textAlign: "center", padding: "0.4rem", fontSize: "0.95rem" }}
                          />
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.25rem", textAlign: "center" }}>
                            ≈ {Math.round((settings[item.full] || 60) / 60)} min
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: "0.73rem", marginBottom: "0.2rem" }}>
                            Max Allowed (sec)
                          </label>
                          <input
                            className="form-input"
                            type="number"
                            min={60} max={1200}
                            value={settings[item.max]}
                            onChange={e => setSettings(s => ({ ...s, [item.max]: parseInt(e.target.value) || 60 }))}
                            required
                            style={{ textAlign: "center", padding: "0.4rem", fontSize: "0.95rem" }}
                          />
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.25rem", textAlign: "center" }}>
                            ≈ {Math.round((settings[item.max] || 60) / 60)} min
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                </div>

                <button type="submit" className="btn-primary" disabled={savingSection !== null} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}>
                  {savingSection === "duration" ? "Saving Durations…" : "💾 Save Duration Settings"}
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: VOCABULARY & CONTENT SETTINGS */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(settingsSubTab === "all" || settingsSubTab === "vocab") && (
            <div className="card" style={{ margin: 0, padding: "1.5rem", borderRadius: 16 }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <div className="section-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                  📚 Vocabulary &amp; Content Rules
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.83rem", margin: "0.25rem 0 0" }}>
                  Set daily vocabulary targets, CEFR levels, audio story length, and special challenge day schedules.
                </p>
              </div>

              <form onSubmit={e => saveSettings(e, "vocab")}>
                
                {/* Vocabulary Word Count Targets Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
                  {[
                    { key: "Normal", label: "🗣️ Normal Daily Topics", words: "vocabNormalWordCount", required: "vocabNormalRequiredCount" },
                    { key: "Story", label: "📖 Story Summary Day", words: "vocabStoryWordCount", required: "vocabStoryRequiredCount" },
                    { key: "Picture", label: "🖼️ Picture Description Day", words: "vocabPictureWordCount", required: "vocabPictureRequiredCount" },
                  ].map(({ key, label, words, required }) => (
                    <div key={key} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-secondary)" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.6rem" }}>{label}</div>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "0.74rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Shown</label>
                          <input className="form-input" type="number" min={1} max={10} value={settings[words]}
                            onChange={e => setSettings(s => ({ ...s, [words]: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)), [required]: Math.min(s[required], parseInt(e.target.value) || 1) }))}
                            required style={{ textAlign: "center", padding: "0.35rem" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "0.74rem", color: "var(--muted)", display: "block", marginBottom: "0.2rem" }}>Required</label>
                          <input className="form-input" type="number" min={1} max={settings[words]} value={settings[required]}
                            onChange={e => setSettings(s => ({ ...s, [required]: Math.max(1, Math.min(s[words], parseInt(e.target.value) || 1)) }))}
                            required style={{ textAlign: "center", padding: "0.35rem" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CEFR Level Selector */}
                <div style={{ padding: "1.1rem 1.25rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)", marginBottom: "1.25rem" }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    📊 CEFR Vocabulary Difficulty Level
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                    {["A1","A2","B1","B2","C1","C2"].map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, vocabLevel: l }))}
                        style={{
                          padding: "0.4rem 0.95rem",
                          borderRadius: 20,
                          fontSize: "0.84rem",
                          fontWeight: 700,
                          border: settings.vocabLevel === l ? "2px solid #7c6fff" : "1px solid var(--border)",
                          background: settings.vocabLevel === l ? "rgba(124,111,255,0.22)" : "rgba(255,255,255,0.04)",
                          color: settings.vocabLevel === l ? "#c084fc" : "var(--muted)",
                          cursor: "pointer",
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {settings.vocabLevel === "A1" && "A1: Beginner — very basic everyday words"}
                    {settings.vocabLevel === "A2" && "A2: Elementary — simple practical vocabulary"}
                    {settings.vocabLevel === "B1" && "B1: Intermediate — common useful conversational words"}
                    {settings.vocabLevel === "B2" && "B2: Upper-Intermediate — rich, professional words (Recommended)"}
                    {settings.vocabLevel === "C1" && "C1: Advanced — sophisticated fluent-speaker expressions"}
                    {settings.vocabLevel === "C2" && "C2: Proficient — complex academic & literary vocabulary"}
                  </div>
                </div>

                {/* Story Settings Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
                  
                  {/* Story Audio Length */}
                  <div style={{ padding: "1rem 1.15rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: "0.35rem" }}>
                      🎧 Story Audio Word Count
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
                      <input
                        className="form-input"
                        type="number"
                        min={100} max={400} step={10}
                        value={settings.storyWordCount}
                        onChange={e => setSettings(s => ({ ...s, storyWordCount: parseInt(e.target.value) || 200 }))}
                        style={{ width: 90, textAlign: "center" }}
                      />
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        words &nbsp;·&nbsp; ≈ <strong style={{ color: "var(--accent)" }}>{Math.round(settings.storyWordCount / 130 * 60)}s</strong> audio
                      </span>
                    </div>
                  </div>

                  {/* Story Difficulty */}
                  <div style={{ padding: "1rem 1.15rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: "0.35rem" }}>
                      🎓 Story Difficulty Level
                    </label>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {["A2","B1","B2","C1"].map(l => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setSettings(s => ({ ...s, storyLevel: l }))}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: 16,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            border: settings.storyLevel === l ? "2px solid #7c6fff" : "1px solid var(--border)",
                            background: settings.storyLevel === l ? "rgba(124,111,255,0.2)" : "rgba(255,255,255,0.03)",
                            color: settings.storyLevel === l ? "#c084fc" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Day of Week Selectors */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  
                  {/* Story Day */}
                  <div style={{ padding: "1rem 1.15rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: "0.4rem" }}>
                      📅 Story Summary Day
                    </label>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                      {[
                        { d: 0, label: "Sun" }, { d: 1, label: "Mon" }, { d: 2, label: "Tue" },
                        { d: 3, label: "Wed" }, { d: 4, label: "Thu" }, { d: 5, label: "Fri" }, { d: 6, label: "Sat" }
                      ].map(({ d, label }) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSettings(s => ({ ...s, storyDay: d }))}
                          style={{
                            padding: "0.35rem 0.65rem", borderRadius: 14, fontSize: "0.78rem", fontWeight: 700,
                            border: settings.storyDay === d ? "2px solid #7c6fff" : "1px solid var(--border)",
                            background: settings.storyDay === d ? "rgba(124,111,255,0.22)" : "rgba(255,255,255,0.03)",
                            color: settings.storyDay === d ? "#c084fc" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                      Runs on: <strong style={{ color: "var(--accent)" }}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][settings.storyDay ?? 6]}</strong>
                    </div>
                  </div>

                  {/* Picture Description Day */}
                  <div style={{ padding: "1rem 1.15rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: "0.4rem" }}>
                      🖼️ Picture Description Day
                    </label>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                      {[
                        { d: -1, label: "Off" }, { d: 0, label: "Sun" }, { d: 1, label: "Mon" }, { d: 2, label: "Tue" },
                        { d: 3, label: "Wed" }, { d: 4, label: "Thu" }, { d: 5, label: "Fri" }, { d: 6, label: "Sat" }
                      ].map(({ d, label }) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSettings(s => ({ ...s, pictureDescriptionDay: d }))}
                          style={{
                            padding: "0.35rem 0.65rem", borderRadius: 14, fontSize: "0.78rem", fontWeight: 700,
                            border: settings.pictureDescriptionDay === d ? "2px solid #38bdf8" : "1px solid var(--border)",
                            background: settings.pictureDescriptionDay === d ? "rgba(56,189,248,0.22)" : "rgba(255,255,255,0.03)",
                            color: settings.pictureDescriptionDay === d ? "#38bdf8" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                      Runs on: <strong style={{ color: "#38bdf8" }}>{(settings.pictureDescriptionDay ?? 4) === -1 ? "Disabled" : ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][settings.pictureDescriptionDay ?? 4]}</strong>
                    </div>
                  </div>

                </div>

                <button type="submit" className="btn-primary" disabled={savingSection !== null} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}>
                  {savingSection === "vocab" ? "Saving Vocabulary…" : "💾 Save Vocabulary & Content Settings"}
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 4: PRICING & PRIVACY SETTINGS */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(settingsSubTab === "all" || settingsSubTab === "pricing") && (
            <div className="card" style={{ margin: 0, padding: "1.5rem", borderRadius: 16 }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <div className="section-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                  💳 Membership Pricing &amp; Video Privacy
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.83rem", margin: "0.25rem 0 0" }}>
                  Set the student membership fee charged via Razorpay and manage community video privacy settings.
                </p>
              </div>

              <form onSubmit={e => saveSettings(e, "payment")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" }}>
                  
                  {/* Membership Amount */}
                  <div style={{ padding: "1.25rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                      💰 Premium Membership Fee (INR)
                    </label>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
                      Amount shown on the payment wall and charged at checkout.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent)" }}>₹</span>
                      <input
                        className="form-input"
                        type="number"
                        min={1} max={100000} step="0.01"
                        value={settings.paymentAmount}
                        onChange={e => setSettings(s => ({ ...s, paymentAmount: e.target.value }))}
                        required
                        style={{ width: 140, fontSize: "1.1rem", fontWeight: 700 }}
                      />
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>INR</span>
                    </div>
                  </div>

                  {/* Allow Private Videos Toggle */}
                  <div style={{ padding: "1.25rem", borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                      🔒 Community Video Privacy
                    </label>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>
                      Allow or disallow students from marking their submission videos private.
                    </p>
                    <div
                      onClick={() => setSettings(s => ({ ...s, allowPrivateVideos: !s.allowPrivateVideos }))}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        cursor: "pointer", userSelect: "none",
                        background: settings.allowPrivateVideos ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                        border: `1px solid ${settings.allowPrivateVideos ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
                        borderRadius: 12, padding: "0.65rem 1rem",
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: settings.allowPrivateVideos ? "#4ade80" : "#f87171",
                        boxShadow: `0 0 8px ${settings.allowPrivateVideos ? "#4ade80" : "#f87171"}`,
                      }} />
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: settings.allowPrivateVideos ? "#4ade80" : "#f87171" }}>
                          {settings.allowPrivateVideos ? "Enabled — Students can set videos private" : "Disabled — All videos are forced public"}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <button type="submit" className="btn-primary" disabled={savingSection !== null} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}>
                  {savingSection === "payment" ? "Saving Pricing…" : "💾 Save Pricing & Privacy"}
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 5: SYSTEM RESETS & MAINTENANCE */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(settingsSubTab === "all" || settingsSubTab === "resets") && (
            <div className="card" style={{
              margin: 0, padding: "1.5rem", borderRadius: 16,
              background: "rgba(239, 68, 68, 0.03)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <div className="section-title" style={{ margin: 0, fontSize: "1.1rem", color: "#f87171" }}>
                  ⚠️ System Maintenance &amp; Reset Controls
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.83rem", margin: "0.25rem 0 0" }}>
                  Manually trigger system resets on-demand. Note: These actions are normally performed automatically at 12:00 AM midnight.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                {[
                  { label: "🌅 Reset Day", desc: "Clears today's submissions and questions for all students", key: "day", endpoint: "/users/reset/day" },
                  { label: "📅 Reset Weekly", desc: "Resets all weekly submission counters back to 0", key: "weekly", endpoint: "/users/reset/weekly" },
                  { label: "📆 Reset Monthly", desc: "Resets all monthly submission scores back to 0", key: "monthly", endpoint: "/users/reset/monthly" },
                ].map(({ label, desc, key, endpoint }) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "1rem 1.15rem",
                      background: "var(--bg-secondary)",
                      borderRadius: 12,
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff" }}>{label}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.25rem" }}>{desc}</div>
                    </div>
                    <button
                      className="btn-ghost danger"
                      style={{ fontSize: "0.84rem", fontWeight: 700, padding: "0.45rem", alignSelf: "flex-start", width: "100%" }}
                      disabled={resetting === key}
                      onClick={() => setModal({
                        type: "danger", title: label,
                        message: `${desc}. This cannot be undone. Are you sure?`,
                        confirmText: "Yes, Reset Now",
                        onConfirm: async () => {
                          setModal(null); setResetting(key);
                          try { await api.post(endpoint); msg(`${label} completed!`); reload(); }
                          catch(e) { msg(e?.response?.data?.error || "Failed", "danger"); }
                          finally { setResetting(""); }
                        },
                      })}
                    >
                      {resetting === key ? "Resetting…" : `Execute ${label}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* LIVE SESSIONS */}
      {tab==="live" && <LiveSessionsPanel />}

      {/* MANUAL QUESTIONS */}
      {tab==="manual-questions" && <ManualQuestionsPanel />}

      {/* STUDENT DETAIL */}
      {tab==="student-detail" && selectedStudent && (
        <>
          <div className="stat-grid" style={{marginBottom:"1rem"}}>
            <StatCard icon="🔥" label="Streak" value={`${selectedStudent.streak||0} days`} color="#f97316"/>
            <StatCard icon="🧊" label="Freeze" value={selectedStudent.streakFreeze||0} color="#38bdf8"/>
            <StatCard icon="⭐" label="Monthly Score" value={selectedStudent.monthlyScore||0} color="#a78bfa"/>
            <StatCard icon="📅" label="Weekly" value={`${selectedStudent.weeklySubmissions||0}/7`} color="#4ade80"/>
            <StatCard icon="📆" label="Monthly" value={selectedStudent.monthlySubmissions||0} color="#7c6fff"/>
          </div>

          <div className="card" style={{marginBottom:"1rem"}}>
            <div className="section-title">Manage Submissions</div>
            <SubmissionControls 
              phone={selectedStudent.phone}
              weeklySubmissions={selectedStudent.weeklySubmissions || 0}
              monthlySubmissions={selectedStudent.monthlySubmissions || 0}
              onUpdate={handleSubmissionUpdate}
            />
          </div>

          <div className="card">
            <div className="section-title">Student Information</div>
            <div style={{display:"grid",gap:"0.75rem",fontSize:"0.9rem"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"var(--muted)"}}>Name:</span>
                <span style={{fontWeight:500}}>{selectedStudent.registeredName||selectedStudent.name||"—"}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"var(--muted)"}}>Phone:</span>
                <span style={{fontWeight:500}}>{selectedStudent.phone}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"var(--muted)"}}>Role:</span>
                <span style={{fontWeight:500}}>{selectedStudent.role||"user"}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"var(--muted)"}}>Status:</span>
                <span style={{color:selectedStudent.isActive?"var(--success)":"var(--danger)",fontWeight:600}}>
                  {selectedStudent.isActive?"Active":"Disabled"}
                </span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"var(--muted)"}}>Today's Submission:</span>
                <span style={{color:selectedStudent.completed?"var(--success)":"var(--danger)",fontWeight:600}}>
                  {selectedStudent.completed?"✅ Submitted":"⏳ Pending"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

// ── Live Sessions Panel ───────────────────────────────────────────────────────
function LiveSessionsPanel() {
  const navigate = useNavigate();
  const confirm  = useConfirm();
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ title: "", scheduledAt: "", description: "", maxParticipants: 20 });
  const [saving, setSaving]         = useState(false);
  const [busy, setBusy]             = useState({});
  const [toast, setToast]           = useState(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const res = await api.get("/live-sessions");
      setSessions(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/live-sessions", form);
      setForm({ title: "", scheduledAt: "", description: "", maxParticipants: 20 });
      setShowForm(false);
      notify("Session scheduled!");
      load();
    } catch (err) {
      notify(err.response?.data?.error || "Failed to create session", "error");
    } finally { setSaving(false); }
  };

  const start = async (id) => {
    setBusy(b => ({ ...b, [id]: "starting" }));
    try { await api.post(`/live-sessions/${id}/start`); notify("Session is now LIVE! 🔴"); load(); }
    catch (err) { notify(err.response?.data?.error || "Failed to start", "error"); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  };

  const end = async (id) => {
    const ok = await confirm({ title: "End Session", message: "End this session for all participants?", confirmText: "End Session", type: "danger" });
    if (!ok) return;
    setBusy(b => ({ ...b, [id]: "ending" }));
    try { await api.post(`/live-sessions/${id}/end`); notify("Session ended."); load(); }
    catch (err) { notify(err.response?.data?.error || "Failed to end", "error"); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  };

  const cancel = async (id) => {
    const ok = await confirm({ title: "Cancel Session", message: "Cancel this scheduled session? This cannot be undone.", confirmText: "Yes, Cancel", type: "danger" });
    if (!ok) return;
    setBusy(b => ({ ...b, [id]: "cancelling" }));
    try { await api.delete(`/live-sessions/${id}`); notify("Session cancelled."); load(); }
    catch (err) { notify(err.response?.data?.error || "Failed to cancel", "error"); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  };

  const statusConfig = {
    scheduled: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", label: "Scheduled", icon: "📅" },
    live:      { color: "#4ade80", bg: "rgba(74,222,128,0.1)", label: "🔴 Live",    icon: "🔴" },
    ended:     { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Ended",    icon: "✅" },
  };

  const liveSessions      = sessions.filter(s => s.status === "live");
  const scheduledSessions = sessions.filter(s => s.status === "scheduled");
  const endedSessions     = sessions.filter(s => s.status === "ended");

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "5rem", right: "1rem", zIndex: 9999,
          background: toast.type === "error" ? "#7f1d1d" : "#065f46",
          border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(74,222,128,0.4)"}`,
          color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 12,
          fontSize: "0.9rem", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          animation: "slideUpIn 0.3s ease",
        }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>🎥 Live Sessions</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
            Schedule and manage live video sessions for your group
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            background: showForm ? "rgba(248,113,113,0.15)" : "linear-gradient(135deg,#7c6fff,#4f46e5)",
            border: showForm ? "1px solid rgba(248,113,113,0.3)" : "none",
            color: showForm ? "#f87171" : "#fff",
            borderRadius: 12, padding: "0.65rem 1.25rem",
            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {showForm ? "✕ Cancel" : "+ Schedule Session"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: "linear-gradient(135deg, rgba(124,111,255,0.08), rgba(79,70,229,0.05))",
          border: "1px solid rgba(124,111,255,0.25)",
          borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>📅 New Session</div>
          <form onSubmit={create}>
            <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
              <div>
                <label className="form-label">Session Title *</label>
                <input className="form-input" placeholder="e.g. Weekly Speaking Practice" required
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Date & Time *</label>
                <input className="form-input" type="datetime-local" required
                  value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label className="form-label">Description (optional)</label>
              <input className="form-input" placeholder="What will be covered in this session…"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label className="form-label">
                Max Participants
                <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                  (2–100, default 20)
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  className="form-input"
                  type="number"
                  min={2} max={100}
                  style={{ width: 100 }}
                  value={form.maxParticipants}
                  onChange={e => setForm(f => ({ ...f, maxParticipants: Math.min(100, Math.max(2, parseInt(e.target.value) || 20)) }))}
                />
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {[5, 10, 20, 30, 50].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, maxParticipants: n }))}
                      style={{
                        padding: "0.25rem 0.6rem", borderRadius: 8, fontSize: "0.75rem",
                        border: form.maxParticipants === n ? "1px solid #7c6fff" : "1px solid var(--border)",
                        background: form.maxParticipants === n ? "rgba(124,111,255,0.2)" : "var(--bg-secondary)",
                        color: form.maxParticipants === n ? "#a78bfa" : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 160 }}>
              {saving ? "Scheduling…" : "📅 Schedule Session"}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {/* Live now */}
      {liveSessions.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            🔴 Live Now
          </div>
          {liveSessions.map(s => <SessionCard key={s._id} s={s} onStart={start} onEnd={end} busy={busy} navigate={navigate} />)}
        </div>
      )}

      {/* Scheduled */}
      {scheduledSessions.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            📅 Upcoming
          </div>
          {scheduledSessions.map(s => <SessionCard key={s._id} s={s} onStart={start} onEnd={end} onCancel={cancel} busy={busy} navigate={navigate} />)}
        </div>
      )}

      {/* Ended */}
      {endedSessions.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            ✅ Past Sessions
          </div>
          {endedSessions.slice(0, 5).map(s => <SessionCard key={s._id} s={s} onStart={start} onEnd={end} busy={busy} navigate={navigate} />)}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎥</div>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>No sessions yet</div>
          <div style={{ fontSize: "0.85rem" }}>Click "+ Schedule Session" to create your first live session</div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, onStart, onEnd, onCancel, busy, navigate }) {
  const isLive      = s.status === "live";
  const isScheduled = s.status === "scheduled";
  const isEnded     = s.status === "ended";

  const borderColor = isLive ? "rgba(74,222,128,0.4)" : isScheduled ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)";
  const bgColor     = isLive ? "rgba(74,222,128,0.05)" : "var(--bg-secondary)";

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 14, padding: "1rem 1.25rem",
      marginBottom: "0.75rem",
      transition: "all 0.2s",
      position: "relative",
      overflow: "hidden",
    }}>
      {isLive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, #4ade80, #22c55e)",
          animation: "shimmer 2s linear infinite",
        }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>{s.title}</span>
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem",
              borderRadius: 20, textTransform: "uppercase",
              background: isLive ? "rgba(74,222,128,0.15)" : isScheduled ? "rgba(96,165,250,0.15)" : "rgba(107,114,128,0.15)",
              color: isLive ? "#4ade80" : isScheduled ? "#60a5fa" : "#6b7280",
            }}>
              {isLive ? "🔴 Live" : isScheduled ? "Scheduled" : "Ended"}
            </span>
          </div>

          {s.description && (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.4rem" }}>{s.description}</div>
          )}

          <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--muted)", flexWrap: "wrap" }}>
            <span>📅 {new Date(s.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
            {s.participantCount > 0 && (
              <span style={{ color: s.participantCount >= (s.maxParticipants || 20) ? "#f87171" : "var(--muted)" }}>
                👥 {s.participantCount}/{s.maxParticipants || 20}
                {s.participantCount >= (s.maxParticipants || 20) && " 🔴 Full"}
              </span>
            )}
            {s.participantCount === 0 && (
              <span>👥 0/{s.maxParticipants || 20} max</span>
            )}
            {s.durationMinutes && <span>⏱️ {s.durationMinutes} min</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
          {isScheduled && (
            <button
              onClick={() => onStart(s._id)}
              disabled={busy[s._id] === "starting"}
              style={{
                background: "linear-gradient(135deg,#4ade80,#22c55e)",
                color: "#065f46", border: "none", borderRadius: 10,
                padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.82rem",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {busy[s._id] === "starting" ? "Starting…" : "🔴 Go Live"}
            </button>
          )}
          {isScheduled && onCancel && (
            <button
              onClick={() => onCancel(s._id)}
              disabled={busy[s._id] === "cancelling"}
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171", borderRadius: 10,
                padding: "0.5rem 0.85rem", fontWeight: 700, fontSize: "0.82rem",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {busy[s._id] === "cancelling" ? "Cancelling…" : "✕ Cancel"}
            </button>
          )}
          {isLive && (
            <>
              <button
                onClick={() => window.open(`/live/${s._id}`, "_blank")}
                style={{
                  background: "linear-gradient(135deg,#7c6fff,#4f46e5)",
                  color: "#fff", border: "none", borderRadius: 10,
                  padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                📹 Join
              </button>
              <button
                onClick={() => onEnd(s._id)}
                disabled={busy[s._id] === "ending"}
                style={{
                  background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
                  color: "#f87171", borderRadius: 10,
                  padding: "0.5rem 0.85rem", fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {busy[s._id] === "ending" ? "Ending…" : "⏹ End"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Monitoring Panel ─────────────────────────────────────────────────────────
function MonitoringPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    try {
      const res = await api.get("/monitoring");
      setData(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="spinner-wrap"><div className="spinner"/><p style={{color:"var(--muted)"}}>Loading…</p></div>;
  if (error) return <div className="error-box"><p>{error}</p><button className="btn-primary" style={{marginTop:"0.75rem"}} onClick={load}>Retry</button></div>;
  if (!data) return null;

  const { system, videos, queue, api: apiStats, activeUsers } = data;
  const cpuColor = system.cpuPercent > 80 ? "#f87171" : system.cpuPercent > 60 ? "#fbbf24" : "#4ade80";
  const memColor = system.memPercent > 85 ? "#f87171" : system.memPercent > 65 ? "#fbbf24" : "#4ade80";
  const isIdle = videos.processing === 0 && videos.queued === 0;

  return (
    <div style={{display:"grid",gap:"1rem"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem"}}>
        <div className="section-title" style={{margin:0}}>🖥️ System Monitor</div>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",display:"inline-block",boxShadow:"0 0 6px #4ade80"}}/>
            <span style={{color:"var(--muted)",fontSize:"0.78rem"}}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}` : "Live"}
            </span>
          </div>
          <button className="btn-secondary" style={{padding:"0.3rem 0.8rem",fontSize:"0.8rem"}} onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Row 1: 3 stat tiles */}
      <div className="grid-cols-3">
        <MonStat icon="👥" label="Active Users" value={activeUsers} accent="#7c6fff" />
        <MonStat icon="✅" label="Done Today" value={videos.completedToday} accent="#4ade80" />
        <MonStat icon="❌" label="Failed Today" value={videos.failedToday} accent={videos.failedToday > 0 ? "#f87171" : "#4ade80"} />
      </div>

      {/* Row 2: 3 stat tiles */}
      <div className="grid-cols-3">
        <MonStat icon="🎬" label="Processing Now" value={isIdle ? "Idle" : `${videos.activeCount ?? videos.processing} / ${videos.maxConcurrent ?? queue?.maxConcurrent ?? 15}`} accent="#38bdf8" />
        <MonStat icon="⏱️" label="Avg Process Time" value={queue?.avgProcessingMin ? `${queue.avgProcessingMin} min` : "—"} accent="#fbbf24" />
        <MonStat icon="🌐" label="Avg API Response" value={apiStats.avgResponseMs ? `${apiStats.avgResponseMs}ms` : "—"} accent="#fb923c" />
      </div>

      {/* Server Resources */}
      <div className="card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
          <span style={{fontWeight:600,fontSize:"0.95rem"}}>💻 Server Resources</span>
          <span style={{color:"var(--muted)",fontSize:"0.78rem"}}>Uptime: {system.uptimeHours}h</span>
        </div>
        <div style={{display:"grid",gap:"1.1rem"}}>
          <ResourceBar label="CPU" value={system.cpuPercent} unit="%" color={cpuColor} />
          <ResourceBar
            label="Memory"
            value={system.memPercent}
            unit="%"
            color={memColor}
            sublabel={`${system.memUsedMB} MB / ${system.memTotalMB} MB`}
          />
        </div>
      </div>

      {/* Queue + Errors — errors full width when there are security events */}
      <div className="grid-cols-2">

        {/* Queue */}
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
            <span style={{fontWeight:600,fontSize:"0.95rem"}}>🚦 Video Queue</span>
            <span style={{fontSize:"0.72rem",background:"rgba(124,111,255,0.15)",color:"#7c6fff",borderRadius:99,padding:"0.15rem 0.55rem",fontWeight:600}}>
              ⚡ {videos.maxConcurrent ?? queue?.maxConcurrent ?? 15} concurrent
            </span>
          </div>
          {isIdle ? (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",color:"#4ade80",fontWeight:500,fontSize:"0.9rem"}}>
              <span style={{fontSize:"1.1rem"}}>✅</span> Queue empty — all slots free
            </div>
          ) : (
            <div style={{display:"grid",gap:"0.6rem",fontSize:"0.88rem"}}>
              <QueueRow
                label="Active now"
                value={`${videos.activeCount ?? (videos.activeJobId ? 1 : 0)} / ${videos.maxConcurrent ?? queue?.maxConcurrent ?? 15}`}
                valueColor="#fbbf24"
              />
              <QueueRow label="Waiting" value={`${videos.queued} video${videos.queued !== 1 ? "s" : ""}`} />
              <QueueRow label="Est. wait" value={queue?.avgProcessingMin ? `~${queue.avgProcessingMin} min` : "~2.5 min"} />
            </div>
          )}
          <div className="grid-cols-2" style={{marginTop:"1rem",paddingTop:"0.75rem",borderTop:"1px solid var(--border)",gap:"0.5rem",fontSize:"0.82rem",color:"var(--muted)"}}>
            <span>Total processed: <strong style={{color:"var(--text)"}}>{queue?.totalProcessed || 0}</strong></span>
            <span>Total failed: <strong style={{color: (queue?.totalFailed || 0) > 0 ? "#f87171" : "var(--text)"}}>{queue?.totalFailed || 0}</strong></span>
          </div>
        </div>

        {/* Errors */}
        <div className="card">
          <div style={{fontWeight:600,fontSize:"0.95rem",marginBottom:"1rem"}}>
            ⚠️ Errors Today
            {(queue?.errorsToday || 0) > 0 && (
              <span style={{marginLeft:"0.5rem",background:"rgba(248,113,113,0.15)",color:"#f87171",borderRadius:99,padding:"0.1rem 0.5rem",fontSize:"0.75rem"}}>
                {queue.errorsToday}
              </span>
            )}
          </div>
          {!queue?.recentErrors || queue.recentErrors.length === 0 ? (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",color:"#4ade80",fontWeight:500,fontSize:"0.9rem"}}>
              <span style={{fontSize:"1.1rem"}}>✅</span> No errors today
            </div>
          ) : (
            <div style={{display:"grid",gap:"0.5rem",maxHeight:320,overflowY:"auto"}}>
              {(queue?.recentErrors || []).map((e, i) => (
                <div key={i} style={{
                  background: e.type?.includes("Virus") || e.type?.includes("Content") || e.type?.includes("Codec")
                    ? "rgba(251,146,60,0.07)" : "rgba(248,113,113,0.07)",
                  border: `1px solid ${e.type?.includes("Virus") || e.type?.includes("Content") || e.type?.includes("Codec")
                    ? "rgba(251,146,60,0.25)" : "rgba(248,113,113,0.18)"}`,
                  borderRadius: 10,
                  padding: "0.65rem 0.85rem",
                }}>
                  {/* Top row: type badge + time */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.35rem",gap:"0.5rem",flexWrap:"wrap"}}>
                    <span style={{
                      fontSize:"0.72rem", fontWeight:700, padding:"0.15rem 0.5rem",
                      borderRadius:99,
                      background: e.type?.includes("Virus") || e.type?.includes("Content") || e.type?.includes("Codec")
                        ? "rgba(251,146,60,0.18)" : "rgba(248,113,113,0.15)",
                      color: e.type?.includes("Virus") || e.type?.includes("Content") || e.type?.includes("Codec")
                        ? "#fb923c" : "#f87171",
                    }}>
                      {e.type || "⚙️ Processing"}
                    </span>
                    <span style={{color:"var(--muted)",fontSize:"0.72rem",whiteSpace:"nowrap"}}>
                      {new Date(e.at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                    </span>
                  </div>
                  {/* User info */}
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.3rem"}}>
                    <span style={{fontSize:"0.8rem",fontWeight:600,color:"var(--text)"}}>
                      👤 {e.userName || "Unknown"}
                    </span>
                    {e.phone && e.phone !== "—" && (
                      <span style={{fontSize:"0.75rem",color:"var(--muted)"}}>· {e.phone}</span>
                    )}
                  </div>
                  {/* Error message */}
                  <div style={{color:"var(--muted)",fontSize:"0.78rem",lineHeight:1.5}}>{e.error}</div>
                  {/* Report ID */}
                  <div style={{color:"rgba(255,255,255,0.2)",fontSize:"0.68rem",marginTop:"0.25rem"}}>
                    ID: {String(e.reportId).slice(-8)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────
function MonStat({ icon, label, value, accent }) {
  return (
    <div style={{
      background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,
      padding:"1rem",display:"flex",flexDirection:"column",gap:"0.35rem",
      borderTop:`3px solid ${accent}`,
    }}>
      <div style={{fontSize:"1.4rem",lineHeight:1}}>{icon}</div>
      <div style={{fontSize:"0.72rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:600}}>{label}</div>
      <div style={{fontSize:"1.35rem",fontWeight:700,color:"var(--text)",lineHeight:1}}>{value}</div>
    </div>
  );
}

function ResourceBar({ label, value, unit, color, sublabel }) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"0.4rem"}}>
        <span style={{fontSize:"0.85rem",color:"var(--muted)"}}>{label}</span>
        <div style={{textAlign:"right"}}>
          <span style={{fontWeight:700,color,fontSize:"0.9rem"}}>{value}{unit}</span>
          {sublabel && <span style={{color:"var(--muted)",fontSize:"0.75rem",marginLeft:"0.4rem"}}>({sublabel})</span>}
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,0.06)",borderRadius:99,height:8,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(value,100)}%`,background:color,borderRadius:99,transition:"width 0.6s ease",boxShadow:`0 0 8px ${color}55`}}/>
      </div>
    </div>
  );
}

function QueueRow({ label, value, valueColor }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{color:"var(--muted)"}}>{label}</span>
      <span style={{fontWeight:600,color:valueColor||"var(--text)"}}>{value}</span>
    </div>
  );
}

// ── Manual Questions Panel ────────────────────────────────────────────────────
function ManualQuestionsPanel() {
  const [manualQuestions, setManualQuestions] = useState([]);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    setupType: "weekly_reflection",
    scheduledFor: "",
    scheduledTime: "",
    category: "",
    topic: "",
    question: "",
    audioUrl: "",
    storyTranscript: "",
    summaryGuide: "",
    imageUrl: "",
    imageSource: "",
    imagePageUrl: "",
    imagePhotographer: "",
    imagePhotographerUrl: "",
    imageInstructions: ""
  });
  const [saving, setSaving] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingPicture, setGeneratingPicture] = useState(false);
  const [busy, setBusy] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerateStory = async () => {
    setGeneratingStory(true);
    try {
      const res = await api.post("/questions/generate-story");
      const { topic, story, summaryGuide, question } = res.data;
      setForm(f => ({
        ...f,
        topic,
        question,
        storyTranscript: story,
        summaryGuide: Array.isArray(summaryGuide) ? summaryGuide.join("\n") : summaryGuide || "",
      }));
      notify("Story generated! Review and add an audio URL before saving.");
    } catch (err) {
      notify(err.response?.data?.error || "Story generation failed", "error");
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!form.storyTranscript) {
      notify("Generate a story first — the transcript is needed for audio.", "error");
      return;
    }
    setGeneratingAudio(true);
    try {
      const res = await api.post("/questions/generate-story-audio", {
        storyText: form.storyTranscript,
        topic: form.topic || "story",
      });
      setForm(f => ({ ...f, audioUrl: res.data.audioUrl }));
      notify("Audio generated and uploaded! URL has been filled in.");
    } catch (err) {
      notify(err.response?.data?.error || "Audio generation failed", "error");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleGeneratePicture = async () => {
    setGeneratingPicture(true);
    try {
      const res = await api.post("/questions/generate-picture");
      const { title, instructions, imageUrl, imageSource, imagePageUrl, imagePhotographer, imagePhotographerUrl, imageSearchQuery } = res.data;
      setForm(f => ({
        ...f,
        topic: title || f.topic,
        question: instructions || f.question,
        imageUrl: imageUrl || "",
        imageSource: imageSource || "",
        imagePageUrl: imagePageUrl || "",
        imagePhotographer: imagePhotographer || "",
        imagePhotographerUrl: imagePhotographerUrl || "",
        imageInstructions: instructions || "",
        category: "Picture Description",
      }));
      notify("Picture challenge generated! All fields have been filled in.");
    } catch (err) {
      notify(err.response?.data?.error || "Picture generation failed", "error");
    } finally {
      setGeneratingPicture(false);
    }
  };

  const load = async () => {
    try {
      const [questionsRes, templatesRes] = await Promise.all([
        api.get("/questions/manual?upcoming=true"),
        api.get("/questions/templates")
      ]);
      setManualQuestions(questionsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      notify(err.response?.data?.error || "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setupQuestion = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/questions/manual", form);
      setForm({
        setupType: "weekly_reflection",
        scheduledFor: "",
        scheduledTime: "",
        category: "",
        topic: "",
        question: "",
        audioUrl: "",
        storyTranscript: "",
        summaryGuide: ""
      });
      setSelectedTemplate("");
      setShowForm(false);
      notify("Manual question scheduled successfully!");
      load();
    } catch (err) {
      notify(err.response?.data?.error || "Failed to setup question", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await api.delete(`/questions/manual/${id}`);
      notify("Question deleted successfully!");
      load();
    } catch (err) {
      notify(err.response?.data?.error || "Failed to delete question", "error");
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  };

  const useTemplate = (templateQuestion) => {
    setForm(f => ({
      ...f,
      question: templateQuestion,
      category: f.setupType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      topic: f.setupType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  };

  const getNextSunday = () => {
    const today = new Date();
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - today.getDay()));
    return nextSunday.toISOString().split('T')[0];
  };

  const getNextMonthFirst = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  };

  const getNextMonthLast = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return nextMonth.toISOString().split('T')[0];
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const getDefaultDate = (setupType) => {
    switch (setupType) {
      case "weekly_reflection": return getNextSunday();
      case "monthly_goals": return getNextMonthFirst();
      case "monthly_reflection": return getNextMonthLast();
      case "story_summary": return getTodayDate();
      case "picture_description": return getTodayDate();
      default: return "";
    }
  };

  const setupTypeLabels = {
    weekly_reflection: "Weekly Reflection (Sunday)",
    monthly_goals: "Monthly Goals (1st of month)",
    monthly_reflection: "Monthly Reflection (Last day of month)",
    story_summary: "Story Summary (scheduled time)",
    picture_description: "Picture Description (scheduled time)"
  };

  const groupedQuestions = {
    weekly_reflection: manualQuestions.filter(q => q.setupType === "weekly_reflection"),
    monthly_goals: manualQuestions.filter(q => q.setupType === "monthly_goals"),
    monthly_reflection: manualQuestions.filter(q => q.setupType === "monthly_reflection"),
    story_summary: manualQuestions.filter(q => q.setupType === "story_summary"),
    picture_description: manualQuestions.filter(q => q.setupType === "picture_description"),
  };

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "5rem", right: "1rem", zIndex: 9999,
          background: toast.type === "error" ? "#7f1d1d" : "#065f46",
          border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(74,222,128,0.4)"}`,
          color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 12,
          fontSize: "0.9rem", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          animation: "slideUpIn 0.3s ease",
        }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>📝 Manual Questions</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
            Setup custom questions, reflections, and story listening tasks
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            background: showForm ? "rgba(248,113,113,0.15)" : "linear-gradient(135deg,#7c6fff,#4f46e5)",
            border: showForm ? "1px solid rgba(248,113,113,0.3)" : "none",
            color: showForm ? "#f87171" : "#fff",
            borderRadius: 12, padding: "0.65rem 1.25rem",
            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {showForm ? "✕ Cancel" : "+ Setup Question"}
        </button>
      </div>

      {/* Setup form */}
      {showForm && (
        <div style={{
          background: "linear-gradient(135deg, rgba(124,111,255,0.08), rgba(79,70,229,0.05))",
          border: "1px solid rgba(124,111,255,0.25)",
          borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <div style={{ fontWeight: 700, marginBottom: "1rem", fontSize: "1rem" }}>📝 Setup Manual Question</div>
          <form onSubmit={setupQuestion}>
            <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
              <div>
                <label className="form-label">Question Type *</label>
                <select 
                  className="form-input" 
                  required
                  value={form.setupType} 
                  onChange={e => {
                    const newType = e.target.value;
                    setForm(f => ({ 
                      ...f, 
                      setupType: newType,
                      scheduledFor: getDefaultDate(newType),
                      scheduledTime: newType === "story_summary" ? getCurrentTime() : newType === "picture_description" ? getCurrentTime() : f.scheduledTime,
                      category: newType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      topic: newType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      question: newType === "story_summary" ? "Listen to the story audio and record a short video summary in your own words." : newType === "picture_description" ? "Describe what you see in the image. Mention the people, setting, and actions. Share what you think might be happening." : f.question
                    }));
                    setSelectedTemplate("");
                  }}
                >
                  {Object.entries(setupTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Scheduled Date *</label>
                <input 
                  className="form-input" 
                  type="date" 
                  required
                  value={form.scheduledFor} 
                  onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))} 
                />
              </div>
              <div>
                <label className="form-label">Scheduled Time {form.setupType === "story_summary" || form.setupType === "picture_description" ? "*" : "(optional)"}</label>
                <input
                  className="form-input"
                  type="time"
                  required={form.setupType === "story_summary" || form.setupType === "picture_description"}
                  value={form.scheduledTime}
                  onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Template selector */}
            {templates[form.setupType] && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="form-label">Use Template (optional)</label>
                <select 
                  className="form-input"
                  value={selectedTemplate}
                  onChange={e => {
                    setSelectedTemplate(e.target.value);
                    if (e.target.value) {
                      useTemplate(e.target.value);
                    }
                  }}
                >
                  <option value="">Select a template...</option>
                  {templates[form.setupType].map((template, i) => (
                    <option key={i} value={template}>{template.slice(0, 60)}...</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
              <div>
                <label className="form-label">Category *</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Weekly Reflection" 
                  required
                  value={form.category} 
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))} 
                />
              </div>
              <div>
                <label className="form-label">Topic *</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Weekly Progress Review" 
                  required
                  value={form.topic} 
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} 
                />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label className="form-label">Question *</label>
              <textarea 
                className="form-input" 
                rows={3}
                placeholder="Enter your custom question..."
                required
                value={form.question} 
                onChange={e => setForm(f => ({ ...f, question: e.target.value }))} 
              />
            </div>
            {form.setupType === "story_summary" && (
              <>
                <div style={{ marginBottom: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={generatingStory}
                    onClick={handleGenerateStory}
                    style={{ width: "100%", marginBottom: "0.75rem", background: "linear-gradient(135deg,#0f766e,#0d9488)" }}
                  >
                    {generatingStory ? "✨ Generating story…" : "✨ AI Generate Story"}
                  </button>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Story Audio URL *</label>
                  <input
                    className="form-input"
                    type="url"
                    placeholder="https://.../story.mp3"
                    required
                    value={form.audioUrl}
                    onChange={e => setForm(f => ({ ...f, audioUrl: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={generatingAudio}
                    onClick={handleGenerateAudio}
                    style={{ marginTop: "0.5rem", width: "100%", color: "#22d3ee", borderColor: "rgba(6,182,212,0.4)" }}
                  >
                    {generatingAudio ? "🔊 Generating audio…" : "🔊 Generate Audio from Story"}
                  </button>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Story Transcript (optional)</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Paste the story text here for better AI summary scoring..."
                    value={form.storyTranscript}
                    onChange={e => setForm(f => ({ ...f, storyTranscript: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Expected Summary / Key Points (optional)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Key points students should mention..."
                    value={form.summaryGuide}
                    onChange={e => setForm(f => ({ ...f, summaryGuide: e.target.value }))}
                  />
                </div>
              </>
            )}
            {form.setupType === "picture_description" && (
              <>
                <div style={{ marginBottom: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={generatingPicture}
                    onClick={handleGeneratePicture}
                    style={{ width: "100%", marginBottom: "0.5rem", background: "linear-gradient(135deg,#1e40af,#1d4ed8)" }}
                  >
                    {generatingPicture ? "🖼️ Generating picture challenge…" : "🖼️ AI Generate Picture Challenge"}
                  </button>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", textAlign: "center" }}>
                    Generates topic, instructions, and fetches a Pexels image automatically. You can edit any field before saving.
                  </div>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="form-label">Image URL * <span style={{ color: "var(--muted)", fontWeight: 400 }}>(direct photo link)</span></label>
                  <input
                    className="form-input"
                    type="url"
                    placeholder="https://images.pexels.com/photos/..."
                    required
                    value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  />
                  {form.imageUrl && (
                    <img
                      src={form.imageUrl}
                      alt="preview"
                      style={{ marginTop: "0.5rem", width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(99,179,237,0.3)" }}
                      onError={e => { e.target.style.display = "none"; }}
                    />
                  )}
                </div>
                <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
                  <div>
                    <label className="form-label">Photographer Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. John Smith"
                      value={form.imagePhotographer}
                      onChange={e => setForm(f => ({ ...f, imagePhotographer: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Image Source</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Pexels"
                      value={form.imageSource}
                      onChange={e => setForm(f => ({ ...f, imageSource: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
                  <div>
                    <label className="form-label">Pexels Photo Page URL</label>
                    <input
                      className="form-input"
                      type="url"
                      placeholder="https://www.pexels.com/photo/..."
                      value={form.imagePageUrl}
                      onChange={e => setForm(f => ({ ...f, imagePageUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Photographer Profile URL</label>
                    <input
                      className="form-input"
                      type="url"
                      placeholder="https://www.pexels.com/@..."
                      value={form.imagePhotographerUrl}
                      onChange={e => setForm(f => ({ ...f, imagePhotographerUrl: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Speaking Instructions (optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Describe what you see. Mention who is in the image, what they are doing, and what the setting feels like."
                    value={form.imageInstructions}
                    onChange={e => setForm(f => ({ ...f, imageInstructions: e.target.value }))}
                  />
                </div>
              </>
            )}
            <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 160 }}>
              {saving ? "Setting up…" : "📝 Setup Question"}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {/* Scheduled Questions */}
      {!loading && (
        <>
          {Object.entries(groupedQuestions).map(([type, questions]) => (
            questions.length > 0 && (
              <div key={type} style={{ marginBottom: "1.5rem" }}>
                <div style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 700, 
                  color: "#7c6fff", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.08em", 
                  marginBottom: "0.75rem" 
                }}>
                  📝 {setupTypeLabels[type]}
                </div>
                {questions.map(q => (
                  <div key={q._id} style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid rgba(124,111,255,0.25)",
                    borderRadius: 14, 
                    padding: "1rem 1.25rem",
                    marginBottom: "0.75rem",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>{q.topic}</span>
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem",
                            borderRadius: 20, textTransform: "uppercase",
                            background: "rgba(124,111,255,0.15)",
                            color: "#7c6fff",
                          }}>
                            Manual
                          </span>
                        </div>

                        <div style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: "0.4rem", lineHeight: 1.4 }}>
                          {q.question}
                        </div>
                        {q.audioUrl && (
                          <div style={{ fontSize: "0.78rem", color: "#2dd4bf", marginBottom: "0.4rem", wordBreak: "break-all" }}>
                            🎧 {q.audioUrl}
                          </div>
                        )}
                        {q.imageUrl && (
                          <div style={{ fontSize: "0.78rem", color: "#90cdf4", marginBottom: "0.4rem", wordBreak: "break-all" }}>
                            🖼️ {q.imageUrl}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--muted)", flexWrap: "wrap" }}>
                          <span>📅 {new Date(q.scheduledFor).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                          <span>⏰ {q.scheduledTime || new Date(q.scheduledFor).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>👤 {q.createdBy}</span>
                          <span>📂 {q.category}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
                        <button
                          onClick={() => deleteQuestion(q._id)}
                          disabled={busy[q._id]}
                          style={{
                            background: "rgba(248,113,113,0.12)",
                            border: "1px solid rgba(248,113,113,0.3)",
                            color: "#f87171", borderRadius: 10,
                            padding: "0.5rem 0.85rem", fontWeight: 700, fontSize: "0.82rem",
                            cursor: "pointer", whiteSpace: "nowrap",
                            opacity: busy[q._id] ? 0.5 : 1
                          }}
                        >
                          {busy[q._id] ? "Deleting…" : "✕ Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ))}

          {manualQuestions.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>No manual questions scheduled</div>
              <div style={{ fontSize: "0.85rem" }}>Click "+ Setup Question" to create custom weekly, monthly, or story tasks</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
