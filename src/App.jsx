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
  { id: "p008", name: "馬鈴薯", price: 65, unit: "袋", category: "根莖類", icon: "🥔" },
  { id: "p009", name: "青江菜", price: 42, unit: "把", category: "葉菜類", icon: "🥬" },
  { id: "p010", name: "茄子", price: 55, unit: "條", category: "瓜果類", icon: "🍆" },
  { id: "p011", name: "甜椒", price: 68, unit: "顆", category: "瓜果類", icon: "🫑" },
  { id: "p012", name: "玉米筍", price: 60, unit: "盒", category: "根莖類", icon: "🌽" },
  { id: "p013", name: "台灣香菇", price: 95, unit: "盒", category: "菇菌類", icon: "🍄" },
  { id: "p014", name: "嫩豆苗", price: 58, unit: "盒", category: "芽菜類", icon: "🌱" },
  { id: "p015", name: "蘿美生菜", price: 65, unit: "顆", category: "葉菜類", icon: "🥗" },
  { id: "p016", name: "四季豆", price: 52, unit: "包", category: "豆莢類", icon: "🫘" },
  { id: "p017", name: "娃娃菜", price: 55, unit: "顆", category: "葉菜類", icon: "🥬" },
  { id: "p018", name: "高麗菜花", price: 78, unit: "朵", category: "花椰類", icon: "🥦" },
  { id: "p019", name: "秋葵", price: 56, unit: "盒", category: "瓜果類", icon: "🌿" },
  { id: "p020", name: "油菜花", price: 48, unit: "把", category: "葉菜類", icon: "🥬" },
  { id: "p021", name: "地瓜葉", price: 38, unit: "把", category: "葉菜類", icon: "🍠" },
  { id: "p022", name: "紫地瓜", price: 62, unit: "袋", category: "根莖類", icon: "🍠" },
  { id: "p023", name: "牛蒡", price: 70, unit: "根", category: "根莖類", icon: "🪵" },
  { id: "p024", name: "山藥", price: 88, unit: "條", category: "根莖類", icon: "🥔" },
  { id: "p025", name: "有機小松菜", price: 52, unit: "把", category: "葉菜類", icon: "🥬" },
  { id: "p026", name: "紅鳳菜", price: 58, unit: "把", category: "葉菜類", icon: "🍁" },
  { id: "p027", name: "蘆筍", price: 98, unit: "束", category: "莖菜類", icon: "🥦" },
  { id: "p028", name: "青花菜", price: 85, unit: "朵", category: "花椰類", icon: "🥦" },
  { id: "p029", name: "彩虹甜菜", price: 75, unit: "把", category: "葉菜類", icon: "🌈" },
  { id: "p030", name: "水蓮", price: 68, unit: "把", category: "水生菜", icon: "💧" }
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
     
      const existingDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const missingProducts = MOCK_PRODUCTS.filter(
        item => !snapshot.docs.some(docSnap => docSnap.id === item.id)
      );

      // 若 Firestore 已有資料，但缺少新的預設商品，補齊並即時呈現
      missingProducts.forEach(async p => {
        await setDoc(doc(productsRef, p.id), p);
      });

      setProducts([...existingDocs, ...missingProducts]);
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
      setNotification({ message: "請先登入才能加入我的最愛", type: "error" });
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
    <section className="login-hero">
      <div className="login-kicker-row">
        <div className="login-logo-box">
          <div className="brand-icon-badge">🥕</div>
          <div className="brand-logo">
            <span className="logo-word-veggie">Veggie</span>
            <span className="logo-word-tech">Tech</span>
            <span className="logo-word-direct">Direct</span>
          </div>
        </div>
      </div>
 
      <div className="login-content">
        <div className="login-info">
          <div className="login-eyebrow">智能農產採購方案</div>
          <h2>成為 VeggieTech Direct 客戶，享受最低價格、最佳供應鏈</h2>
          <p>透過智慧採購，降低成本與損耗，掌握新鮮蔬果供應。</p>

          <div className="pill-group">
            <span className="pill">團體採購</span>
            <span className="pill">VIP會員</span>
            <span className="pill">企業合作</span>
          </div>

          <div className="info-grid">
            <div className="info-chip">13 家餐飲合作</div>
            <div className="info-chip">32 家餐飲升級計畫</div>
            <div className="info-chip">3 家連鎖餐飲導入</div>
            <div className="info-chip">5 家餐飲即將導入</div>
          </div>

          <div className="info-note">免費提供售前諮詢與採購規劃</div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <div className="login-brand">VeggieTech Direct</div>
            <span className="pill pill-amber">優化採購成本</span>
          </div>

          <h3>會員登入 / 帳號啟用</h3>
          <p className="login-subtext">
            請填寫您的資料以啟用帳號。您的臨時用戶 ID：
            <span className="mono">{userId || "N/A"}</span>
          </p>

          <div className="form-field">
            <label>您的姓名</label>
            <input
              type="text"
              value={loginName}
              onChange={e => setLoginName(e.target.value)}
              placeholder="請輸入您的姓名"
            />
          </div>

          <div className="form-field">
            <label>電子郵件（作為帳號）</label>
            <input
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="請輸入電子郵件"
            />
          </div>

          <button onClick={handleLogin} disabled={loading} className="login-submit">
            {loading ? "登入中..." : "確認登入並開始選購"}
          </button>

          <p className="login-terms">送出即表示您同意我們的服務條款與隱私政策</p>
        </div>
      </div>
    </section>

  );
};

// Product Card Component (針對 VI 進行優化)
const ProductCard = ({ product }) => {
  const { addItemToCart, userProfile, toggleFavorite } = useContext(AppContext);
  const isFavorite = userProfile.favorites?.includes(product.id);

  return (
    <div className="product-card">
      <div className="product-main">
        <div className="product-illustration">{product.icon}</div>

        <div className="product-content">
          <div className="product-name-group">
            <h3 className="product-name">{product.name}</h3>
            <p className="product-category">{product.category}</p>
          </div>

            <div className="product-inline-actions">
            <div className="price-chip">
              <span className="price-number">NT$ {product.price}</span>
              <span className="price-unit">/{product.unit}</span>
            </div>
            <div className="product-actions">
              <button
                onClick={() => toggleFavorite(product.id)}
                className={`favorite-btn ${isFavorite ? "is-active" : ""}`}
                aria-label="加入收藏"
              >
                {isFavorite ? <HeartFilled className="w-6 h-6" /> : <HeartOutline className="w-6 h-6" />}
              </button>


                <button className="add-btn" onClick={() => addItemToCart(product)}>
                <ShoppingBagIcon className="w-4 h-4" />
                加入
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Shop Screen (商品選購頁面)
const ShopScreen = ({ onLogoClick }) => {
  const {
    products,
    userProfile,
    toggleFavorite
  } = useContext(AppContext);
  const [selectedCategory, setSelectedCategory] = useState("全部");

  // 全部分類
  const categories = useMemo(() => {
    const cat = new Set(products.map(p => p.category));
    return ["全部", "我的最愛", ...cat];
  }, [products]);
  
  const categoryCounts = useMemo(() => {
    const favorites = userProfile.favorites || [];
    const counts = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {});

    return {
      全部: products.length,
      我的最愛: favorites.length,
      ...counts
    };
  }, [products, userProfile.favorites]);

  // 篩選商品
  const filteredProducts = useMemo(() => {
    const favorites = userProfile.favorites || [];

    if (selectedCategory === "全部") return products;
    if (selectedCategory === "我的最愛")
      return products.filter(p => favorites.includes(p.id));

    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory, userProfile.favorites]);
  
  return (
    <div className="shop-page">
      <div className="shop-top-shell compact">
        <div className="shop-action-row">
          <button
            className="brand-logo brand-logo-compact"
            onClick={onLogoClick}
            aria-label="回到選購首頁"
          >
            <span className="logo-word-veggie">Veggie</span>
            <span className="logo-word-tech">Tech</span>
            <span className="logo-word-direct">Direct</span>
          </button>
          
        </div>

        <div className="filter-bar filter-bar-slim" id="category-filters">
          {categories.map(cat => {
            const isActive = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`filter-chip ${isActive ? "filter-chip-active" : ""}`}
              >
                <span>{cat}</span>
                <span className="chip-count">{categoryCounts[cat] || 0} 項</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 商品列表 */}
      <div className="product-grid">
        {filteredProducts.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <p className="empty-state">此分類目前沒有商品，請嘗試其他分類。</p>
      )}
    </div>
  );
};
// Cart Sidebar
const CartSidebar = () => {
  const { cart, cartTotal, adjustItemQuantity, checkout } = useContext(AppContext);

  if (!cart || cart.length === 0) {
    return (
      <aside className="cart-panel" id="cart-sidebar">
        <div className="cart-title-row">
          <h3 className="cart-title">
            <span className="action-icon action-icon-ghost">
              <ShoppingBagIcon className="w-5 h-5" />
            </span>
            購物車
          </h3>
          <span className="cart-mini-total">NT$ 0</span>
        </div>
        <p className="cart-empty">您的購物車目前是空的</p>
      </aside>
    );
  }

  return (
    <aside className="cart-panel" id="cart-sidebar">
     <div className="cart-title-row">
        <h3 className="cart-title">
          <span className="action-icon action-icon-ghost">
            <ShoppingBagIcon className="w-5 h-5" />
          </span>
          購物車
        </h3>
        <span className="cart-mini-total">NT$ {cartTotal}</span>
      </div>

      <div className="cart-list custom-scrollbar">
        {cart.map(item => (
          <div key={item.id} className="cart-item">
            <div className="cart-item-info">
              <div className="cart-item-name">{item.icon} {item.name}</div>
                <div className="cart-item-meta">
                <span className="cart-price-tag">NT$ {item.price} / {item.unit}</span>
                <span className="cart-total-inline">小計 NT$ {item.price * item.quantity}</span>
              </div>
            </div>

            <div className="cart-qty">
              <button
                className="qty-btn"
                onClick={() => adjustItemQuantity(item.id, -1)}
                aria-label="移除一個"
              >
                <MinusIcon className="w-4 h-4" />
              </button>

              <span className="qty-value">{item.quantity}</span>

              <button
                className="qty-btn"
                onClick={() => adjustItemQuantity(item.id, 1)}
                aria-label="增加一個"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div>
          <p className="cart-summary-label">總金額</p>
          <p className="cart-summary-value">NT$ {cartTotal}</p>
        </div>

        <button className="checkout-btn" onClick={checkout}>
          前往結帳
        </button>
      </div>
    </aside>
  );
};

// Profile Field Component
const ProfileField = ({ label, value, isEditing, onChange, readOnly }) => {
  return (
   <div className="profile-field">
     <label className="profile-field-label">{label}</label>

      {isEditing && !readOnly ? (
        <input
          type="text"
          value={value || ""}
          onChange={onChange}
          className="profile-field-input"
        />
      ) : (
       <div
          className={`profile-field-readonly ${
            readOnly ? "is-muted" : ""
          }`}
        >
          {value || "未設定"}
       </div>
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
  
  const profileInitial = useMemo(() => {
    if (userProfile.name) return userProfile.name.charAt(0).toUpperCase();
    return "V";
  }, [userProfile.name]);

  const orderCount = useMemo(() => orders.length, [orders.length]);
  const favoriteCount = useMemo(
    () => (userProfile.favorites ? userProfile.favorites.length : 0),
    [userProfile.favorites]
  );
  const completionRate = useMemo(() => {
    const fields = [userProfile.name, userProfile.email, userProfile.address];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [userProfile.name, userProfile.email, userProfile.address]);

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
      
      <div className="profile-hero-card">
        <div className="profile-avatar">{profileInitial}</div>

        <div className="profile-hero-content">
          <p className="profile-hero-eyebrow">VeggieTech VIP</p>
          <h3 className="profile-hero-title">{userProfile.name || "尚未設定姓名"}</h3>
          <p className="profile-hero-sub">{userProfile.email || "請補充電子郵件以完成會員資訊"}</p>
          <div className="profile-hero-badges">
            <span className="profile-pill">臨時 ID：{userId || "N/A"}</span>
            <span className="profile-pill profile-pill-warm">偏好蔬果 {favoriteCount} 項</span>
          </div>
        </div>

        <div className="profile-hero-actions">
          <button
            type="button"
            className="profile-hero-btn"
            onClick={() => setActiveTab("profile")}
          >
            <UserIcon className="w-4 h-4" />
            個人資料
          </button>
          <div className="profile-stat-chip">
            <span className="label">已完成訂單</span>
            <strong className="value">{orderCount}</strong>
          </div>
          <div className="profile-stat-chip">
            <span className="label">常用配送地</span>
            <strong className="value">{userProfile.address ? "已設定" : "待設定"}</strong>
          </div>
        </div>
      </div>

      <div className="profile-stats-grid">
        <button
          type="button"
          className="profile-stat-card profile-stat-card-action"
          onClick={() => setActiveTab("orders")}
        >
          <div className="icon">🛒</div>
          <div>
            <p className="label">歷史訂單</p>
            <p className="value">{orderCount} 筆</p>
          </div>
        </button>
        <div className="profile-stat-card">
          <div className="icon">❤️</div>
          <div>
            <p className="label">我的最愛</p>
            <p className="value">{favoriteCount} 項</p>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="icon">📍</div>
          <div>
            <p className="label">配送地址</p>
            <p className="value">{userProfile.address || "尚未填寫"}</p>
          </div>
        </div>
      </div>
      <div className="profile-benefits">
        <div className="benefit-card spotlight">
          <div className="benefit-heading">
            <div className="benefit-icon">🎁</div>
            <div>
              <p className="benefit-eyebrow">會員禮遇升級</p>
              <h4>滿額免運、限定優惠每週更新</h4>
            </div>
          </div>
          <ul className="benefit-list">
            <li>每週三指定蔬菜 95 折，結帳自動折抵</li>
            <li>單筆滿 NT$1500 免運，冷鏈配送不加價</li>
            <li>專屬採購顧問 LINE 諮詢，協助搭配菜單</li>
          </ul>
        </div>

        <div className="benefit-card">
          <div className="benefit-heading">
            <div className="benefit-icon">✅</div>
            <div>
              <p className="benefit-eyebrow">資料完成度</p>
              <h4>完善聯絡資訊，享受更快配送</h4>
            </div>
          </div>
          <div className="completion-meter">
            <div className="completion-bar">
              <div className="completion-bar-fill" style={{ width: `${completionRate}%` }} />
            </div>
            <div className="completion-meta">
              <span>填寫度 {completionRate}%</span>
              <span className="completion-hint">姓名 / Email / 配送地址</span>
            </div>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-heading">
            <div className="benefit-icon warm">🤝</div>
            <div>
              <p className="benefit-eyebrow">專屬客服</p>
              <h4>真人線上支援，訂單狀態即時回覆</h4>
            </div>
          </div>
          <div className="benefit-support">
            <p>週一至週六 08:00-20:00 線上回覆，急件立即處理。</p>
            <div className="support-tags">
              <span>LINE：@veggietech</span>
              <span>客服專線：02-1234-5678</span>
              <span>配送更新：即時推播</span>
            </div>
          </div>
        </div>
      </div>
     
      {/* ============ 個人資料編輯 ============ */}
      {activeTab === "profile" && (
        <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
          <h3 className="text-2xl font-bold mb-6" style={{ color: COLORS.FRESH_GREEN }}>
            帳號與配送資訊
          </h3 >

          <div className="space-y-4">
            <ProfileField label="系統用戶 ID" value={userId} readOnly />
            <ProfileField label="姓名" value={tempProfile.name} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} />
            <ProfileField label="電子郵件" value={tempProfile.email} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, email: e.target.value })} />
            <ProfileField label="配送地址" value={tempProfile.address} isEditing={isEditing} 
              onChange={e => setTempProfile({ ...tempProfile, address: e.target.value })} />
          </div>

          <div className="mt-8 flex justify-end space-x-4 profile-actions">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setTempProfile(userProfile); }}
                  className="profile-btn profile-btn-ghost"
                >
                  取消
                </button>

                <button
                  onClick={handleSave}
                  className="profile-btn profile-btn-primary"
                >
                  儲存變更
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="profile-btn profile-btn-primary"
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
  const { page, setPage, isAuthReady, userProfile, cart, setNotification } = useContext(AppContext);
  const shouldScrollToCart = useRef(false);
  const shouldScrollToFilters = useRef(false);

  const scrollToCart = useCallback(() => {
    const cartElement = document.getElementById("cart-sidebar");

    if (cartElement) {
      cartElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [cart]
  );

  const handleLogoClick = () => {
    setPage("shop");
  };

  const handleProfileButtonClick = () => {
    setPage("profile");
  };

  const handleNotificationClick = () => {
    setNotification({ message: "最新通知將顯示在這裡", type: "info" });
  };

  const handleFavoritesShortcut = () => {
    setNotification({ message: "在商品分類選擇『我的最愛』即可查看收藏", type: "info" });
    setPage("shop");
  };

  const handleCartButtonClick = () => {
    if (page !== "shop") {
      shouldScrollToCart.current = true;
      setPage("shop");
      return;
    }

    scrollToCart();
  };

  const scrollToFilters = useCallback(() => {
    const filterBar = document.getElementById("category-filters");

    if (filterBar) {
      filterBar.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleMenuButtonClick = () => {
    if (page !== "shop") {
      shouldScrollToFilters.current = true;
      setPage("shop");
      return;
    }

    scrollToFilters();
  };

  useEffect(() => {
    if (page === "shop" && shouldScrollToCart.current) {
      scrollToCart();
      shouldScrollToCart.current = false;
    }
 if (page === "shop" && shouldScrollToFilters.current) {
      scrollToFilters();
      shouldScrollToFilters.current = false;
    }
  }, [page, scrollToCart, scrollToFilters]);;
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
        return (
          <ShopScreen onLogoClick={handleLogoClick} />
        );
      case "profile":
        return <ProfileScreen />;
      default:
        return (
          <ShopScreen onLogoClick={handleLogoClick} />
        );
    }
  };
  const shouldForceLogin = !userProfile.name && page !== "login";
  const isLoginView = page === "login" || shouldForceLogin;
  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.BG_GRAY }}>
      {/* Header (使用 Glass Effect 增加科技感) */}
      <header className="header-shell">
        <div className="header-container">
          <div className="brand-wrapper">
            <button className="brand-logo brand-logo-btn" onClick={handleLogoClick}>
               <span className="logo-word-veggie">Veggie</span>
              <span className="logo-word-tech">Tech</span>
              <span className="logo-word-direct">Direct</span>
            </button>
          </div>
          {!isLoginView && (
            <div className="header-actions">
              <button
                className="header-pill"
                onClick={handleProfileButtonClick}
              >
                <UserIcon width={20} height={20} />
                會員中心
              </button>

              <button className="header-cart-btn" onClick={handleCartButtonClick}>
                <ShoppingBagIcon width={20} height={20} />
                <span>購物車</span>
                <span className="header-cart-count">{totalCartItems}</span>
              </button>
            </div>
          )}
        </div>
      </header>
 
      {/* Main Layout */}
      {/* 判斷：若為 login 頁面，則不使用 lg:flex 佈局，讓其在區塊模型中自然居中 */}
      <div className={`max-w-7xl mx-auto p-4 md:p-8 ${!isLoginView ? 'lg:flex lg:space-x-8' : ''}`}>
        
        {/* 主要內容區 */}
        {/* 邏輯：login 頁面時，main 佔滿 w-full，並且僅做水平 Flex 居中，垂直由內容邊距控制。 */}
        <main className={page === 'login' ? 'w-full min-h-screen' : 'lg:w-3/4 min-h-screen'}>
          {renderPage()}
        </main>

        {/* 購物車側欄 (僅在非登入頁面顯示) */}
        {!isLoginView && (
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

// --- 4. SVG Icons (Lucide Style) ---

const HomeIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>);
const UserIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M6 22v-2a6 6 0 0 1 12 0v2" /></svg>);
const ShoppingBagIcon = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" x2="21" y1="6" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>);
const HeartOutline = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7 7-7Z" /></svg>);
const HeartFilled = props => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21l7-7c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7 7-7Z" /></svg>);
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
