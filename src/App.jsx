import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";

/* ======================================================
   Firebase
====================================================== */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  setLogLevel,
} from "firebase/firestore";

/* ======================================================
   Runtime config (Render / index.html)
====================================================== */
const rawAppId = window.__app_id || "default-fresh-market";
const APP_ID_SEGMENT = rawAppId.split("/")[0].split("_").slice(0, 2).join("_");
const FIREBASE_APP_ID = APP_ID_SEGMENT.includes("c_")
  ? APP_ID_SEGMENT
  : "default-fresh-market";

const firebaseConfig = window.__firebase_config;
const initialAuthToken = window.__initial_auth_token;

/* ======================================================
   Firebase instances
====================================================== */
let db = null;
let auth = null;

/* ======================================================
   VI Colors
====================================================== */
const COLORS = {
  TECH_BLUE: "#007BFF",
  FRESH_GREEN: "#28A745",
  ACTION_ORANGE: "#FF8800",
};

/* ======================================================
   Mock products（首次初始化用）
====================================================== */
const MOCK_PRODUCTS = [
  { id: "p001", name: "有機菠菜", price: 45, unit: "包", category: "葉菜類", icon: "🥬" },
  { id: "p002", name: "高山高麗菜", price: 80, unit: "顆", category: "葉菜類", icon: "🥗" },
  { id: "p003", name: "空心菜", price: 35, unit: "把", category: "葉菜類", icon: "🍃" },
  { id: "p004", name: "小黃瓜", price: 50, unit: "條", category: "瓜果類", icon: "🥒" },
  { id: "p005", name: "牛番茄", price: 75, unit: "盒", category: "瓜果類", icon: "🍅" },
  { id: "p006", name: "日本南瓜", price: 90, unit: "個", category: "瓜果類", icon: "🎃" },
];

/* ======================================================
   Global Context
====================================================== */
const AppContext = React.createContext();

/* ======================================================
   UI Components（一定要在 App 前宣告）
====================================================== */
const NavButton = ({ page, currentPage, setPage, children }) => {
  const active = page === currentPage;
  return (
    <button
      onClick={() => setPage(page)}
      className={`px-4 py-2 rounded-lg font-semibold transition ${
        active ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
};

/* ======================================================
   AppProvider（完整功能保留）
====================================================== */
const AppProvider = ({ children }) => {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState(null);

  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    address: "",
    favorites: [],
  });

  /* ---------------- Auth ---------------- */
  useEffect(() => {
    if (!firebaseConfig) return;

    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel("error");

    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setUserId(u.uid);
        setIsAuthReady(true);
      } else {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      }
    });
  }, []);

  /* ---------------- Products ---------------- */
  useEffect(() => {
    if (!db) return;
    const ref = collection(db, "artifacts", FIREBASE_APP_ID, "public", "data", "products");

    return onSnapshot(ref, (snap) => {
      if (snap.empty) {
        MOCK_PRODUCTS.forEach((p) => setDoc(doc(ref, p.id), p));
        setProducts(MOCK_PRODUCTS);
      } else {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    });
  }, []);

  /* ---------------- Profile ---------------- */
  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "profile", "data");

    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setUserProfile({ ...snap.data(), favorites: snap.data().favorites || [] });
      } else {
        setDoc(ref, { name: "", email: "", address: "", favorites: [] });
      }
    });
  }, [userId]);

  /* ---------------- Cart ---------------- */
  useEffect(() => {
    if (!db || !userId) return;
    const ref = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current");

    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const map = {};
        (snap.data().items || []).forEach((i) => (map[i.id] = i));
        setCart(map);
      } else {
        setCart({});
      }
    });
  }, [userId]);

  /* ---------------- Orders ---------------- */
  useEffect(() => {
    if (!db || !userId) return;
    const ref = collection(db, "artifacts", FIREBASE_APP_ID, "users", userId, "orders");

    return onSnapshot(ref, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [userId]);

  /* ---------------- Cart actions ---------------- */
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [cartItems]
  );

  const addItemToCart = (p) => {
    const next = { ...cart };
    next[p.id] = next[p.id]
      ? { ...next[p.id], quantity: next[p.id].quantity + 1 }
      : { ...p, quantity: 1 };
    setCart(next);
    setDoc(
      doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current"),
      { items: Object.values(next), updatedAt: serverTimestamp() }
    );
  };

  const checkout = async () => {
    await addDoc(
      collection(db, "artifacts", FIREBASE_APP_ID, "users", userId, "orders"),
      { items: cartItems, total: cartTotal, timestamp: serverTimestamp() }
    );
    await setDoc(
      doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current"),
      { items: [] }
    );
  };

  return (
    <AppContext.Provider
      value={{
        page,
        setPage,
        user,
        userId,
        isAuthReady,
        products,
        cartItems,
        cartTotal,
        addItemToCart,
        checkout,
        orders,
        userProfile,
        setNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

/* ======================================================
   Screens（保留功能）
====================================================== */
const LoginScreen = () => {
  const { setPage } = useContext(AppContext);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <button
        className="px-6 py-3 rounded-xl bg-orange-500 text-white"
        onClick={() => setPage("dashboard")}
      >
        登入
      </button>
    </div>
  );
};

const Dashboard = () => {
  const { setPage } = useContext(AppContext);
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📊 今日採購總覽</h2>
      <button onClick={() => setPage("shop")} className="underline text-blue-600">
        前往商品選購
      </button>
    </div>
  );
};

/* ======================================================
   App（乾淨版）
====================================================== */
const App = () => {
  const { page, setPage } = useContext(AppContext);

  if (page === "login") return <LoginScreen />;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto p-4 flex justify-between">
          <h1 className="font-bold text-green-600">VeggieTech B2B</h1>
          <div>
            <NavButton page="dashboard" currentPage={page} setPage={setPage}>
              首頁
            </NavButton>
            <NavButton page="shop" currentPage={page} setPage={setPage}>
              商品
            </NavButton>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {page === "dashboard" && <Dashboard />}
        {page === "shop" && <div>（這裡仍是你原本的 ShopScreen）</div>}
      </main>
    </div>
  );
};

/* ======================================================
   Export
====================================================== */
export default () => (
  <AppProvider>
    <App />
  </AppProvider>
);
