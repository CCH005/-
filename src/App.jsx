import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback
} from "react";

// Firebase
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

// 讀取 index.html 注入的 runtime config
const rawAppId = window.__app_id || "default-fresh-market";

// appId 清洗
const APP_ID_SEGMENT = rawAppId.split("/")[0].split("_").slice(0, 2).join("_");
const FIREBASE_APP_ID = APP_ID_SEGMENT.includes("c_")
  ? APP_ID_SEGMENT
  : "default-fresh-market";

const firebaseConfig = {
  apiKey: "AIzaSyA6Z4btAi6Sm0FItnUddFCRxQlgNt30YXs",
  authDomain: "cch5-4af59.firebaseapp.com",
  projectId: "cch5-4af59",
  storageBucket: "cch5-4af59.firebasestorage.app",
  messagingSenderId: "202863377560",
  appId: "1:202863377560:web:9c0515983f41c22d3aa4ed"
};

const initialAuthToken = window.__initial_auth_token || null;

// Firebase 實例（由 useEffect 初始化）
let db = null;
let auth = null;

// ---------------------------------------------------------------
// VI 色票
// ---------------------------------------------------------------
const COLOR_TECH_BLUE = "#007BFF"; // 科技藍
const COLOR_FRESH_GREEN = "#28A745"; // 新鮮綠
const COLOR_ACTION_ORANGE = "#FF8800"; // 行動橘

// ---------------------------------------------------------------
// 預設資料（Firestore 沒資料則初始化用）
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// Global Context
// ---------------------------------------------------------------
const AppContext = React.createContext();

// ---------------------------------------------------------------
// 全域樣式（如自訂 scrollbar）
// ---------------------------------------------------------------
const GlobalStyles = () => {
  const css = `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: ${COLOR_FRESH_GREEN}50;
            border-radius: 20px;
        }
    `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

// ---------------------------------------------------------------
// AppProvider：整個系統的全域狀態
// ---------------------------------------------------------------
const AppProvider = ({ children }) => {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [cart, setCart] = useState({});
  const [userProfile, setUserProfile] = useState({
    name: "新用戶",
    email: "",
    address: "",
    favorites: []
  });
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState({
    message: "",
    type: "info"
  });

  // -------------------------------------------------------------
  // Firebase 初始化 + Auth 狀態監聽
  // -------------------------------------------------------------
  useEffect(() => {
    if (!firebaseConfig) {
      console.error("Firebase config missing");
      setIsAuthReady(true);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      setLogLevel("debug");

      const unsubscribe = onAuthStateChanged(auth, async currentUser => {
        if (currentUser) {
          setUser(currentUser);
          setUserId(currentUser.uid);

          setPage("shop");

        } else {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase init error:", err);
      setIsAuthReady(true);
    }
  }, []);

  // -------------------------------------------------------------
  // Firestore Listener：產品資料
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isAuthReady || !db) return;

    const productsRef = collection(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "public",
      "data",
      "products"
    );

    const unsubscribe = onSnapshot(
      productsRef,
      snapshot => {
        if (snapshot.empty) {
          MOCK_PRODUCTS.forEach(async p => {
            await setDoc(doc(productsRef, p.id), p);
          });
          setProducts(MOCK_PRODUCTS);
          return;
        }

        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(list);
      },
      err => {
        console.error("Products listen error:", err);
        setProducts(MOCK_PRODUCTS);
      }
    );

    return () => unsubscribe();
  }, [isAuthReady]);
  // -------------------------------------------------------------
  // Firestore Listener：使用者個人資料（含 favorites）
  // -------------------------------------------------------------
  useEffect(() => {
    if (!userId || !db) return;

    const profileRef = doc(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "users",
      userId,
      "profile",
      "data"
    );

    const unsubscribe = onSnapshot(
      profileRef,
      snap => {
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile({
            ...data,
            favorites: data.favorites || []
          });
        } else {
          // 初始化
          setDoc(profileRef, {
            name: "新用戶",
            email: "",
            address: "",
            favorites: []
          });
        }
      },
      err => console.error("User profile listen error:", err)
    );

    return () => unsubscribe();
  }, [userId]);

  // -------------------------------------------------------------
  // Firestore Listener：購物車
  // -------------------------------------------------------------
  useEffect(() => {
    if (!userId || !db) return;

    const cartRef = doc(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "users",
      userId,
      "cart",
      "current"
    );

    const unsubscribe = onSnapshot(
      cartRef,
      snap => {
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
      },
      err => console.error("Cart listen error:", err)
    );

    return () => unsubscribe();
  }, [userId]);

  // -------------------------------------------------------------
  // Firestore Listener：歷史訂單
  // -------------------------------------------------------------
  useEffect(() => {
    if (!userId || !db) return;

    const ordersRef = collection(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "users",
      userId,
      "orders"
    );

    const unsubscribe = onSnapshot(
      ordersRef,
      snapshot => {
        const list = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        // 按時間排序
        list.sort((a, b) => {
          const ta = a.timestamp?.seconds || 0;
          const tb = b.timestamp?.seconds || 0;
          return tb - ta;
        });

        setOrders(list);
      },
      err => console.error("Orders listen error:", err)
    );

    return () => unsubscribe();
  }, [userId]);

  // -------------------------------------------------------------
  // 計算購物車陣列 & 總金額
  // -------------------------------------------------------------
  const cartItemsArray = useMemo(() => Object.values(cart), [cart]);

  const cartTotal = useMemo(() => {
    return cartItemsArray.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }, [cartItemsArray]);

  // -------------------------------------------------------------
  // 將購物車寫回 Firestore
  // -------------------------------------------------------------
  const updateCartInFirestore = useCallback(
    async newCart => {
      if (!userId || !db) return;

      const cartRef = doc(
        db,
        "artifacts",
        FIREBASE_APP_ID,
        "users",
        userId,
        "cart",
        "current"
      );

      const itemsArray = Object.values(newCart);

      try {
        await setDoc(
          cartRef,
          {
            items: itemsArray,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Update cart error:", err);
        setNotification({
          message: "購物車更新失敗：" + err.message,
          type: "error"
        });
      }
    },
    [userId]
  );

  // -------------------------------------------------------------
  // 加入購物車
  // -------------------------------------------------------------
  const addItemToCart = useCallback(
    product => {
      if (!userId) {
        setNotification({
          message: "請先登入才能加入購物車",
          type: "error"
        });
        return;
      }

      const newCart = { ...cart };

      if (newCart[product.id]) {
        newCart[product.id].quantity += 1;
      } else {
        newCart[product.id] = {
          ...product,
          quantity: 1
        };
      }

      setCart(newCart);
      updateCartInFirestore(newCart);

      setNotification({
        message: `${product.name} 已加入購物車`,
        type: "success"
      });
    },
    [cart, userId, updateCartInFirestore]
  );

  // -------------------------------------------------------------
  // 調整購物車數量
  // -------------------------------------------------------------
  const adjustItemQuantity = useCallback(
    (id, delta) => {
      const newCart = { ...cart };
      if (!newCart[id]) return;

      newCart[id].quantity += delta;

      if (newCart[id].quantity <= 0) {
        delete newCart[id];
      }

      setCart(newCart);
      updateCartInFirestore(newCart);
    },
    [cart, updateCartInFirestore]
  );

  // -------------------------------------------------------------
  // 結帳
  // -------------------------------------------------------------
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
      customerUID: userId
    };

    try {
      const ordersRef = collection(
        db,
        "artifacts",
        FIREBASE_APP_ID,
        "users",
        userId,
        "orders"
      );

      await addDoc(ordersRef, newOrder);

      const cartRef = doc(
        db,
        "artifacts",
        FIREBASE_APP_ID,
        "users",
        userId,
        "cart",
        "current"
      );

      await setDoc(cartRef, { items: [], updatedAt: serverTimestamp() });

      setNotification({
        message: `結帳成功！總金額 NT$${cartTotal}`,
        type: "success"
      });

      setPage("profile");
    } catch (err) {
      console.error("Checkout error:", err);
      setNotification({ message: "結帳失敗：" + err.message, type: "error" });
    }
  }, [userId, cartItemsArray, cartTotal, userProfile.name]);

  // -------------------------------------------------------------
  // 我的最愛（加入/移除）
  // -------------------------------------------------------------
  const toggleFavorite = useCallback(
    async productId => {
      if (!userId) {
        setNotification({
          message: "登入後才可使用我的最愛",
          type: "error"
        });
        return;
      }

      const profileRef = doc(
        db,
        "artifacts",
        FIREBASE_APP_ID,
        "users",
        userId,
        "profile",
        "data"
      );

      const current = userProfile.favorites || [];

      const newFavorites = current.includes(productId)
        ? current.filter(id => id !== productId)
        : [...current, productId];

      try {
        await updateDoc(profileRef, { favorites: newFavorites });

        setNotification({
          message: current.includes(productId)
            ? "已從我的最愛移除"
            : "已加入我的最愛",
          type: "info"
        });
      } catch (err) {
        console.error("Favorite update error:", err);
      }
    },
    [userId, userProfile.favorites]
  );

  // -------------------------------------------------------------
  // Context 提供的全域內容
  // -------------------------------------------------------------
  const value = {
    page,
    setPage,
    user,
    userId,
    isAuthReady,
    products,
    cart: cartItemsArray,
    cartTotal,
    userProfile,
    setUserProfile,
    orders,
    notification,
    setNotification,
    addItemToCart,
    adjustItemQuantity,
    checkout,
    toggleFavorite
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
// -------------------------------------------------------------
// Login Screen（登入 / 啟用帳號）
// -------------------------------------------------------------
const LoginScreen = () => {
  const { isAuthReady, userId, setPage, setNotification } =
    useContext(AppContext);

  const [loginName, setLoginName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginName || !loginEmail) {
      setNotification({
        message: "請輸入姓名與電子郵件",
        type: "error"
      });
      return;
    }

    if (!userId) {
      setNotification({
        message: "認證錯誤，請重新整理頁面",
        type: "error"
      });
      return;
    }

    const profileRef = doc(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "users",
      userId,
      "profile",
      "data"
    );

    try {
      setLoading(true);

      await setDoc(
        profileRef,
        {
          name: loginName,
          email: loginEmail,
          lastLogin: serverTimestamp(),
          favorites: []
        },
        { merge: true }
      );

      setNotification({
        message: "登入成功！",
        type: "success"
      });

      setPage("shop");
    } catch (err) {
      setNotification({
        message: "登入失敗：" + err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="text-center py-20 text-gray-500">系統初始化中...</div>
    );
  }

  return (
    <div
  className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 relative"
  style={{ borderTop: `8px solid ${COLOR_TECH_BLUE}` }}
>

      style={{ borderTopColor: COLOR_TECH_BLUE }}
    >
      <h2
        className="text-3xl font-bold text-center mb-6"
        style={{ color: COLOR_TECH_BLUE }}
      >
        會員登入 / 帳號啟用
      </h2>

      <p className="text-gray-600 text-center mb-8 text-sm">
        請填寫您的資料以啟用帳號。 用戶 ID: {userId || "N/A"}
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            您的姓名
          </label>
          <input
            type="text"
            value={loginName}
            onChange={e => setLoginName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="請輸入您的姓名"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            電子郵件（作為帳號）
          </label>
          <input
            type="email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            placeholder="請輸入電子郵件"
          />
        </div>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full mt-8 py-3 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition"
        style={{ backgroundColor: COLOR_ACTION_ORANGE }}
      >
        {loading ? "登入中..." : "確認登入並開始購物"}
      </button>
    </div>
  );
};

// -------------------------------------------------------------
// 商品選購頁面 ShopScreen
// -------------------------------------------------------------
const ShopScreen = () => {
  const { products, addItemToCart, userProfile, toggleFavorite } =
    useContext(AppContext);

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

  const favorites = userProfile.favorites || [];

  // 商品卡片
  const ProductCard = ({ product }) => {
    const isFavorite = favorites.includes(product.id);

    return (
      <div
        className="bg-white p-4 rounded-xl shadow-lg flex flex-col justify-between hover:shadow-xl transition"
        style={{ borderLeft: `5px solid ${COLOR_FRESH_GREEN}` }}
      >
        <div className="flex justify-between items-start mb-3">
          <span className="text-4xl">{product.icon}</span>

          <button
            onClick={() => toggleFavorite(product.id)}
            style={{
              color: isFavorite ? COLOR_ACTION_ORANGE : "#D1D5DB"
            }}
            className="p-2"
          >
            {isFavorite ? (
              <HeartFilled className="w-6 h-6" />
            ) : (
              <HeartOutline className="w-6 h-6" />
            )}
          </button>
        </div>

        <h3 className="text-xl font-bold text-gray-800">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-2">{product.category}</p>

        <div className="flex justify-between items-center mt-auto pt-3 border-t">
          <p className="text-xl font-extrabold text-red-600">
            NT$ {product.price} / {product.unit}
          </p>

          <button
            onClick={() => addItemToCart(product)}
            className="px-4 py-2 rounded-full text-white text-sm shadow-md hover:opacity-90 transition"
            style={{ backgroundColor: COLOR_FRESH_GREEN }}
          >
            加入
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2
        className="text-3xl font-bold mb-6 border-l-4 pl-4"
        style={{ borderLeftColor: COLOR_TECH_BLUE }}
      >
        智慧蔬果選購
      </h2>

      {/* 分類按鈕 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-sm rounded-full font-semibold transition ${
              selectedCategory === cat
                ? "text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            style={{
              backgroundColor:
                selectedCategory === cat
                  ? cat === "我的最愛"
                    ? COLOR_ACTION_ORANGE
                    : COLOR_TECH_BLUE
                  : undefined
            }}
          >
            {cat}
            {cat === "我的最愛" ? ` (${favorites.length})` : ""}
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
        <p className="text-center text-gray-500 py-10">
          此分類目前沒有商品。
        </p>
      )}
    </div>
  );
};
// -------------------------------------------------------------
// ProfileScreen（會員中心 + 訂單查詢）
// -------------------------------------------------------------
const ProfileScreen = () => {
  const { userProfile, orders, setNotification, userId } =
    useContext(AppContext);

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState(userProfile);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    setTempProfile(userProfile);
  }, [userProfile]);

  const handleSave = async () => {
    if (!tempProfile.name || !tempProfile.address) {
      setNotification({
        message: "姓名與地址不能為空！",
        type: "error"
      });
      return;
    }

    const profileRef = doc(
      db,
      "artifacts",
      FIREBASE_APP_ID,
      "users",
      userId,
      "profile",
      "data"
    );

    try {
      await setDoc(profileRef, tempProfile, { merge: true });

      setNotification({
        message: "資料更新成功！",
        type: "success"
      });

      setIsEditing(false);
    } catch (err) {
      setNotification({
        message: "資料更新失敗：" + err.message,
        type: "error"
      });
    }
  };

  // -------------------------------------------------------------
  // 訂單 Item 組件
  // -------------------------------------------------------------
  const OrderItem = ({ order }) => (
    <div
      className="bg-white p-4 rounded-xl shadow-lg mb-4 border-l-4"
      style={{ borderLeftColor: COLOR_FRESH_GREEN }}
    >
      <div className="flex justify-between items-center border-b pb-2 mb-2">
        <h4
          className="font-semibold text-lg"
          style={{ color: COLOR_TECH_BLUE }}
        >
          訂單編號: #{order.id.substring(0, 8)}
        </h4>

        <span
          className={`px-3 py-1 text-sm rounded-full font-medium ${
            order.status === "Processing"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {order.status || "已完成"}
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-1">
        訂購時間：{" "}
        {order.timestamp
          ? new Date(order.timestamp.seconds * 1000).toLocaleString("zh-TW")
          : "N/A"}
      </p>

      <p className="font-bold text-xl text-red-600">
        總金額：NT$ {order.total}
      </p>

      {/* 商品詳細 */}
      <div className="mt-3 text-sm text-gray-600 border-t pt-2">
        <p className="font-semibold">訂購商品（{order.items.length} 項）:</p>
        <ul className="list-disc ml-4">
          {order.items.map((item, index) => (
            <li key={index} className="text-xs">
              {item.icon} {item.name} x {item.quantity}
              （{item.price} 元 / {item.unit}）
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // ProfileScreen 主畫面
  // -------------------------------------------------------------
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2
        className="text-3xl font-bold mb-6 border-l-4 pl-4"
        style={{ borderLeftColor: COLOR_TECH_BLUE }}
      >
        會員中心與訂單查詢
      </h2>

      {/* Tabs */}
      <div className="flex border-b mb-8">
        <button
          onClick={() => setActiveTab("profile")}
          className={`py-2 px-6 font-semibold transition ${
            activeTab === "profile"
              ? "border-b-4 text-gray-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={{
            borderBottomColor:
              activeTab === "profile" ? COLOR_TECH_BLUE : "transparent"
          }}
        >
          個人資料編輯
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`py-2 px-6 font-semibold transition ${
            activeTab === "orders"
              ? "border-b-4 text-gray-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={{
            borderBottomColor:
              activeTab === "orders" ? COLOR_TECH_BLUE : "transparent"
          }}
        >
          歷史訂單（{orders.length}）
        </button>
      </div>

      {/* ============ 個人資料編輯 ============ */}
      {activeTab === "profile" && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3
            className="text-xl font-bold mb-4"
            style={{ color: COLOR_TECH_BLUE }}
          >
            個人資訊
          </h3>

          <div className="space-y-4">
            <ProfileField label="用戶 ID" value={userId} readOnly />

            <ProfileField
              label="姓名"
              value={tempProfile.name}
              isEditing={isEditing}
              onChange={e =>
                setTempProfile({ ...tempProfile, name: e.target.value })
              }
            />

            <ProfileField
              label="電子郵件"
              value={tempProfile.email}
              isEditing={isEditing}
              onChange={e =>
                setTempProfile({ ...tempProfile, email: e.target.value })
              }
            />

            <ProfileField
              label="配送地址"
              value={tempProfile.address}
              isEditing={isEditing}
              onChange={e =>
                setTempProfile({ ...tempProfile, address: e.target.value })
              }
            />
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  取消
                </button>

                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                  style={{ backgroundColor: COLOR_FRESH_GREEN }}
                >
                  儲存變更
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: COLOR_TECH_BLUE }}
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
            <p className="text-center text-gray-500 py-10">
              您目前沒有任何歷史訂單。
            </p>
          ) : (
            orders.map(order => <OrderItem key={order.id} order={order} />)
          )}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// ProfileField 組件
// -------------------------------------------------------------
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
          className="w-full p-3 border border-gray-300 rounded-lg bg-white"
        />
      ) : (
        <p
          className={`p-3 border rounded-lg ${
            readOnly ? "bg-gray-100 text-gray-500" : "bg-white"
          }`}
        >
          {value || "未設定"}
        </p>
      )}
    </div>
  );
};
// -------------------------------------------------------------
// 購物車側欄 CartSidebar
// -------------------------------------------------------------
const CartSidebar = () => {
  const { cart, cartTotal, adjustItemQuantity, checkout } =
    useContext(AppContext);

  return (
    <aside className="lg:w-full sticky top-4">
      <div
        className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100 border-t-4"
        style={{ borderTopColor: COLOR_TECH_BLUE }}
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <ShoppingBagIcon
            className="w-6 h-6 mr-2"
            style={{ color: COLOR_TECH_BLUE }}
          />
          我的訂單（
          {cart.reduce((sum, item) => sum + item.quantity, 0)}）
        </h2>

        {/* 購物車內容 */}
        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
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
                    className="w-6 h-6 bg-white border border-gray-300 rounded-full flex justify-center items-center text-gray-600"
                  >
                    -
                  </button>

                  <span className="font-medium w-4 text-center">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => adjustItemQuantity(item.id, 1)}
                    className="w-6 h-6 bg-white border border-gray-300 rounded-full flex justify-center items-center text-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 總金額 + 結帳 */}
        <div className="border-t border-gray-200 mt-6 pt-4 space-y-3">
          <div className="flex justify-between items-center text-xl font-bold">
            <span>總金額</span>
            <span className="text-red-600">NT$ {cartTotal}</span>
          </div>

          <button
            onClick={checkout}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-lg text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50"
            style={{ backgroundColor: COLOR_ACTION_ORANGE }}
          >
            前往結帳
          </button>
        </div>
      </div>
    </aside>
  );
};

// -------------------------------------------------------------
// Notification Toast（全局提示訊息）
// -------------------------------------------------------------
const NotificationToast = () => {
  const { notification, setNotification } = useContext(AppContext);

  useEffect(() => {
    if (notification.message) {
      const t = setTimeout(() => {
        setNotification({ message: "", type: "info" });
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [notification.message]);

  if (!notification.message) return null;

  let color = "bg-gray-600";
  if (notification.type === "success") color = "bg-green-500";
  if (notification.type === "error") color = "bg-red-500";
  if (notification.type === "info") color = "bg-yellow-500";

  return (
    <div
      className={`fixed top-4 right-4 ${color} text-white p-4 rounded-lg shadow-xl z-50`}
    >
      {notification.message}
    </div>
  );
};
// -------------------------------------------------------------
// Navigation Button Component（缺少會造成整頁掛掉）
// -------------------------------------------------------------
const NavButton = ({ page, currentPage, setPage, icon: Icon, children }) => {
  const isActive = currentPage === page;

  return (
    <button
      onClick={() => setPage(page)}
      className={`flex items-center px-4 py-2 rounded-lg font-semibold transition ${
        isActive ? "bg-gray-100" : "hover:bg-gray-100"
      }`}
      style={{
        color: isActive ? "#007BFF" : "#555",
        borderBottom: isActive ? "3px solid #007BFF" : "none",
      }}
    >
      <Icon className="w-5 h-5 mr-2" />
      {children}
    </button>
  );
};

// -------------------------------------------------------------
// App 主介面（含 Header、Navigation）
// -------------------------------------------------------------
const App = () => {
  const { page, setPage, isAuthReady, userProfile } =
    useContext(AppContext);

  const renderPage = () => {
    if (!isAuthReady) {
      return (
        <div className="text-center py-20 text-gray-500">
          系統連線中，請稍候...
        </div>
      );
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

  // 若未完成登入資訊，強制跳 login
  useEffect(() => {
    if (isAuthReady && !userProfile.name && page !== "login") {
      setPage("login");
    }
  }, [isAuthReady, userProfile.name]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header
        className="bg-white shadow-md sticky top-0 z-10 border-b-4"
        style={{ borderColor: COLOR_TECH_BLUE }}
      >
        <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
          <h1
            className="text-2xl font-extrabold"
            style={{ color: COLOR_FRESH_GREEN }}
          >
            VeggieTech Direct
          </h1>

          <div className="flex space-x-3">
            {page !== "login" && (
              <>
                <NavButton
                  page="shop"
                  currentPage={page}
                  setPage={setPage}
                  icon={HomeIcon}
                >
                  智慧選購
                </NavButton>

                <NavButton
                  page="profile"
                  currentPage={page}
                  setPage={setPage}
                  icon={UserIcon}
                >
                  {userProfile.name || "會員中心"}
                </NavButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
     {/* Main Layout */}
{page === "login" ? (
  // ===== 登入頁專用舞台（圖2關鍵）=====
  <main className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 px-4">
    {renderPage()}
  </main>
) : (
  // ===== 登入後系統版型 =====
  <div className="max-w-7xl mx-auto p-4 md:p-8 lg:flex lg:space-x-8">
    <main className="lg:w-3/4">{renderPage()}</main>

    <div className="lg:w-1/4 mt-10 lg:mt-0">
      <CartSidebar />
    </div>
  </div>
)}


      <NotificationToast />
      <GlobalStyles />
    </div>
  );
};

// -------------------------------------------------------------
// SVG icons（Lucide Style）
// -------------------------------------------------------------
const HomeIcon = props => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const UserIcon = props => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M6 22v-2a6 6 0 0 1 12 0v2" />
  </svg>
);

const ShoppingBagIcon = props => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" x2="21" y1="6" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const HeartOutline = props => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7 7-7Z" />
  </svg>
);

const HeartFilled = props => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 21l7-7c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2C10.5 3.5 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
  </svg>
);

// -------------------------------------------------------------
// 最終輸出 App
// -------------------------------------------------------------
export default () => (
  <AppProvider>
    <App />
  </AppProvider>
);
