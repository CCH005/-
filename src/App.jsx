import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback
} from "react";

// Firebase 核心套件
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
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
  setLogLevel
} from "firebase/firestore";

// --- 應用程式 ID 與 Firebase 配置 ---

// 讀取 index.html 注入的 runtime config
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : "default-fresh-market";
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase config (使用提供的 mock config，實際運行時會被 runtime 覆蓋)
const firebaseConfig = {
  apiKey: "AIzaSyA6Z4btAi6Sm0FItnUddFCRxQlgNt30YXs",
  authDomain: "cch5-4af59.firebaseapp.com",
  projectId: "cch5-4af59",
  storageBucket: "cch5-4af59.firebasestorage.app",
  messagingSenderId: "202863377560",
  appId: "1:202863377560:web:9c0515983f41c22d3aa4ed"
};

// appId 清洗以確保路徑安全
const APP_ID_SEGMENT = rawAppId.split("/")[0].split("_").slice(0, 2).join("_");
const FIREBASE_APP_ID = APP_ID_SEGMENT.includes("c_")
  ? APP_ID_SEGMENT
  : "default-fresh-market";

// Firebase 實例（由 useEffect 初始化）
let db = null;
let auth = null;

// --- VI 色票 ---
const COLORS = {
  TECH_BLUE: "#007BFF",    // 智慧、可靠 (主要：標題、導航)
  FRESH_GREEN: "#28A745",  // 有機、健康 (輔助：價格、成功提示)
  ACTION_ORANGE: "#FF8800", // 點綴、促銷 (CTA：加入/結帳)
  BG_GRAY: "#F8F9FA",
  BG_WHITE: "#FFFFFF"
};

// --- 預設商品資料 ---
const MOCK_PRODUCTS = [
  { id: "p001", name: "有機菠菜", price: 45, unit: "包", category: "葉菜類", icon: "🥬" },
  { id: "p002", name: "高山高麗菜", price: 80, unit: "顆", category: "葉菜類", icon: "🥗" },
  { id: "p003", name: "空心菜", price: 35, unit: "把", category: "葉菜類", icon: "🍃" },
  { id: "p004", name: "小黃瓜", price: 50, unit: "條", category: "瓜果類", icon: "🥒" },
  { id: "p005", name: "牛番茄", price: 75, unit: "盒", category: "瓜果類", icon: "🍅" },
  { id: "p006", name: "日本南瓜", price: 90, unit: "個", category: "瓜果類", icon: "🎃" },
  { id: "p007", name: "紅蘿蔔", price: 40, unit: "袋", category: "根莖類", icon: "🥕" },
  { id: "p008", name: "馬鈴薯", price: 65, unit: "袋", category: "根莖類", icon: "🥔" }
];

// --- 全域樣式 (Scrollbar & Glass Effect) ---
const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { 
        background: ${COLORS.FRESH_GREEN}40; 
        border-radius: 10px; 
    }
    .glass-effect { 
        background: rgba(255, 255, 255, 0.95); 
        backdrop-filter: blur(10px); 
    }
    body {
        font-family: 'Inter', sans-serif;
    }
  `}} />
);

// --- 1. AppContext (全域狀態管理) ---
const AppContext = React.createContext();

const AppProvider = ({ children }) => {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [cart, setCart] = useState({});
  const [userProfile, setUserProfile] = useState({
    name: "", // 初始空字串，判斷是否已登入
    email: "",
    address: "",
    favorites: []
  });
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState({
    message: "",
    type: "info"
  });

  // --- Firebase 初始化 + Auth 狀態監聽 ---
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      setLogLevel("debug");

      const unsubscribe = onAuthStateChanged(auth, async currentUser => {
        if (currentUser) {
          setUser(currentUser);
          setUserId(currentUser.uid);
          setPage("shop"); // 認證成功後預設跳轉到選購頁
        } else {
          // 嘗試使用 Custom Token 登入，若失敗則退回匿名登入
          if (initialAuthToken) {
            try {
              await signInWithCustomToken(auth, initialAuthToken);
            } catch (tokenError) {
              console.warn("Custom token sign-in failed, falling back to anonymous sign-in:", tokenError.message);
              // Custom Token 登入失敗時，退回匿名登入
              await signInAnonymously(auth);
            }
          } else {
            // 沒有 token，直接匿名登入
            await signInAnonymously(auth);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase init error:", err);
      setIsAuthReady(true);
      setNotification({ message: "Firebase 連線失敗", type: "error" });
    }
  }, []);

  // --- Firestore Listener：產品資料 (Public Data) ---
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const productsRef = collection(
      db, "artifacts", FIREBASE_APP_ID, "public", "data", "products"
    );

    const unsubscribe = onSnapshot(productsRef, snapshot => {
      if (snapshot.empty) {
        // 第一次載入，寫入 Mock Data
        MOCK_PRODUCTS.forEach(async p => {
          await setDoc(doc(productsRef, p.id), p);
        });
        setProducts(MOCK_PRODUCTS);
        return;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(list);
    }, err => console.error("Products listen error:", err));

    return () => unsubscribe();
  }, [isAuthReady]);

  // --- Firestore Listener：使用者個人資料 (Private Data) ---
  useEffect(() => {
    if (!userId || !db) return;

    const profileRef = doc(
      db, "artifacts", FIREBASE_APP_ID, "users", userId, "profile", "data"
    );

    const unsubscribe = onSnapshot(profileRef, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({ ...data, favorites: data.favorites || [] });
        // 如果 profile.name 存在，直接跳轉到 shop
        if (data.name) setPage("shop");
      } else {
        // 初始化空 profile
        setDoc(profileRef, { name: "", email: "", address: "", favorites: [] });
      }
    }, err => console.error("User profile listen error:", err));

    return () => unsubscribe();
  }, [userId]);

  // --- Firestore Listener：購物車 (Private Data) ---
  useEffect(() => {
    if (!userId || !db) return;

    const cartRef = doc(
      db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current"
    );

    const unsubscribe = onSnapshot(cartRef, snap => {
      if (snap.exists() && snap.data().items) {
        const itemsArray = snap.data().items;
        const newCart = itemsArray.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
        setCart(newCart);
      } else {
        setCart({});
      }
    }, err => console.error("Cart listen error:", err));

    return () => unsubscribe();
  }, [userId]);

  // --- Firestore Listener：歷史訂單 (Private Data) ---
  useEffect(() => {
    if (!userId || !db) return;

    const ordersRef = collection(
      db, "artifacts", FIREBASE_APP_ID, "users", userId, "orders"
    );

    const unsubscribe = onSnapshot(ordersRef, snapshot => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setOrders(list);
    }, err => console.error("Orders listen error:", err));

    return () => unsubscribe();
  }, [userId]);

  // 計算購物車陣列 & 總金額
  const cartItemsArray = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(() => cartItemsArray.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItemsArray]);

  // --- Action: 將購物車寫回 Firestore ---
  const updateCartInFirestore = useCallback(async newCart => {
    if (!userId || !db) return;
    const cartRef = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current");
    const itemsArray = Object.values(newCart);
    try {
      await setDoc(cartRef, { items: itemsArray, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("Update cart error:", err);
      setNotification({ message: "購物車更新失敗：" + err.message, type: "error" });
    }
  }, [userId]);

  // --- Action: 加入購物車 ---
  const addItemToCart = useCallback(product => {
    if (!userId) {
      setNotification({ message: "請先登入才能加入購物車", type: "error" });
      return;
    }
    const newCart = { ...cart };
    if (newCart[product.id]) {
      newCart[product.id].quantity += 1;
    } else {
      newCart[product.id] = { ...product, quantity: 1 };
    }
    setCart(newCart);
    updateCartInFirestore(newCart);
    setNotification({ message: `${product.name} 已加入購物車`, type: "success" });
  }, [cart, userId, updateCartInFirestore]);

  // --- Action: 調整購物車數量 ---
  const adjustItemQuantity = useCallback((id, delta) => {
    const newCart = { ...cart };
    if (!newCart[id]) return;

    newCart[id].quantity += delta;

    if (newCart[id].quantity <= 0) {
      delete newCart[id];
    }
    setCart(newCart);
    updateCartInFirestore(newCart);
  }, [cart, updateCartInFirestore]);

  // --- Action: 結帳 ---
  const checkout = useCallback(async () => {
    if (!userId || cartItemsArray.length === 0) {
      setNotification({ message: "購物車是空的", type: "error" });
      return;
    }

    const newOrder = {
      timestamp: serverTimestamp(),
      total: cartTotal,
      items: cartItemsArray,
      status: "Processing",
      customerName: userProfile.name,
      customerUID: userId,
      shippingAddress: userProfile.address || "未提供"
    };

    try {
      const ordersRef = collection(db, "artifacts", FIREBASE_APP_ID, "users", userId, "orders");
      await addDoc(ordersRef, newOrder);

      // 清空購物車
      const cartRef = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "cart", "current");
      await setDoc(cartRef, { items: [], updatedAt: serverTimestamp() });

      setNotification({ message: `結帳成功！總金額 NT$${cartTotal}`, type: "success" });
      setPage("profile");
    } catch (err) {
      console.error("Checkout error:", err);
      setNotification({ message: "結帳失敗：" + err.message, type: "error" });
    }
  }, [userId, cartItemsArray, cartTotal, userProfile.name, userProfile.address]);

  // --- Action: 我的最愛 (加入/移除) ---
  const toggleFavorite = useCallback(async productId => {
    if (!userId) {
      setNotification({ message: "登入後才可使用我的最愛", type: "error" });
      return;
    }
    const profileRef = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "profile", "data");
    const current = userProfile.favorites || [];

    const newFavorites = current.includes(productId)
      ? current.filter(id => id !== productId)
      : [...current, productId];

    try {
      await updateDoc(profileRef, { favorites: newFavorites });
      setNotification({
        message: current.includes(productId) ? "已從我的最愛移除" : "已加入我的最愛",
        type: "info"
      });
    } catch (err) {
      console.error("Favorite update error:", err);
    }
  }, [userId, userProfile.favorites]);

  const value = {
    page, setPage, user, userId, isAuthReady, products,
    cart: cartItemsArray, cartTotal, userProfile, setUserProfile, orders,
    notification, setNotification, addItemToCart, adjustItemQuantity, checkout, toggleFavorite
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- 2. 獨立頁面元件 ---

// Login Screen (登入 / 啟用帳號)
const LoginScreen = () => {
  const { isAuthReady, userId, setPage, setNotification, userProfile } = useContext(AppContext);
  const [loginName, setLoginName] = useState(userProfile.name || "");
  const [loginEmail, setLoginEmail] = useState(userProfile.email || "");
  const [loading, setLoading] = useState(false);

  // 如果已經有姓名，直接跳過登入
  useEffect(() => {
    if (isAuthReady && userProfile.name) {
      setPage("shop");
    }
  }, [isAuthReady, userProfile.name]);

  const handleLogin = async () => {
    if (!loginName.trim() || !loginEmail.trim()) {
      setNotification({ message: "請輸入姓名與電子郵件", type: "error" });
      return;
    }

    if (!userId) {
      setNotification({ message: "認證錯誤，請重新整理頁面", type: "error" });
      return;
    }

    const profileRef = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "profile", "data");

    try {
      setLoading(true);

      await setDoc(profileRef, {
        name: loginName,
        email: loginEmail,
        lastLogin: serverTimestamp(),
        favorites: userProfile.favorites || []
      }, { merge: true });

      setNotification({ message: "登入成功！開始您的智慧選購。", type: "success" });
      setPage("shop");
    } catch (err) {
      setNotification({ message: "登入失敗：" + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthReady || (isAuthReady && userProfile.name)) {
    return (
      <div className="text-center py-20 text-gray-500">
        {isAuthReady ? "正在跳轉..." : "系統初始化中..."}
      </div>
    );
  }

  return (
    <div
      className="max-w-md mx-auto mt-16 p-8 bg-white shadow-2xl rounded-2xl border-t-8"
      style={{ borderTopColor: COLORS.TECH_BLUE }}
    >
      <h2 className="text-3xl font-bold text-center mb-6" style={{ color: COLORS.TECH_BLUE }}>
        會員登入 / 帳號啟用
      </h2>
      <p className="text-gray-600 text-center mb-8 text-sm">
        請填寫您的資料以啟用帳號。您的臨時用戶 ID: <span className="font-mono text-xs">{userId || "N/A"}</span>
      </p>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">您的姓名
          <input
            type="text"
            value={loginName}
            onChange={e => setLoginName(e.target.value)}
            className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-transparent transition"
            placeholder="請輸入您的姓名"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">電子郵件（作為帳號）
          <input
            type="email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BFF] focus:border-transparent transition"
            placeholder="請輸入電子郵件"
          />
        </label>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full mt-8 py-3 text-white font-semibold rounded-lg shadow-xl shadow-orange-300 hover:shadow-2xl transition disabled:opacity-50"
        style={{ backgroundColor: COLORS.ACTION_ORANGE }}
      >
        {loading ? "登入中..." : "確認登入並開始選購"}
      </button>
    </div>
  );
};

// Product Card Component (針對 VI 進行優化)
const ProductCard = ({ product }) => {
  const { addItemToCart, userProfile, toggleFavorite } = useContext(AppContext);
  const isFavorite = userProfile.favorites?.includes(product.id);

  return (
    <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden">
      {/* 頂部 VI 漸層強調 */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-green-500" />
      
      <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shadow-inner bg-gray-50">
            {product.icon}
          </div>
          <button 
            onClick={() => toggleFavorite(product.id)}
            className="transform transition-transform active:scale-125 p-2 bg-gray-50 rounded-full hover:bg-orange-50"
            style={{ color: isFavorite ? COLORS.ACTION_ORANGE : "#D1D5DB" }}
          >
            {isFavorite ? <HeartFilled className="w-6 h-6" /> : <HeartOutline className="w-6 h-6" />}
          </button>
        </div>

        <h3 className="text-xl font-bold text-gray-800 group-hover:text-[#007BFF] transition-colors">{product.name}</h3>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-green-50 text-[#28A745] rounded-md mb-4 mt-1">
          {product.category}
        </span>

        <div className="flex justify-between items-center mt-auto pt-3 border-t">
          <p className="text-2xl font-black text-[#28A745]">
            NT$ {product.price}
            <span className="text-sm font-normal text-gray-500">/{product.unit}</span>
          </p>
          
          <button
            onClick={() => addItemToCart(product)}
            className="flex items-center space-x-1 px-4 py-2 bg-[#FF8800] text-white rounded-xl font-bold shadow-lg shadow-orange-300 hover:opacity-90 active:scale-95 transition-all"
          >
            <ShoppingBagIcon className="w-4 h-4" />
            <span className="text-sm">選購</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Shop Screen (商品選購頁面)
const ShopScreen = () => {
  const { products, userProfile, toggleFavorite } = useContext(AppContext);
  const [selectedCategory, setSelectedCategory] = useState("全部");

  // 全部分類
  const categories = useMemo(() => {
    const cat = new Set(products.map(p => p.category));
    return ["全部", "我的最愛", ...cat];
  }, [products]);

  // 篩選商品
  const filteredProducts = useMemo(() => {
    const favorites = userProfile.favorites || [];

    if (selectedCategory === "全部") return products;
    if (selectedCategory === "我的最愛")
      return products.filter(p => favorites.includes(p.id));

    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory, userProfile.favorites]);


  return (
    <div className="p-4">
      <h2 className="text-3xl font-extrabold mb-8 border-l-4 pl-4" style={{ borderLeftColor: COLORS.TECH_BLUE }}>
        智慧蔬果選購 | 產地新鮮直送
      </h2>

      {/* 分類按鈕 (使用科技藍/行動橘) */}
      <div className="flex flex-wrap gap-2 mb-8 p-3 bg-white rounded-xl shadow-inner border border-gray-100">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-sm rounded-full font-semibold transition shadow-md ${
              selectedCategory === cat
                ? "text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={{
              backgroundColor:
                selectedCategory === cat
                  ? cat === "我的最愛" ? COLORS.ACTION_ORANGE : COLORS.TECH_BLUE
                  : undefined
            }}
          >
            {cat}
            {cat === "我的最愛" ? ` (${(userProfile.favorites || []).length})` : ""}
          </button>
        ))}
      </div>

      {/* 商品列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <p className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-200 rounded-xl mt-6">
          此分類目前沒有商品，請嘗試其他分類。
        </p>
      )}
    </div>
  );
};

// Profile Field Component
const ProfileField = ({ label, value, isEditing, onChange, readOnly }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {isEditing && !readOnly ? (
        <input
          type="text"
          value={value || ""}
          onChange={onChange}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#007BFF] focus:border-transparent transition"
        />
      ) : (
        <p
          className={`p-3 border rounded-lg ${
            readOnly ? "bg-gray-100 text-gray-600 font-mono text-sm" : "bg-white text-gray-800 font-medium"
          }`}
        >
          {value || "未設定"}
        </p>
      )}
    </div>
  );
};

// Profile Screen (會員中心 + 訂單查詢)
const ProfileScreen = () => {
  const { userProfile, orders, setNotification, userId } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState(userProfile);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    setTempProfile(userProfile);
  }, [userProfile]);

  const handleSave = async () => {
    if (!tempProfile.name || !tempProfile.address) {
      setNotification({ message: "姓名與地址不能為空！", type: "error" });
      return;
    }

    const profileRef = doc(db, "artifacts", FIREBASE_APP_ID, "users", userId, "profile", "data");

    try {
      await setDoc(profileRef, tempProfile, { merge: true });

      setNotification({ message: "資料更新成功！", type: "success" });
      setIsEditing(false);
    } catch (err) {
      setNotification({ message: "資料更新失敗：" + err.message, type: "error" });
    }
  };

  const OrderItem = ({ order }) => (
    <div
      className="bg-white p-5 rounded-xl shadow-lg mb-4 border-l-4"
      style={{ borderLeftColor: COLORS.FRESH_GREEN }}
    >
      <div className="flex justify-between items-center border-b pb-3 mb-3">
        <h4 className="font-bold text-lg" style={{ color: COLORS.TECH_BLUE }}>
          訂單編號: #{order.id.substring(0, 8)}
        </h4>
        <span
          className={`px-3 py-1 text-xs rounded-full font-medium shadow-sm ${
            order.status === "Processing"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {order.status || "已完成"}
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-1">
        訂購時間：
        {order.timestamp
          ? new Date(order.timestamp.seconds * 1000).toLocaleString("zh-TW", { dateStyle: 'short', timeStyle: 'short' })
          : "N/A"}
      </p>

      <p className="font-black text-2xl text-red-600">
        總金額：NT$ {order.total}
      </p>

      {/* 商品詳細 */}
      <div className="mt-4 text-sm text-gray-600 border-t pt-3">
        <p className="font-semibold mb-1">訂購商品（共 {order.items.length} 項）:</p>
        <ul className="list-disc ml-4 space-y-0.5">
          {order.items.map((item, index) => (
            <li key={index} className="text-xs">
              {item.icon} {item.name} x {item.quantity}
              <span className="text-gray-400">（{item.price} 元 / {item.unit}）</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-3xl font-extrabold mb-8 border-l-4 pl-4" style={{ borderLeftColor: COLORS.TECH_BLUE }}>
        會員中心 | 您的專屬空間
      </h2>

      {/* Tabs */}
      <div className="flex border-b mb-8 bg-white p-1 rounded-xl shadow-md">
        <button
          onClick={() => setActiveTab("profile")}
          className={`py-3 px-6 font-semibold flex-1 rounded-lg transition ${
            activeTab === "profile" ? "text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={{ backgroundColor: activeTab === "profile" ? COLORS.TECH_BLUE : "transparent" }}
        >
          <UserIcon className="w-5 h-5 mr-2" />
          個人資料
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`py-3 px-6 font-semibold flex-1 rounded-lg transition ${
            activeTab === "orders" ? "text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={{ backgroundColor: activeTab === "orders" ? COLORS.TECH_BLUE : "transparent" }}
        >
          <ReceiptIcon className="w-5 h-5 mr-2" />
          歷史訂單 ({orders.length})
        </button>
      </div>

      {/* ============ 個人資料編輯 ============ */}
      {activeTab === "profile" && (
        <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
          <h3 className="text-2xl font-bold mb-6" style={{ color: COLORS.FRESH_GREEN }}>
            帳號與配送資訊
          </h3>

          <div className="space-y-4">
            <ProfileField label="系統用戶 ID" value={userId} readOnly />
            <ProfileField label="姓名" value={tempProfile.name} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} />
            <ProfileField label="電子郵件" value={tempProfile.email} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, email: e.target.value })} />
            <ProfileField label="配送地址" value={tempProfile.address} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, address: e.target.value })} />
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setTempProfile(userProfile); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  取消
                </button>

                <button
                  onClick={handleSave}
                  className="px-6 py-2 text-white rounded-lg hover:opacity-90 shadow-lg"
                  style={{ backgroundColor: COLORS.FRESH_GREEN }}
                >
                  儲存變更
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 shadow-lg"
                style={{ backgroundColor: COLORS.TECH_BLUE }}
              >
                編輯資料
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============ 歷史訂單列表 ============ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-200 rounded-xl mt-6">
              您目前沒有任何歷史訂單，快去選購吧！
            </p>
          ) : (
            orders.map(order => <OrderItem key={order.id} order={order} />)
          )}
        </div>
      )}
    </div>
  );
};

// Cart Sidebar (購物車側欄)
const CartSidebar = () => {
  const { cart, cartTotal, adjustItemQuantity, checkout } = useContext(AppContext);

  return (
    <aside className="lg:w-full sticky top-4">
      <div
        className="glass-effect p-6 rounded-2xl shadow-2xl border border-gray-100 border-t-4"
        style={{ borderTopColor: COLORS.TECH_BLUE }}
      >
        <h2 className="text-2xl font-black mb-4 flex items-center" style={{ color: COLORS.TECH_BLUE }}>
          <ShoppingBagIcon className="w-6 h-6 mr-2" />
          我的智慧選購單
        </h2>

        {/* 購物車內容 */}
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
              購物車目前是空的。
            </p>
          ) : (
            cart.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
              >
                <div className="flex-grow">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {item.icon} {item.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    NT$ {item.price} x {item.quantity}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => adjustItemQuantity(item.id, -1)}
                    className="w-6 h-6 bg-white border border-gray-300 rounded-full flex justify-center items-center text-gray-600 hover:bg-gray-100 transition"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>

                  <span className="font-bold w-4 text-center text-gray-800">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => adjustItemQuantity(item.id, 1)}
                    className="w-6 h-6 bg-white border border-gray-300 rounded-full flex justify-center items-center text-gray-600 hover:bg-gray-100 transition"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 總金額 + 結帳 (使用行動橘強調 CTA) */}
        <div className="border-t border-gray-200 mt-6 pt-4 space-y-3">
          <div className="flex justify-between items-center text-2xl font-black">
            <span style={{ color: COLORS.TECH_BLUE }}>總金額</span>
            <span className="text-red-600">NT$ {cartTotal}</span>
          </div>

          <button
            onClick={checkout}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl text-white font-black text-lg shadow-xl shadow-orange-300 hover:shadow-2xl transition disabled:opacity-50"
            style={{ backgroundColor: COLORS.ACTION_ORANGE }}
          >
            {cart.length === 0 ? "購物車是空的" : "立即結帳下單"}
          </button>
        </div>
      </div>
    </aside>
  );
};

// Notification Toast (全局提示訊息)
const NotificationToast = () => {
  const { notification, setNotification } = useContext(AppContext);

  useEffect(() => {
    if (notification.message) {
      const t = setTimeout(() => {
        setNotification({ message: "", type: "info" });
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [notification.message]);

  if (!notification.message) return null;

  let color = "bg-gray-600";
  if (notification.type === "success") color = "bg-green-600";
  if (notification.type === "error") color = "bg-red-600";
  if (notification.type === "info") color = "bg-blue-600";

  return (
    <div
      className={`fixed top-4 right-4 ${color} text-white p-4 rounded-xl shadow-2xl z-50 transition-transform transform duration-300`}
    >
      <div className="flex items-center space-x-2">
        {notification.type === "success" && <CheckCircleIcon className="w-6 h-6" />}
        {notification.type === "error" && <XCircleIcon className="w-6 h-6" />}
        {notification.type === "info" && <InfoIcon className="w-6 h-6" />}
        <span className="font-medium">{notification.message}</span>
      </div>
    </div>
  );
};

// --- 3. App 主介面 (Navigation, Header, Layout) ---

const App = () => {
  const { page, setPage, isAuthReady, userProfile } = useContext(AppContext);

  const renderPage = () => {
    if (!isAuthReady) {
      return (
        <div className="text-center py-20 text-gray-500">
          系統連線中，請稍候...
        </div>
      );
    }
    // 確保未輸入 profile name 時，強制導向 login
    if (!userProfile.name && page !== "login") {
      return <LoginScreen />;
    }

    switch (page) {
      case "login":
        return <LoginScreen />;
      case "shop":
        return <ShopScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <ShopScreen />;
    }
  };


  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.BG_GRAY }}>
      {/* Header (使用 Glass Effect 增加科技感) */}
      <header
        className="glass-effect shadow-md sticky top-0 z-20 border-b border-gray-200"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-black tracking-tighter italic">
              <span style={{ color: COLORS.TECH_BLUE }}>Veggie</span>
              <span style={{ color: COLORS.FRESH_GREEN }}>Tech</span>
              <span className="text-gray-400 font-light">Direct</span>
            </h1>
          </div>

          <div className="flex space-x-3">
            {page !== "login" && (
              <>
                <NavButton page="shop" currentPage={page} setPage={setPage} icon={HomeIcon}>
                  智慧選購
                </NavButton>

                <NavButton page="profile" currentPage={page} setPage={setPage} icon={UserIcon}>
                  {userProfile.name || "會員中心"}
                </NavButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto p-4 md:p-8 lg:flex lg:space-x-8">
        {/* 主要內容區 (佔 3/4 寬度) */}
        {/* 修復: 登入頁時強制 main 佔滿全寬度 (w-full)，避免被 lg:w-3/4 限制而偏左 */}
        <main className={page === 'login' ? 'w-full min-h-screen' : 'lg:w-3/4 min-h-screen'}>
          {renderPage()}
        </main>

        {/* 購物車側欄 (佔 1/4 寬度) */}
        {page !== "login" && (
          <div className="lg:w-1/4 mt-10 lg:mt-0">
            <CartSidebar />
          </div>
        )}
      </div>

      <NotificationToast />
      <GlobalStyles />
    </div>
  );
};

// Navigation Button Component
const NavButton = ({ page, currentPage, setPage, icon: Icon, children }) => {
  const isActive = currentPage === page;

  return (
    <button
      onClick={() => setPage(page)}
      className={`flex items-center px-4 py-2 rounded-xl font-semibold transition ${
        isActive ? "shadow-inner" : "hover:bg-gray-100"
      }`}
      style={{
        color: isActive ? COLORS.TECH_BLUE : "#555",
        backgroundColor: isActive ? COLORS.BG_GRAY : "transparent",
        borderBottom: isActive ? `3px solid ${COLORS.TECH_BLUE}` : "none",
      }}
    >
      <Icon className="w-5 h-5 mr-2" />
      {children}
    </button>
  );
};

// --- 4. SVG Icons (Lucide Style) ---

const HomeIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>);
const UserIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M6 22v-2a6 6 0 0 1 12 0v2" /></svg>);
const ShoppingBagIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" x2="21" y1="6" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>);
const HeartOutline = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7 7-7Z" /></svg>);
const HeartFilled = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l7-7c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" /></svg>);
const CheckCircleIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>);
const XCircleIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>);
const InfoIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>);
const MinusIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>);
const PlusIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>);
const ReceiptIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2h-4"/><path d="M18 15h-8"/><path d="M18 11h-8"/><path d="M18 7h-8"/></svg>);


// --- 5. 最終輸出 App ---
export default () => (
  <AppProvider>
    <App />
  </AppProvider>
);
