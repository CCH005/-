import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef
} from "react";

// Firebase 核心套件
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
} from "firebase/auth";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

// ==========================================
// 1. 系統配置與常數定義
// ==========================================

const parseFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined') {
      const raw = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
      if (raw && raw.apiKey) return raw;
    }
  } catch (err) {
    console.warn("Failed to parse __firebase_config", err);
  }
  return null;
};

const firebaseConfig = parseFirebaseConfig() || { apiKey: "", authDomain: "cch5-4af59.firebaseapp.com", projectId: "cch5-4af59" };

// 修正：直接使用系統提供的 __app_id，避免路徑權限錯誤
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : "default-fresh-market";
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// 使用 rawAppId 作為路徑根目錄，確保符合 Rule 1
const FIREBASE_APP_ID = rawAppId;

const ADMIN_COLLECTION_PATH = ["artifacts", FIREBASE_APP_ID, "admin", "data"];
const USER_ROOT_PATH = ["artifacts", FIREBASE_APP_ID, "users"];

// Google Sheet API
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyOiHAlGKaACDYnjluexUkvEMVetf1566cvdlot9GZrqdv_UOSHQmSTGjmTpZIlZP5A/exec";

// Admin 憑證
const ADMIN_CREDENTIALS = {
  account: "vtadmin",
  password: "1688"
};

const INITIAL_USER_PROFILE = {
  name: "",
  email: "",
  address: "",
  favorites: [],
  role: "member",
  permission: "general",
};

// 初始化 Firebase（若環境未提供 config，退回本地模式以避免空白頁）
let app = null;
let auth = null;
let db = null;

try {
  if (firebaseConfig?.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("Firebase config missing apiKey; skip remote init and use local data.");
  }
} catch (err) {
  console.error("Firebase initialization failed", err);
}


// --- VI 色票 ---
const COLORS = {
  TECH_BLUE: "#007BFF",
  FRESH_GREEN: "#28A745",
  ACTION_ORANGE: "#FF8800",
  BG_GRAY: "#F8FAFC",
  TEXT_MAIN: "#0F172A",
  TEXT_SUB: "#64748B",
  BORDER: "#E2E8F0"
};

const CATEGORY_EMOJI_MAP = { "葉菜類": "🥬", "根莖類": "🍠", "瓜果類": "🥒", "菇類": "🍄", "其他": "🥗" };
const withCategoryEmoji = p => ({
  ...p,
  displayIcon: p.icon || CATEGORY_EMOJI_MAP[p.category] || "📦"
});


const normalizeTimestamp = raw => {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw;
  if (typeof raw?.seconds === "number") return Timestamp.fromDate(new Date(raw.seconds * 1000));
  return null;
};

const normalizeMember = (member) => ({
  ...member,
  permission: member?.permission || "general",
});

// Fallback Data
const MOCK_PRODUCTS = [
  { id: "p001", name: "有機菠菜", price: 45, unit: "包", category: "葉菜類", icon: "🥬", stock: 50 },
  { id: "p002", name: "高山高麗菜", price: 80, unit: "顆", category: "葉菜類", icon: "🥗", stock: 30 },
  { id: "p003", name: "空心菜", price: 35, unit: "把", category: "葉菜類", icon: "🍃", stock: 40 },
  { id: "p004", name: "小黃瓜", price: 50, unit: "條", category: "瓜果類", icon: "🥒", stock: 25 },
  { id: "p005", name: "牛番茄", price: 75, unit: "盒", category: "瓜果類", icon: "🍅", stock: 15 },
  { id: "p006", name: "日本南瓜", price: 90, unit: "個", category: "瓜果類", icon: "🎃", stock: 10 },
  { id: "p007", name: "紅蘿蔔", price: 40, unit: "袋", category: "根莖類", icon: "🥕", stock: 60 },
  { id: "p008", name: "馬鈴薯", price: 65, unit: "袋", category: "根莖類", icon: "🥔", stock: 45 }
];

// ==========================================
// 2. 全域樣式 (CSS in JS)
// ==========================================
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    :root { --header-height: 85px; }
    body { margin: 0; font-family: 'Inter', 'Noto Sans TC', sans-serif; background: ${COLORS.BG_GRAY}; color: ${COLORS.TEXT_MAIN}; overflow-x: hidden; }
    
    body::before {
      content: ""; position: fixed; inset: 0; z-index: -1; opacity: 0.15;
      background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 32px 32px;
    }

    .glass-nav { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px) saturate(180%); border-bottom: 1px solid rgba(0,0,0,0.05); }
    .glass-card { background: rgba(255, 255, 255, 0.95); border-radius: 32px; border: 1px solid rgba(255,255,255,0.8); transition: all 0.3s ease; }
    
    .shadow-tech { box-shadow: 0 20px 40px -10px rgba(0, 123, 255, 0.15); }
    .shadow-fresh { box-shadow: 0 20px 40px -10px rgba(40, 167, 69, 0.15); }
    .card-shadow { box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05); }
    .card-shadow-hover:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.12); }

    .btn-orange { background: linear-gradient(135deg, ${COLORS.ACTION_ORANGE}, #FF6B00); color: white; border: none; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 20px ${COLORS.ACTION_ORANGE}30; }
    .btn-orange:hover { filter: brightness(1.1); transform: scale(1.05); }
    .btn-orange:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

    .btn-blue { background: ${COLORS.TECH_BLUE}; color: white; border: none; border-radius: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .btn-blue:hover { filter: brightness(1.1); transform: translateY(-1px); }

    .btn-blue-outline { background: white; color: ${COLORS.TECH_BLUE}; border: 2px solid ${COLORS.TECH_BLUE}; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; padding: 10px 20px; }
    .btn-blue-outline:hover { background: ${COLORS.TECH_BLUE}08; transform: translateY(-1px); }
    
    .btn-danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 12px; font-weight: 700; cursor: pointer; padding: 6px 14px; transition: all 0.2s; }
    .btn-danger:hover { background: #fecaca; }

    .modern-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
    .modern-table th { padding: 16px 20px; text-align: left; color: #94A3B8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }
    .modern-table td { padding: 16px 20px; background: rgba(255,255,255,0.9); border-top: 1px solid ${COLORS.BORDER}; border-bottom: 1px solid ${COLORS.BORDER}; vertical-align: middle; }
    .modern-table td:first-child { border-left: 1px solid ${COLORS.BORDER}; border-top-left-radius: 16px; border-bottom-left-radius: 16px; }
    .modern-table td:last-child { border-right: 1px solid ${COLORS.BORDER}; border-top-right-radius: 16px; border-bottom-right-radius: 16px; }

    .form-input { width: 100%; padding: 14px; border-radius: 14px; border: 1px solid ${COLORS.BORDER}; background: #F8FAFC; outline: none; font-size: 14px; transition: all 0.2s; }
    .form-input:focus { border-color: ${COLORS.TECH_BLUE}; background: white; box-shadow: 0 0 0 3px rgba(0,123,255,0.1); }
    
    .status-pill { padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; display: inline-block; white-space: nowrap; }
    .is-done { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
    .is-processing { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
    .is-disabled { background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }

    .login-shell { min-height: calc(100vh - 120px); padding: 20px; display: flex; align-items: center; }
    .login-page { display: grid; grid-template-columns: 1fr; gap: 24px; width: 100%; max-width: 1100px; margin: 0 auto; }
    .login-hero { display: flex; flex-direction: column; gap: 16px; }
    .login-metrics { display: grid; grid-template-columns: 1fr; gap: 14px; }
    .login-card { width: 100%; }

    @media (min-width: 960px) {
      .login-shell { padding: 40px 60px; }
      .login-page { grid-template-columns: 1.1fr 0.9fr; align-items: center; gap: 40px; }
      .login-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .login-card { max-width: 520px; justify-self: end; }
    }
    .brand-logo-container { border: none; background: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 8px 16px; border-radius: 20px; transition: transform 0.2s; }
    .brand-logo-container:hover { transform: scale(1.02); background: rgba(0,123,255,0.03); }
    .logo-text-group { display: flex; align-items: center; }
    .logo-word-veggie { color: ${COLORS.TECH_BLUE}; font-weight: 900; }
    .logo-word-tech { color: ${COLORS.FRESH_GREEN}; font-weight: 900; font-style: italic; }
    .logo-divider { width: 2px; background: #E2E8F0; margin: 0 14px; border-radius: 1px; }
    .logo-word-direct { color: #94A3B8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.25em; font-size: 0.7em; opacity: 0.8; }
    
    .animate-slide-in { animation: slideIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
  `}} />
);

// --- 品牌 LOGO 組件 (橫向版) ---
const BrandLogo = ({ size = "normal" }) => {
  const { setPage } = useContext(AppContext);
  const fontSize = size === "large" ? "42px" : "28px";
  const iconSize = size === "large" ? 64 : 42;
  const dividerHeight = size === "large" ? "36px" : "24px";

  return (
    <div className="brand-logo-container" onClick={() => setPage("shop")}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill="none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,123,255,0.18))' }}>
          <rect width="40" height="40" rx="10" fill="url(#logo_grad_v5)" />
          <circle cx="10" cy="10" r="1.5" fill="white" fillOpacity="0.4" />
          <circle cx="30" cy="30" r="1.5" fill="white" fillOpacity="0.4" />
          <path d="M20 7C20 7 11 16 11 25C11 29.9706 15.0294 34 20 34C24.9706 34 29 29.9706 29 25C29 16 20 7 20 7Z" fill="white" />
          <path d="M20 31V19M20 25L25 20" stroke={COLORS.FRESH_GREEN} strokeWidth="3" strokeLinecap="round" />
          <defs>
            <linearGradient id="logo_grad_v5" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor={COLORS.TECH_BLUE} />
              <stop offset="1" stopColor={COLORS.FRESH_GREEN} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="logo-text-group" style={{ fontSize, lineHeight: 1 }}>
        <span className="logo-word-veggie">Veggie</span>
        <span className="logo-word-tech">Tech</span>
        <div className="logo-divider" style={{ height: dividerHeight }}></div>
        <span className="logo-word-direct">Direct</span>
      </div>
    </div>
  );
};

// ==========================================
// 3. 邏輯核心 (AppContext)
// ==========================================
const AppContext = React.createContext();

const AppProvider = ({ children }) => {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // Data States
  const [products, setProducts] = useState(MOCK_PRODUCTS.map(withCategoryEmoji));
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]); 
  const [members, setMembers] = useState([]); 
  const [userProfile, setUserProfile] = useState(INITIAL_USER_PROFILE);
  
  const [adminSession, setAdminSession] = useState({ isAuthenticated: false });
  const [notification, setNotification] = useState({ message: "", type: "info" });
  const [sheetSyncStatus, setSheetSyncStatus] = useState({ state: "idle", message: "" });
  const LOCAL_MEMBERS_KEY = "local_members";
  const hasSyncedLocalMembers = useRef(false);
  
  const persistLocalMembers = useCallback((nextMembers) => {
    setMembers(prev => {
      const next = typeof nextMembers === "function" ? nextMembers(prev) : nextMembers;
      if (typeof window !== "undefined") {
         window.localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
        const savedSession = window.localStorage.getItem("admin_session");
        if (savedSession) setAdminSession(JSON.parse(savedSession));
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("admin_session", JSON.stringify(adminSession));
  }, [adminSession]);

  // 當未連線 Firestore 時，使用 localStorage 存取會員資料，避免後台失效
  useEffect(() => {
    if (db) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCAL_MEMBERS_KEY);
    if (stored) {
      try { setMembers(JSON.parse(stored).map(normalizeMember)); }
      catch (err) { console.warn("Failed to parse local members", err); }
    }
  }, [db]);
  // 將離線裝置建立的會員同步到 Firestore，避免跨裝置登入失敗
  
  useEffect(() => {
    if (!db || hasSyncedLocalMembers.current) return;

    const syncMembers = async () => {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(LOCAL_MEMBERS_KEY);
      if (!stored) return;

      try {
        const parsed = JSON.parse(stored);
        const normalized = Array.isArray(parsed) ? parsed.map(normalizeMember) : [];
        if (normalized.length === 0) return;

        const memberRef = collection(db, ...ADMIN_COLLECTION_PATH, "members");
        for (const member of normalized) {
          const id = member.id || `m_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
          await setDoc(
            doc(memberRef, id),
            { ...member, id, createdAt: member.createdAt || serverTimestamp() },
            { merge: true }
          );
        }

        hasSyncedLocalMembers.current = true;
        window.localStorage.removeItem(LOCAL_MEMBERS_KEY);
        setNotification({ message: "已同步本機會員至雲端，可跨裝置登入", type: "info" });
      } catch (err) {
        console.error("Sync local members failed", err);
      }
    };

    syncMembers();
  }, [db, setNotification]);
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth) return;
        if (initialAuthToken) {
          try { await signInWithCustomToken(auth, initialAuthToken); }
          catch { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error("Auth error", err); }
      finally { setIsAuthReady(true); }
    };

    if (auth) { initAuth(); }
    else { setIsAuthReady(true); }
  }, []);

  // Google Sheet Sync
  useEffect(() => {
    if (!SHEET_API_URL) return;
    const fetchSheet = async () => {
      setSheetSyncStatus({ state: "loading", message: "同步中..." });
      try {
        const res = await fetch(SHEET_API_URL);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.products || [];
        const normalized = rows.map((r, i) => ({
           id: r.id || `sheet-${i}`,
           name: r.name || r["品名"] || "未命名",
           price: Number(r.price || r["價格"] || 0),
           unit: r.unit || r["單位"] || "件",
           category: r.category || r["分類"] || "未分類",
           stock: Number(r.stock || 100),
           icon: r.icon
        })).filter(i => i.name).map(withCategoryEmoji);
        if (normalized.length > 0) { setProducts(normalized); setSheetSyncStatus({ state: "success", message: "同步成功" }); }
      } catch (err) { setSheetSyncStatus({ state: "error", message: "同步失敗" }); }
    };
    fetchSheet();
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsubProducts = onSnapshot(collection(db, ...PUBLIC_DATA_PATH, "products"), snap => {
       if (snap.empty) return;
       const list = snap.docs.map(d => withCategoryEmoji({ id: d.id, ...d.data() }));
       setProducts(list);
    }, err => console.log("Products snap error", err));

    const unsubAdminOrders = onSnapshot(collection(db, ...ADMIN_COLLECTION_PATH, "admin_orders"), snap => {
      setAdminOrders(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: normalizeTimestamp(d.data().timestamp) })));
    }, err => console.log("Admin orders snap error", err));

    const unsubMembers = onSnapshot(collection(db, ...ADMIN_COLLECTION_PATH, "members"), snap => {
      setMembers(snap.docs.map(d => normalizeMember({ id: d.id, ...d.data() })));
    }, err => console.log("Members snap error", err));

    return () => { unsubProducts(); unsubAdminOrders(); unsubMembers(); };
  }, [db]);

  useEffect(() => {
    if (!userId || !db) return;
    const profileRef = doc(db, ...USER_ROOT_PATH, userId, "profile", "data");
    const cartRef = doc(db, ...USER_ROOT_PATH, userId, "cart", "current");

    const unsubProfile = onSnapshot(profileRef, async snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(prev => ({ ...prev, ...normalizeMember(data) }));
        if (data.name && page === 'login') setPage("shop");
        } else {
        try {
          const baseProfile = user || {};
          await setDoc(profileRef, {
            ...INITIAL_USER_PROFILE,
            ...baseProfile,
            name: baseProfile.name || baseProfile.account || ""
          }, { merge: true });
        } catch (err) {
          console.log("Profile create error", err);
        }
      }
    }, err => console.log("Profile snap error", err));
    
    const unsubCart = onSnapshot(cartRef, async snap => {
      if (snap.exists() && snap.data().items) {
        const items = snap.data().items.map(withCategoryEmoji);
        setCart(items.reduce((acc, i) => ({ ...acc, [i.id]: i }), {}));
      }
      else {
        setCart({});
        try { await setDoc(cartRef, { items: [] }, { merge: true }); }
        catch (err) { console.log("Cart init error", err); }
      }
    }, err => console.log("Cart snap error", err));
    
    const unsubOrders = onSnapshot(collection(db, ...USER_ROOT_PATH, userId, "orders"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: normalizeTimestamp(d.data().timestamp) }));
      setOrders(list.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, err => console.log("User orders snap error", err));
    return () => { unsubProfile(); unsubCart(); unsubOrders(); };
  }, [userId, db, user, page]);

  const cartTotal = useMemo(() => Object.values(cart).reduce((s, i) => s + i.price * i.quantity, 0), [cart]);

  const addItemToCart = (p) => {
    if (!userId) return setNotification({ message: "請先登入", type: "error" });
    const newCart = { ...cart, [p.id]: cart[p.id] ? { ...cart[p.id], quantity: cart[p.id].quantity + 1 } : { ...p, quantity: 1 } };
    setCart(newCart);
    setDoc(doc(db, ...USER_ROOT_PATH, userId, "cart", "current"), { items: Object.values(newCart), updatedAt: serverTimestamp() }, { merge: true });
    setNotification({ message: `📦 ${p.name} 已加入`, type: "success" });
  };

  const adjustQty = (id, delta) => {
    const newCart = { ...cart };
    if (!newCart[id]) return;
    newCart[id].quantity += delta;
    if (newCart[id].quantity <= 0) delete newCart[id];
    setCart(newCart);
    setDoc(doc(db, ...USER_ROOT_PATH, userId, "cart", "current"), { items: Object.values(newCart) }, { merge: true });
  };

  const checkout = async () => {
    if (!userId || Object.keys(cart).length === 0) return;
    const newOrder = { timestamp: serverTimestamp(), total: cartTotal, items: Object.values(cart), status: "Processing", customerName: userProfile.name, customerUID: userId };
    try {
      await addDoc(collection(db, ...USER_ROOT_PATH, userId, "orders"), newOrder);
      await addDoc(collection(db, ...ADMIN_COLLECTION_PATH, "admin_orders"), newOrder);
      await setDoc(doc(db, ...USER_ROOT_PATH, userId, "cart", "current"), { items: [] });
      setNotification({ message: "訂單已提交！", type: "success" });
      setPage("profile");
    } catch (err) { console.error("Checkout error", err); }
  };

  const loginAdmin = (acc, pwd) => {
    if (acc.toLowerCase() === ADMIN_CREDENTIALS.account && pwd === ADMIN_CREDENTIALS.password) {
      setAdminSession({ isAuthenticated: true });
      setNotification({ message: "管理者登入成功", type: "success" });
      return true;
    }
    setNotification({ message: "帳密錯誤", type: "error" });
    return false;
  };

  const logoutAdmin = () => { setAdminSession({ isAuthenticated: false }); setPage("login"); };
  const logoutUser = () => {
    setUser(null);
    setUserId(null);
    setUserProfile(INITIAL_USER_PROFILE);
    setCart({});
    setOrders([]);
    setPage("login");
  };

  // --- Admin CRUD Actions ---
  const updateAdminOrder = async (id, status) => {
    await updateDoc(doc(db, ...ADMIN_COLLECTION_PATH, "admin_orders", id), { status });
    setNotification({ message: "狀態更新", type: "success" });
  };
  
  const deleteAdminOrder = async (id) => {
    if(!window.confirm("確定刪除？")) return;
    await deleteDoc(doc(db, ...ADMIN_COLLECTION_PATH, "admin_orders", id));
    setNotification({ message: "訂單已刪除", type: "info" });
  };

  const addMember = async (memberData) => {
    const account = (memberData.account || "").toLowerCase();
    if (!account || !memberData.password || !memberData.name) {
      setNotification({ message: "請完整填寫會員資料", type: "error" });
      return;
    }

    if (db) {
      const memberRef = collection(db, ...ADMIN_COLLECTION_PATH, "members");
      const existing = await getDocs(query(memberRef, where("account", "==", account)));
      if (!existing.empty) {
        setNotification({ message: "帳號已存在", type: "error" });
        return;
      }
    } else if (members.some(m => m.account === account)) {
      setNotification({ message: "帳號已存在", type: "error" });
      return;
    }

    const newId = `m_${Date.now()}`;
    const payload = {
      ...memberData,
      account,
      permission: memberData.permission || "general",
      role: "member",
      id: newId,
      status: 'active',
      createdAt: db ? serverTimestamp() : { seconds: Math.floor(Date.now()/1000) }
    };
    if (!db) {
      setNotification({ message: "資料庫未連線，禁止建立會員", type: "error" });
      return;
    }

    await setDoc(
      doc(db, ...ADMIN_COLLECTION_PATH, "members", newId),
      payload
    );

    setNotification({ message: "會員已新增", type: "success" });
  };

  const updateMember = async (id, data) => {
    if (db) {
      await updateDoc(doc(db, ...ADMIN_COLLECTION_PATH, "members", id), data);
    } else {
      persistLocalMembers(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    }
    setNotification({ message: "資料已更新", type: "success" });
  };

  const updateMemberStatus = async (id, status) => {
    if (db) {
      await updateDoc(doc(db, ...ADMIN_COLLECTION_PATH, "members", id), { status });
    } else {
      persistLocalMembers(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    }
    setNotification({ message: "狀態更新", type: "info" });
  };

  const deleteMember = async (id) => {
     if(!window.confirm("確定刪除此會員？")) return;
     if (db) {
       await deleteDoc(doc(db, ...ADMIN_COLLECTION_PATH, "members", id));
     } else {
       persistLocalMembers(prev => prev.filter(m => m.id !== id));
     }
     setNotification({ message: "會員已刪除", type: "warning" });
  };
  
  const updateUserProfile = async (data) => {
      if (!userId) return;
      await setDoc(doc(db, ...USER_ROOT_PATH, userId, "profile", "data"), data, { merge: true });
      setNotification({ message: "資料已儲存", type: "success" });
  };

  const value = {
    page, setPage, user, setUser, userId, setUserId, isAuthReady, products, cart: Object.values(cart), cartTotal,
    userProfile, setUserProfile, orders, adminOrders, members, notification, setNotification,
    addItemToCart, adjustQty, checkout, logoutUser, 
    adminSession, loginAdmin, logoutAdmin, 
    updateAdminOrder, deleteAdminOrder, addMember, updateMember, updateMemberStatus, deleteMember, updateUserProfile
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ==========================================
// 4. UI 頁面組件
// ==========================================

// Header
const Header = () => {
  const { setPage, page, cartTotal, userProfile, logoutUser, logoutAdmin, adminSession, userId } = useContext(AppContext);
  const isAdmin = adminSession.isAuthenticated;
  const isLoggedIn = Boolean(userId);

  return (
    <header className="header-shell glass-nav" style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', height: 'var(--header-height)', padding: '0 30px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <BrandLogo />
          {(isLoggedIn || isAdmin) && (
            <nav style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn-orange" onClick={() => setPage("cart")} style={{ padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛒
                <span style={{ fontWeight: 900 }}>購物車</span>
              </button>
             {(isAdmin || userProfile.role === 'admin') && <button onClick={() => setPage("admin")} style={{ border: 'none', background: 'none', color: page.startsWith("admin") || page === "members" || page === "orders" ? COLORS.TECH_BLUE : COLORS.TEXT_SUB, fontWeight: 800, cursor: 'pointer', fontSize: '14px' }}>營運後台</button>}
            </nav>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {isAdmin ? (
             <button className="btn-blue-outline" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={logoutAdmin}>登出管理</button>
          ) : isLoggedIn ? (
            <>
              <button className="btn-blue-outline" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={logoutUser}>登出</button>
              <button className="btn-orange" style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 900 }} onClick={() => setPage("cart")}>🛒 NT$ {cartTotal}</button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
};

// Login Screen
const LoginScreen = () => {
  const { setUserProfile, setPage, loginAdmin, members, setUserId, setNotification, setUser } = useContext(AppContext);
  const [form, setForm] = useState({ acc: "", pwd: "" });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const account = form.acc.toLowerCase();
      if (account === ADMIN_CREDENTIALS.account) {
        if (loginAdmin(form.acc, form.pwd)) setPage("admin");
        return;
      }

      let member = null;
      if (!db) {
        setNotification({ message: "系統尚未就緒，請稍後再試", type: "error" });
        return;
      }

      const snap = await getDocs(
        query(
          collection(db, ...ADMIN_COLLECTION_PATH, "members"),
          where("account", "==", account)
        )
      );

      if (snap.empty) {
        setNotification({ message: "帳號不存在", type: "error" });
        return;
      }

      const docData = snap.docs[0];
      member = normalizeMember({ id: docData.id, ...docData.data() });

    if (member && member.password === form.pwd) {
        if (member.status !== 'active') {
          setNotification({ message: "帳號已停用", type: "error" });
        } else {
          const memberId = member.id;
          setUser(member);
          setUserId(memberId);
          setUserProfile({
            ...INITIAL_USER_PROFILE,
            ...member,
            name: member.name || member.account // ← 關鍵保險
          });

          if (db && memberId) {
            const profileRef = doc(db, ...USER_ROOT_PATH, memberId, "profile", "data");
            const profileSnap = await getDoc(profileRef);
            if (!profileSnap.exists()) {
              await setDoc(profileRef, {
                ...INITIAL_USER_PROFILE,
                name: member.name,
                email: member.email || "",
                address: member.address || "",
                role: member.role || "member",
                permission: member.permission || "general"
              }, { merge: true });
            }
          }
          setPage("shop");
          setNotification({ message: "歡迎回來", type: "success" });
        }
      } else {
         if (form.acc === "demo") {
          const demoMember = normalizeMember({ name: "演示會員", email: "demo@veggietech.com", role: "member", permission: "general", id: "demo" });
          setUser(demoMember);
          setUserId("demo");
          setUserProfile(demoMember);
          setPage("shop");
        } else {
          setNotification({ message: "帳號或密碼錯誤", type: "error" });
        }
      }
      } catch (err) {
      console.error("Login error", err);
      setNotification({ message: "登入失敗，請稍後再試", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="animate-slide-in login-page">
        <div className="login-hero">
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, lineHeight: 1.1, margin: 0, color: COLORS.TEXT_MAIN, letterSpacing: '-1.2px' }}>
            引領智慧<br/><span style={{ color: COLORS.TECH_BLUE }}>農業新標準</span>
          </h2>
          <p style={{ fontSize: '16px', color: COLORS.TEXT_SUB, lineHeight: 1.6, margin: 0, maxWidth: '540px', fontWeight: 600 }}>
            整合產地直供系統，透過智慧採購，降低成本與損耗，創造極致鮮度與採購優勢。
          </p>
          <div className="login-metrics">
            <div className="glass-card shadow-tech" style={{ padding: '20px 24px', borderLeft: `6px solid ${COLORS.TECH_BLUE}` }}>
              <h4 style={{ margin: '0 0 4px 0', color: COLORS.TECH_BLUE, fontSize: '28px', fontWeight: 900 }}>98.5%</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontWeight: 700 }}>配送準時率</p>
            </div>
            <div className="glass-card shadow-fresh" style={{ padding: '20px 24px', borderLeft: `6px solid ${COLORS.FRESH_GREEN}` }}>
              <h4 style={{ margin: '0 0 4px 0', color: COLORS.FRESH_GREEN, fontSize: '28px', fontWeight: 900 }}>24h</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontWeight: 700 }}>冷鏈即時追蹤</p>
            </div>
          </div>
        </div>
        <div className="glass-card shadow-tech login-card" style={{ padding: '32px', background: 'white', borderTop: `8px solid ${COLORS.TECH_BLUE}` }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 900 }}>系統登入</h3>
          <p style={{ color: COLORS.TEXT_SUB, marginBottom: '20px', fontWeight: 600, fontSize: '14px' }}>請輸入您的企業合作帳號</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input className="form-input" placeholder="企業帳號 / 員工編號" onChange={e => setForm({...form, acc: e.target.value})} />
            <input type="password" className="form-input" placeholder="密碼" onChange={e => setForm({...form, pwd: e.target.value})} />
            <button className="btn-orange" style={{ padding: '14px', fontSize: '16px' }} onClick={handleLogin} disabled={loading}>{loading ? "驗證中..." : "確認身份並進入"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Shop Screen
const ShopScreen = () => {
  const { products, addItemToCart } = useContext(AppContext);
  const [activeCat, setActiveCat] = useState("全部");
  const categories = ["全部", "葉菜類", "根莖類", "瓜果類", "限時優惠"];
  const filtered = activeCat === "全部" ? products : products.filter(p => p.category === activeCat);

  return (
    <div className="animate-slide-in">
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '10px 0 30px' }} className="custom-scrollbar">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCat(c)} style={{ padding: '10px 20px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap', fontWeight: 800, fontSize: '14px', cursor: 'pointer', background: activeCat === c ? COLORS.TECH_BLUE : 'white', color: activeCat === c ? 'white' : COLORS.TEXT_SUB, boxShadow: activeCat === c ? `0 10px 20px ${COLORS.TECH_BLUE}35` : '0 4px 10px rgba(0,0,0,0.03)', transition: 'all 0.4s' }}>{c}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
        {filtered.map(p => (
          <div
            key={p.id}
            className="glass-card card-shadow-hover"
            style={{
              padding: '28px',
              display: 'grid',
              gridTemplateRows: '200px auto auto',
              alignItems: 'stretch',
              gap: '16px'
            }}
          >
            <div
              style={{
                height: '200px',
                background: '#F8FAFC',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '88px',
                position: 'relative'
              }}
            >
              {p.displayIcon}
              <span style={{ position: 'absolute', top: '15px', right: '15px', fontSize: '11px', fontWeight: 900, color: p.stock < 20 ? '#EF4444' : '#16A34A', background: 'white', padding: '4px 10px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.05)' }}>{p.stock} 件</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 900, color: COLORS.TECH_BLUE, textTransform: 'uppercase', letterSpacing: '1px' }}>{p.category}</span>
              <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 900 }}>{p.name}</h3>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}><span style={{ fontSize: '24px', fontWeight: 900, color: COLORS.TEXT_MAIN }}>{p.price}</span><span style={{ fontSize: '13px', color: COLORS.TEXT_SUB, fontWeight: 700 }}>/{p.unit}</span></div>
              <button className="btn-orange" style={{ width: '52px', height: '52px', borderRadius: '16px', fontSize: '20px' }} onClick={() => addItemToCart(p)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cart Page
const CartSidebar = () => {
  const { cart, cartTotal, adjustQty, setPage, checkout } = useContext(AppContext);
  const hasItems = cart.length > 0;

  return (
    <div
      className="glass-card shadow-tech"
      style={{
        position: 'sticky',
        top: '120px',
        padding: '28px',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB }}>即時採購籃</p>
          <h3 style={{ margin: 0, fontWeight: 900 }}>🛒 NT$ {cartTotal}</h3>
        </div>
        <button className="btn-blue-outline" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setPage("cart")}>查看全部</button>
      </div>

      <div className="custom-scrollbar" style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '6px' }}>
        {hasItems ? (
          cart.map(item => (
            <div
              key={item.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '22px' }}>{item.displayIcon}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 900 }}>{item.name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: COLORS.TEXT_SUB, fontWeight: 700 }}>NT$ {item.price} / {item.unit}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button style={{ border: 'none', background: '#F1F5F9', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => adjustQty(item.id, -1)}>-</button>
                <span style={{ fontWeight: 900 }}>{item.quantity}</span>
                <button style={{ border: 'none', background: '#F1F5F9', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => adjustQty(item.id, 1)}>+</button>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', color: '#94A3B8', padding: '40px 0', fontWeight: 800 }}>目前沒有商品</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn-blue-outline" style={{ flex: 1, padding: '12px', fontWeight: 800 }} onClick={() => setPage("shop")}>繼續選購</button>
        <button className="btn-orange" style={{ flex: 1, padding: '12px', fontWeight: 800 }} disabled={!hasItems} onClick={checkout}>提交訂單</button>
      </div>
    </div>
  );
};

const CartScreen = () => {
  const { cart, cartTotal, adjustQty, checkout, setPage } = useContext(AppContext);
  return (
    <div className="animate-slide-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '24px' }}>
      <div className="glass-card shadow-tech" style={{ padding: '36px', borderRadius: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB, letterSpacing: '1px' }}>購物車</p>
            <h2 style={{ margin: '6px 0 0 0', fontWeight: 900, fontSize: '28px', color: COLORS.TECH_BLUE }}>採購清單</h2>
          </div>
        <button className="btn-blue-outline" onClick={() => setPage("shop")} style={{ fontSize: '13px', padding: '10px 16px' }}>返回商品</button>
        </div>

        <div className="custom-scrollbar" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94A3B8', padding: '50px 0', fontWeight: 800 }}>目前購物車沒有商品</p>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>{item.displayIcon}</span>
                  <div>
                    <p style={{ fontWeight: 900, margin: 0, fontSize: '16px' }}>{item.name}</p>
                    <p style={{ fontSize: '12px', color: COLORS.TEXT_SUB, margin: '4px 0 0 0', fontWeight: 700 }}>NT$ {item.price} / {item.unit}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button style={{ border: 'none', background: '#F1F5F9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer' }} onClick={() => adjustQty(item.id, -1)}>-</button>
                  <span style={{ fontWeight: 900, fontSize: '15px' }}>{item.quantity}</span>
                  <button style={{ border: 'none', background: '#F1F5F9', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer' }} onClick={() => adjustQty(item.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `2px dashed ${COLORS.BORDER}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <span style={{ color: COLORS.TEXT_SUB, fontWeight: 800, fontSize: '14px' }}>採購總預算</span>
            <span style={{ color: '#EF4444', fontSize: '30px', fontWeight: 900 }}>$ {cartTotal}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-blue-outline" style={{ flex: 1, padding: '14px', fontSize: '15px' }} onClick={() => setPage("shop")}>繼續選購</button>
            <button className="btn-orange" style={{ flex: 1, padding: '14px', fontSize: '15px' }} disabled={cart.length === 0} onClick={checkout}>發送智慧訂單</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const { products, adminOrders, members, setPage } = useContext(AppContext);
  const revenue = adminOrders.reduce((s,o) => s + (o.total || 0), 0);

  return (
    <div className="animate-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px' }}>營運控制中心</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-blue-outline" onClick={() => setPage("members")}>會員管理</button>
          <button className="btn-blue-outline" onClick={() => setPage("orders")}>訂單管理</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '30px', marginBottom: '50px' }}>
        <div className="glass-card shadow-tech" style={{ padding: '30px', borderRadius: '30px', borderLeft: `8px solid ${COLORS.TECH_BLUE}` }}>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB, textTransform: 'uppercase' }}>本日營收</p>
           <h3 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>NT$ {revenue.toLocaleString()}</h3>
        </div>
        <div className="glass-card shadow-fresh" style={{ padding: '30px', borderRadius: '30px', borderLeft: `8px solid ${COLORS.FRESH_GREEN}` }}>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB, textTransform: 'uppercase' }}>活躍夥伴</p>
           <h3 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{members.length || 0} Corp.</h3>
        </div>
        <div className="glass-card shadow-tech" style={{ padding: '30px', borderRadius: '30px', borderLeft: `8px solid #6366F1` }}>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB, textTransform: 'uppercase' }}>待處理訂單</p>
           <h3 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{adminOrders.length} 筆</h3>
        </div>
        <div className="glass-card shadow-fresh" style={{ padding: '30px', borderRadius: '30px', borderLeft: `8px solid #EF4444` }}>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: COLORS.TEXT_SUB, textTransform: 'uppercase' }}>庫存預警</p>
           <h3 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{products.filter(p=>p.stock<20).length} 項</h3>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '40px', borderRadius: '45px' }}>
        <h3 style={{ margin: '0 0 24px 0', fontWeight: 900, fontSize: '20px' }}>產地實時供應狀態</h3>
        <table className="modern-table">
          <thead><tr><th>品項規格</th><th>分類</th><th>在庫</th><th>供應等級</th><th>操作</th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                            <td style={{ fontWeight: 800 }}>{p.displayIcon} {p.name}</td>
                <td style={{ fontWeight: 700, color: COLORS.TEXT_SUB }}>{p.category}</td>
                <td style={{ fontWeight: 900 }}>{p.stock}</td>
                <td><span style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, background: p.stock > 15 ? '#DCFCE7' : '#FEE2E2', color: p.stock > 15 ? '#166534' : '#991B1B' }}>{p.stock > 15 ? '🟢 供應優質' : '🔴 庫存短缺'}</span></td>
                <td><button style={{ border: 'none', background: 'none', color: COLORS.TECH_BLUE, fontWeight: 900, cursor: 'pointer', fontSize: '13px' }}>編輯</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Admin Sub-pages: Member Management (Full Interactive)
const MemberManagement = () => {
    const { members, updateMemberStatus, setPage, addMember, updateMember, deleteMember } = useContext(AppContext);
    const [isAddMode, setIsAddMode] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [formData, setFormData] = useState({name:"", account:"", password:"", email:"", permission:"general"});
    const [searchTerm, setSearchTerm] = useState("");

    const filteredMembers = useMemo(() => members.filter(m => (m.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.account || "").toLowerCase().includes(searchTerm.toLowerCase())), [members, searchTerm]);

    const handleAdd = () => {
        if(!formData.account || !formData.password) return;
        addMember({...formData, role: 'member', permission: formData.permission || 'general'});
        setIsAddMode(false);
        setFormData({name:"", account:"", password:"", email:"", permission:"general"});
    };
    const handleEditStart = (m) => { setEditingMemberId(m.id); setFormData({name: m.name, account: m.account, password: m.password, email: m.email, permission: m.permission || 'general'}); };
    const handleEditSave = () => { updateMember(editingMemberId, formData); setEditingMemberId(null); setFormData({name:"", account:"", password:"", email:"", permission:"general"}); };

    return (
        <div className="animate-slide-in">
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '28px' }}>會員帳號管理</h3>
             <div style={{display:'flex', gap:'10px'}}>
                <button className="btn-orange" style={{padding:'8px 16px', fontSize:'13px'}} onClick={()=>setIsAddMode(!isAddMode)}>+ 新增會員</button>
                <button className="btn-blue-outline" onClick={() => setPage("admin")}>返回總覽</button>
             </div>
           </div>
           <div className="glass-card" style={{padding:'15px', marginBottom:'25px'}}>
             <input className="form-input" placeholder="🔍 搜尋會員姓名或帳號..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
           </div>
           {isAddMode && (
             <div className="glass-card shadow-tech" style={{padding:'25px', marginBottom:'25px', borderLeft:`6px solid ${COLORS.TECH_BLUE}`}}>
                <h4 style={{marginTop:0}}>新增企業會員</h4>
                <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'15px', marginBottom:'15px'}}>
                    <input className="form-input" placeholder="企業名稱" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                    <input className="form-input" placeholder="登入帳號" value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} />
                    <input className="form-input" placeholder="密碼" value={formData.password} onChange={e=>setFormData({...formData, password:e.target.value})} />
                    <input className="form-input" placeholder="Email" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} />
                    <select className="form-input" value={formData.permission} onChange={e=>setFormData({...formData, permission:e.target.value})}>
                      <option value="general">一般權限</option>
                      <option value="admin">管理權限</option>
                    </select>
                </div>
                <button className="btn-blue" style={{padding:'8px 20px'}} onClick={handleAdd}>確認新增</button>
             </div>
           )}
           <div className="glass-card" style={{ padding: '30px', borderRadius: '35px' }}>
             <table className="modern-table">
                <thead><tr><th>姓名</th><th>帳號</th><th>Email</th><th>權限</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                    {filteredMembers.map(m => (
                        <tr key={m.id}>
                            {editingMemberId === m.id ? (
                                <>
                                    <td><input className="form-input" style={{padding:'6px'}} value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} /></td>
                                    <td><input className="form-input" style={{padding:'6px'}} value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} /></td>
                                    <td><input className="form-input" style={{padding:'6px'}} value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} /></td>
                                    <td>
                                      <select className="form-input" style={{padding:'6px'}} value={formData.permission} onChange={e=>setFormData({...formData, permission:e.target.value})}>
                                        <option value="general">一般權限</option>
                                        <option value="admin">管理權限</option>
                                      </select>
                                    </td>
                                    <td>-</td>
                                    <td>
                                        <button className="btn-blue" style={{padding:'4px 10px', fontSize:'11px', marginRight:'6px'}} onClick={handleEditSave}>儲存</button>
                                        <button className="btn-blue-outline" style={{padding:'4px 10px', fontSize:'11px'}} onClick={()=>setEditingMemberId(null)}>取消</button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td style={{fontWeight:800}}>{m.name}</td>
                                    <td>{m.account}</td>
                                    <td>{m.email}</td>
                                    <td><span className="status-pill is-processing">{m.permission === 'admin' ? '管理權限' : '一般權限'}</span></td>
                                    <td><span className={`status-pill ${m.status==='disabled'?'is-disabled':'is-done'}`}>{m.status==='disabled'?'停用':'啟用'}</span></td>
                                    <td>
                                        <button className="btn-blue-outline" style={{padding:'4px 10px', fontSize:'11px', marginRight:'6px'}} onClick={()=>handleEditStart(m)}>編輯</button>
                                        <button className="btn-blue-outline" style={{padding:'4px 10px', fontSize:'11px', marginRight:'6px'}} onClick={()=>updateMemberStatus(m.id, m.status==='active'?'disabled':'active')}>{m.status==='active'?'停用':'啟用'}</button>
                                        <button className="btn-danger" style={{padding:'4px 10px', fontSize:'11px'}} onClick={()=>deleteMember(m.id)}>刪除</button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
             </table>
           </div>
        </div>
    );
};

const OrderManagement = () => {
    const { adminOrders, updateAdminOrder, deleteAdminOrder, setPage, members } = useContext(AppContext);
    const [filterMember, setFilterMember] = useState("all");
    const [startDate, setStartDate] = useState("");
    const filtered = adminOrders.filter(o => {
        const matchMem = filterMember === "all" || o.customerUID === filterMember;
        const matchDate = !startDate || (o.timestamp?.seconds * 1000 >= new Date(startDate).getTime());
        return matchMem && matchDate;
    });

    return (
        <div className="animate-slide-in">
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '28px' }}>訂單管理</h3>
             <button className="btn-blue-outline" onClick={() => setPage("admin")}>返回總覽</button>
           </div>
           <div className="glass-card" style={{padding:'20px', marginBottom:'25px', display:'flex', gap:'20px', alignItems:'center'}}>
              <div style={{flex:1}}>
                 <label style={{fontSize:'11px', fontWeight:800, color:COLORS.TEXT_SUB}}>篩選會員</label>
                 <select className="form-input" onChange={e=>setFilterMember(e.target.value)}>
                    <option value="all">全部會員</option>
                    {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                 </select>
              </div>
              <div style={{flex:1}}>
                 <label style={{fontSize:'11px', fontWeight:800, color:COLORS.TEXT_SUB}}>起始日期</label>
                 <input type="date" className="form-input" onChange={e=>setStartDate(e.target.value)} />
              </div>
           </div>
           <div className="glass-card" style={{ padding: '30px', borderRadius: '35px' }}>
             <table className="modern-table">
                <thead><tr><th>單號</th><th>客戶</th><th>金額</th><th>狀態</th><th>操作</th></tr></thead>
                <tbody>
                    {filtered.map(o => (
                        <tr key={o.id}>
                            <td style={{fontWeight:800}}>#{o.id ? o.id.slice(-6).toUpperCase() : 'N/A'}</td>
                            <td>{o.customerName}</td>
                            <td style={{fontWeight:900}}>NT$ {o.total}</td>
                            <td><span className={`status-pill ${o.status==='Processing'?'is-processing':'is-done'}`}>{o.status||'處理中'}</span></td>
                            <td style={{display:'flex', gap:'8px'}}>
                                <button className="btn-blue-outline" style={{padding:'4px 10px', fontSize:'11px'}} onClick={()=>updateAdminOrder(o.id, o.status==='Processing'?'已完成':'Processing')}>切換狀態</button>
                                <button className="btn-danger" style={{padding:'4px 10px', fontSize:'11px'}} onClick={()=>deleteAdminOrder(o.id)}>刪除</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
           </div>
        </div>
    );
};

// Profile Screen (Interactive)
const ProfileScreen = () => {
  const { userProfile, orders, updateUserProfile } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const displayName = userProfile.name || userProfile.account || "會員";
  
  useEffect(() => { setFormData(userProfile) }, [userProfile]);
  const handleSave = () => { updateUserProfile(formData); setIsEditing(false); };

  return (
    <div className="animate-slide-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '50px' }}>
        <div className="glass-card shadow-tech" style={{ padding: '45px', borderRadius: '45px', textAlign: 'center', height: 'fit-content' }}>
          <div style={{ width: '120px', height: '120px', background: 'linear-gradient(135deg, #007BFF, #28A745)', borderRadius: '40px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '50px', margin: '0 auto 30px', fontWeight: 900, boxShadow: '0 20px 40px rgba(0,123,255,0.3)' }}>{displayName.charAt(0)}</div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: 900 }}>{displayName}</h2>
          <p style={{ color: COLORS.TECH_BLUE, fontWeight: 800, marginBottom: '45px', letterSpacing: '2px' }}>Corporate VIP Member</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
            {isEditing ? (
                <>
                   <input className="form-input" placeholder="姓名" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} />
                   <input className="form-input" placeholder="信箱" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} />
                   <input className="form-input" placeholder="配送地址" value={formData.address} onChange={e=>setFormData({...formData, address:e.target.value})} />
                   <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                      <button className="btn-blue" style={{flex:1, padding:'10px'}} onClick={handleSave}>儲存</button>
                      <button className="btn-blue-outline" style={{flex:1, padding:'10px'}} onClick={()=>setIsEditing(false)}>取消</button>
                   </div>
                </>
            ) : (
                <>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8' }}>聯繫信箱</label>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '15px' }}>{userProfile.email}</p>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8' }}>預設冷鏈配送點</label>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '15px' }}>{userProfile.address}</p>
                    </div>
                    <button className="btn-blue" style={{ width: '100%', padding: '14px', marginTop: '15px', fontSize: '14px' }} onClick={()=>setIsEditing(true)}>編輯帳戶資料</button>
                </>
            )}
          </div>
        </div>
        <div className="glass-card shadow-fresh" style={{ padding: '40px' }}>
          <h3 style={{ margin: '0 0 30px 0', fontWeight: 900, fontSize: '22px' }}>智慧採購紀錄</h3>
          {orders.length === 0 ? <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>目前尚無採購數據紀錄</p> : orders.map(o => (
            <div key={o.id} style={{ padding: '20px', borderRadius: '20px', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
              <div><p style={{ margin: 0, fontWeight: 900, fontSize: '18px' }}>NT$ {o.total}</p><p style={{ fontSize: '12px', color: COLORS.TEXT_SUB }}>單號: {o.id}</p></div>
              <span style={{ padding: '8px 16px', borderRadius: '12px', background: '#DCFCE7', color: '#166534', fontWeight: 900, fontSize: '12px' }}>配送執行中</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main App
const App = () => {
  const { page, isAuthReady, notification, setNotification, userProfile, adminSession, userId } = useContext(AppContext);
  const isLoggedIn = Boolean(userId);
  const isAdmin = adminSession.isAuthenticated;
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: "", type: "info" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);

  if (!isAuthReady) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ fontSize: '80px', marginBottom: '20px', animation: 'spin 2s linear infinite' }}>🥬</div>
      <p style={{ fontWeight: 900, color: COLORS.TECH_BLUE, letterSpacing: '10px' }}>VEGGIETECH DIRECT</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '120px' }}>
      <GlobalStyles />
      <Header />
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '50px' }}>
        {(isLoggedIn || isAdmin) ? (
           <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', flex: 1 }}>
              {page === "shop" && <ShopScreen />}
              {page === "cart" && <CartScreen />}
              {page === "profile" && <ProfileScreen />}
              {page === "admin" && <AdminDashboard />}
              {page === "members" && <MemberManagement />}
              {page === "orders" && <OrderManagement />}
            </div>
            {page === "shop" && (
              <div style={{ width: '450px', flexShrink: 0 }}>
                <CartSidebar />
              </div>
            )}
          </div>
             
        ) : <LoginScreen />}
      </main>
      {notification.message && (
        <div className="animate-slide-in" style={{ position: 'fixed', bottom: '60px', left: '50%', transform: 'translateX(-50%)', background: COLORS.TEXT_MAIN, color: 'white', padding: '16px 40px', borderRadius: '20px', fontWeight: 900, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', zIndex: 2000 }}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default () => <AppProvider><App /></AppProvider>;
