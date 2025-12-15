import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';

// 引入 Firebase 相關模組
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, doc, setDoc, updateDoc, onSnapshot, 
    collection, addDoc, serverTimestamp, setLogLevel 
} from 'firebase/firestore';

// 設置 Firebase 全局變數 (從 Canvas/Render 環境獲取)
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-fresh-market';
// 修正 1: 更加嚴格地清理 appId，確保只有純 ID，以解決 Firestore 路徑錯誤。
const APP_ID_SEGMENT = rawAppId.split('/')[0].split('_').slice(0, 2).join('_');
const FIREBASE_APP_ID = APP_ID_SEGMENT.includes('c_') ? APP_ID_SEGMENT : 'default-fresh-market'; 

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
// 修正 2: 修正 initialAuthToken 的賦值錯誤，確保抓取到全域變數 __initial_auth_token
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase 實例 (在 useEffect 中初始化)
let db = null;
let auth = null;

// =========================================================================
// VI 顏色定義
// =========================================================================
const COLOR_TECH_BLUE = '#007BFF'; // 科技藍 - 主要結構
const COLOR_FRESH_GREEN = '#28A745'; // 新鮮綠 - 產品成功
const COLOR_ACTION_ORANGE = '#FF8800'; // 行動橘 - CTA/促銷

// =========================================================================
// 模擬/初始化資料 (如果 Firestore 沒有資料時使用)
// =========================================================================

const MOCK_PRODUCTS = [
    { id: 'p001', name: '有機菠菜', price: 45, unit: '包', category: '葉菜類', icon: '🥬' },
    { id: 'p002', name: '高山高麗菜', price: 80, unit: '顆', category: '葉菜類', icon: '🥗' },
    { id: 'p003', name: '空心菜', price: 35, unit: '把', category: '葉菜類', icon: '🍃' },
    { id: 'p004', name: '小黃瓜', price: 50, unit: '條', category: '瓜果類', icon: '🥒' },
    { id: 'p005', name: '牛番茄', price: 75, unit: '盒', category: '瓜果類', icon: '🍅' },
    { id: 'p006', name: '日本南瓜', price: 90, unit: '個', category: '瓜果類', icon: '🎃' },
    { id: 'p007', name: '紅蘿蔔', price: 40, unit: '袋', category: '根莖類', icon: '🥕' },
    { id: 'p008', name: '馬鈴薯', price: 65, unit: '袋', category: '根莖類', icon: '🥔' },
];

// =========================================================================
// Context for Global State
// =========================================================================

const AppContext = React.createContext();

// =========================================================================
// Utility Components
// =========================================================================

// 導航按鈕 (Navigation Button)
const NavButton = ({ children, page, currentPage, setPage, icon: Icon }) => (
    <button
        onClick={() => setPage(page)}
        className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center font-semibold ${
            currentPage === page
                ? 'text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        // 使用科技藍作為活躍色
        style={{ backgroundColor: currentPage === page ? COLOR_TECH_BLUE : undefined }}
    >
        {Icon && <Icon className="w-5 h-5 mr-2" />}
        {children}
    </button>
);

// 系統通知 Toast
const NotificationToast = () => {
    const { notification, setNotification } = useContext(AppContext);

    useEffect(() => {
        if (notification.message) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: 'info' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification.message, setNotification]);

    if (!notification.message) return null;

    let color = 'bg-gray-500';
    if (notification.type === 'success') color = 'bg-green-500'; // 新鮮綠
    if (notification.type === 'error') color = 'bg-red-500';
    if (notification.type === 'info') color = 'bg-yellow-500'; // 接近行動橘

    return (
        <div className={`fixed top-4 right-4 ${color} text-white p-4 rounded-lg shadow-2xl transition-all duration-300 z-50 transform animate-pulse max-w-sm`}>
            {notification.message}
        </div>
    );
};

// 修正 2: 處理 React style jsx global 錯誤，改用標準方式插入 CSS
const GlobalStyles = () => {
    const css = `
        /* Custom Scrollbar for Cart */
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: ${COLOR_FRESH_GREEN}50;
            border-radius: 20px;
        }
    `;
    return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

// =========================================================================
// Firebase Logic and Global State Provider
// =========================================================================

const AppProvider = ({ children }) => {
    const [page, setPage] = useState('login');
    const [user, setUser] = useState(null); 
    const [userId, setUserId] = useState(null); 
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Data State
    const [products, setProducts] = useState(MOCK_PRODUCTS);
    const [cart, setCart] = useState({}); 
    // 確保 favorites 始終為陣列
    const [userProfile, setUserProfile] = useState({ name: '新用戶', email: '', address: '', favorites: [] });
    const [orders, setOrders] = useState([]);
    const [notification, setNotification] = useState({ message: '', type: 'info' });

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Firebase config is missing.");
            setIsAuthReady(true);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            setLogLevel('debug');

            const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    setUserId(currentUser.uid);
                    if (currentUser.isAnonymous && initialAuthToken === null) {
                        setPage('login');
                    } else {
                        setPage('shop');
                    }
                } else {
                    // 嘗試使用自定義權杖登入，如果失敗則退回匿名登入
                    if (initialAuthToken) {
                        try {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } catch (tokenError) {
                            console.error("Custom token sign-in failed, falling back to anonymous:", tokenError);
                            setNotification({ message: '自動登入權杖失效，正在使用匿名模式。', type: 'error' });
                            // 權杖登入失敗，退回純匿名登入
                            await signInAnonymously(auth);
                        }
                    } else {
                        await signInAnonymously(auth);
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            setIsAuthReady(true);
        }
    }, []);

    // --- Firestore Listeners ---

    // 1. 產品清單 (Public)
    useEffect(() => {
        if (!isAuthReady || !db) return;
        
        // 使用修正後的 FIREBASE_APP_ID
        const productsRef = collection(db, 'artifacts', FIREBASE_APP_ID, 'public', 'data', 'products');
        
        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
            if (snapshot.empty) {
                MOCK_PRODUCTS.forEach(async (product) => {
                    await setDoc(doc(productsRef, product.id), product);
                });
                setProducts(MOCK_PRODUCTS);
                setNotification({ message: '已使用預設產品資料初始化市集', type: 'info' });
                return;
            }

            const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productList);
        }, (error) => {
            console.error("Error fetching public products:", error);
            setProducts(MOCK_PRODUCTS);
        });

        return () => unsubscribe();
    }, [isAuthReady]);


    // 2. 用戶資料與最愛 (Private Document)
    useEffect(() => {
        if (!userId || !db) return;

        // 使用修正後的 FIREBASE_APP_ID
        const profileRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'profile', 'data');
        
        const unsubscribe = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserProfile({ ...data, favorites: data.favorites || [] });
            } else {
                setDoc(profileRef, { name: '新用戶', email: '', address: '', favorites: [] }, { merge: true });
            }
        }, (error) => {
            console.error("Error fetching user profile:", error);
        });

        return () => unsubscribe();
    }, [userId]);


    // 3. 購物車 (Private Document)
    useEffect(() => {
        if (!userId || !db) return;

        // 使用修正後的 FIREBASE_APP_ID
        const cartRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'cart', 'current');
        
        const unsubscribe = onSnapshot(cartRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().items) {
                const itemsArray = docSnap.data().items;
                const newCart = itemsArray.reduce((acc, item) => {
                    acc[item.id] = item;
                    return acc;
                }, {});
                setCart(newCart);
            } else {
                setCart({}); 
            }
        }, (error) => {
            console.error("Error fetching cart:", error);
        });

        return () => unsubscribe();
    }, [userId]);


    // 4. 歷史訂單 (Private Collection)
    useEffect(() => {
        if (!userId || !db) return;

        // 使用修正後的 FIREBASE_APP_ID
        const ordersQuery = collection(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'orders');

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 本地排序 (按時間戳降序)
            orderList.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
            setOrders(orderList);
        }, (error) => {
            console.error("Error fetching orders:", error);
        });

        return () => unsubscribe();
    }, [userId]);


    // --- Actions ---

    const cartItemsArray = useMemo(() => Object.values(cart), [cart]);
    const cartTotal = useMemo(() => 
        cartItemsArray.reduce((total, item) => total + (item.price * item.quantity), 0), 
    [cartItemsArray]);

    const updateCartInFirestore = useCallback(async (newCartState) => {
        if (!userId || !db) return;
        
        const itemsArray = Object.values(newCartState);
        // 使用修正後的 FIREBASE_APP_ID
        const cartRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'cart', 'current');

        try {
            await setDoc(cartRef, { items: itemsArray, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            setNotification({ message: '購物車更新失敗: ' + error.message, type: 'error' });
            console.error("Error updating cart:", error);
        }
    }, [userId]);

    const addItemToCart = useCallback((product) => {
        if (!userId) {
            setNotification({ message: '請先登入才能使用購物車功能！', type: 'error' });
            return;
        }
        
        const newCart = { ...cart };
        const productId = product.id;
        
        if (newCart[productId]) {
            newCart[productId].quantity += 1;
        } else {
            newCart[productId] = { 
                ...product, 
                quantity: 1,
                price: product.price 
            };
        }
        setCart(newCart);
        updateCartInFirestore(newCart);
        setNotification({ message: `${product.name} 已加入購物車`, type: 'success' });
    }, [cart, userId, updateCartInFirestore]);


    const adjustItemQuantity = useCallback((productId, change) => {
        const newCart = { ...cart };
        if (!newCart[productId]) return;

        newCart[productId].quantity += change;

        if (newCart[productId].quantity <= 0) {
            delete newCart[productId];
        }

        setCart(newCart);
        updateCartInFirestore(newCart);
    }, [cart, updateCartInFirestore]);


    const checkout = useCallback(async () => {
        if (!userId || cartItemsArray.length === 0) {
            setNotification({ message: '購物車是空的！', type: 'error' });
            return;
        }

        const orderData = {
            timestamp: serverTimestamp(),
            total: cartTotal,
            items: cartItemsArray,
            status: 'Processing',
            customerName: userProfile.name,
            customerUID: userId
        };

        try {
            // 1. 寫入訂單歷史
            // 使用修正後的 FIREBASE_APP_ID
            await addDoc(collection(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'orders'), orderData);
            
            // 2. 清空購物車
            // 使用修正後的 FIREBASE_APP_ID
            const cartRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'cart', 'current');
            await setDoc(cartRef, { items: [], updatedAt: serverTimestamp() });
            
            setNotification({ message: `結帳成功！訂單金額 NT$ ${cartTotal}`, type: 'success' });
            setPage('profile'); // 結帳後導向會員中心查看訂單

        } catch (error) {
            setNotification({ message: '結帳失敗: ' + error.message, type: 'error' });
            console.error("Checkout failed:", error);
        }
    }, [userId, cartItemsArray, cartTotal, userProfile.name]);


    const toggleFavorite = useCallback(async (productId) => {
        if (!userId) {
            setNotification({ message: '請先登入才能使用我的最愛功能！', type: 'error' });
            return;
        }

        // 使用修正後的 FIREBASE_APP_ID
        const profileRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'profile', 'data');
        const favorites = userProfile.favorites || [];
        
        let newFavorites;
        let message;

        if (favorites.includes(productId)) {
            newFavorites = favorites.filter(id => id !== productId);
            message = '已從我的最愛中移除';
        } else {
            newFavorites = [...favorites, productId];
            message = '已加入我的最愛！';
        }

        try {
            // 更新 Firestore 中的 favorites 欄位
            await updateDoc(profileRef, { favorites: newFavorites });
            setNotification({ message: message, type: 'info' });
        } catch (error) {
            setNotification({ message: '更新我的最愛失敗: ' + error.message, type: 'error' });
        }
    }, [userId, userProfile.favorites]);


    const value = {
        page, setPage, user, userId, isAuthReady,
        products, cart: cartItemsArray, cartTotal,
        userProfile, setUserProfile, orders,
        notification, setNotification,
        addItemToCart, adjustItemQuantity, checkout, toggleFavorite
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// =========================================================================
// Page Components
// =========================================================================

// 登入/會員中心
const LoginScreen = () => {
    const { isAuthReady, userId, setPage, setNotification } = useContext(AppContext);
    const [loginName, setLoginName] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!loginName || !loginEmail) {
            setNotification({ message: '請輸入姓名和電子郵件！', type: 'error' });
            return;
        }
        
        if (!userId) {
             setNotification({ message: '認證錯誤，請聯繫管理員', type: 'error' });
             return;
        }

        // 使用修正後的 FIREBASE_APP_ID
        const profileRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'profile', 'data');
        
        try {
            setLoading(true);
            await setDoc(profileRef, { 
                name: loginName, 
                email: loginEmail,
                lastLogin: serverTimestamp(),
                favorites: [] // 確保 favorites 欄位存在
            }, { merge: true });

            setNotification({ message: '登入成功！歡迎回來。', type: 'success' });
            setPage('shop');

        } catch (error) {
            setNotification({ message: '登入失敗: ' + error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthReady) {
        return <div className="text-center py-20 text-gray-500">系統初始化中...</div>;
    }

    return (
        <div className="max-w-md mx-auto mt-16 p-8 bg-white shadow-xl rounded-xl border-t-8" style={{ borderTopColor: COLOR_TECH_BLUE }}>
            <h2 className="text-3xl font-bold text-center mb-6" style={{ color: COLOR_TECH_BLUE }}>會員登入 / 帳號啟用</h2>
            <p className="text-gray-600 text-center mb-8 text-sm">請輸入資料以啟用您的專屬帳號。用戶 ID: {userId || 'N/A'}</p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">您的姓名</label>
                    <input
                        type="text"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="請輸入您的姓名"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件 (作為帳號)</label>
                    <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="請輸入電子郵件"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full mt-8 py-3 text-white font-semibold rounded-lg shadow-md transition duration-300 disabled:opacity-50 flex items-center justify-center hover:shadow-lg"
                // 登入按鈕使用行動橘
                style={{ backgroundColor: COLOR_ACTION_ORANGE }}
            >
                {loading ? (
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" /></svg>
                ) : (
                    '確認登入並進入商城'
                )}
            </button>
        </div>
    );
};

// 商品清單頁面
const ShopScreen = () => {
    const { products, addItemToCart, userProfile, toggleFavorite } = useContext(AppContext);
    const [selectedCategory, setSelectedCategory] = useState('全部');

    // 取得所有不重複的商品類別
    const categories = useMemo(() => ['全部', '我的最愛', ...new Set(products.map(p => p.category))], [products]);

    // 根據選擇的類別篩選商品
    const filteredProducts = useMemo(() => {
        const favorites = userProfile.favorites || [];
        if (selectedCategory === '全部') return products;
        if (selectedCategory === '我的最愛') return products.filter(p => favorites.includes(p.id));
        return products.filter(p => p.category === selectedCategory);
    }, [products, selectedCategory, userProfile.favorites]);

    const favorites = userProfile.favorites || [];

    const ProductCard = ({ product }) => {
        const isFavorite = favorites.includes(product.id);
        const HeartIcon = isFavorite ? HeartFilled : HeartOutline;

        return (
            <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col justify-between transform hover:shadow-xl transition duration-300" 
                 // 使用新鮮綠作為產品卡的左側點綴色
                 style={{ borderLeft: `5px solid ${COLOR_FRESH_GREEN}` }}>
                <div className="flex justify-between items-start mb-3">
                    <span className="text-4xl">{product.icon}</span>
                    <button 
                        onClick={() => toggleFavorite(product.id)}
                        className={`p-2 rounded-full transition-colors`}
                        // 我的最愛按鈕使用行動橘
                        style={{ color: isFavorite ? COLOR_ACTION_ORANGE : '#D1D5DB' }}
                        title="加到我的最愛"
                    >
                        <HeartIcon className="w-6 h-6 fill-current" />
                    </button>
                </div>
                <h3 className="text-xl font-bold text-gray-800">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                
                <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-100">
                    <p className="text-xl font-extrabold text-red-600">NT$ {product.price} / {product.unit}</p>
                    <button 
                        onClick={() => addItemToCart(product)}
                        className="px-4 py-2 text-white font-medium rounded-full transition duration-150 shadow-md flex items-center text-sm hover:opacity-90"
                        // 加入購物車使用新鮮綠
                        style={{ backgroundColor: COLOR_FRESH_GREEN }}
                    >
                        <ShoppingBagIcon className="w-4 h-4 mr-1" />
                        加入
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-l-4 pl-4" style={{ borderLeftColor: COLOR_TECH_BLUE }}>智慧蔬果選購</h2>
            
            {/* 分類篩選 (使用科技藍和行動橘 VI) */}
            <div className="flex flex-wrap gap-2 mb-8">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 text-sm rounded-full font-semibold transition-colors ${
                            selectedCategory === cat
                                ? 'text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        style={{ 
                            // 我的最愛使用行動橘，其他使用科技藍
                            backgroundColor: selectedCategory === cat 
                                ? (cat === '我的最愛' ? COLOR_ACTION_ORANGE : COLOR_TECH_BLUE) 
                                : undefined,
                            color: selectedCategory === cat ? 'white' : 'inherit'
                        }}
                    >
                        {cat}
                        {cat === '我的最愛' && ` (${favorites.length})`}
                    </button>
                ))}
            </div>

            {/* 商品網格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
            {filteredProducts.length === 0 && (
                <p className="text-center text-gray-500 py-10">此分類或我的最愛中暫無商品。</p>
            )}
        </div>
    );
};

// 個人資料與訂單頁面
const ProfileScreen = () => {
    const { userProfile, orders, setNotification, userId } = useContext(AppContext);
    const [isEditing, setIsEditing] = useState(false);
    const [tempProfile, setTempProfile] = useState(userProfile);
    const [activeTab, setActiveTab] = useState('profile'); 

    useEffect(() => {
        setTempProfile(userProfile);
    }, [userProfile]);

    const handleSave = async () => {
        if (!tempProfile.name || !tempProfile.address) {
            setNotification({ message: '姓名和地址不能為空！', type: 'error' });
            return;
        }

        // 使用修正後的 FIREBASE_APP_ID
        const profileRef = doc(db, 'artifacts', FIREBASE_APP_ID, 'users', userId, 'profile', 'data');
        try {
            await setDoc(profileRef, tempProfile, { merge: true });
            setNotification({ message: '資料更新成功！', type: 'success' });
            setIsEditing(false);
        } catch (error) {
            setNotification({ message: '資料更新失敗: ' + error.message, type: 'error' });
        }
    };

    const OrderItem = ({ order }) => (
        <div className="bg-white p-4 rounded-xl shadow-lg mb-4 border-l-4 border-gray-200" style={{ borderLeftColor: COLOR_FRESH_GREEN }}>
            <div className="flex justify-between items-center border-b pb-2 mb-2">
                <h4 className="font-semibold text-lg" style={{ color: COLOR_TECH_BLUE }}>訂單編號: #{order.id.substring(0, 8)}</h4>
                <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                    order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                    {order.status || '已完成'}
                </span>
            </div>
            <p className="text-sm text-gray-500 mb-1">
                訂購時間: {order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleString('zh-TW') : 'N/A'}
            </p>
            <p className="font-bold text-xl text-red-600">總金額: NT$ {order.total}</p>
            
            <div className="mt-3 text-sm text-gray-600 border-t pt-2">
                <p className="font-semibold">訂購商品 ({order.items.length} 項):</p>
                <ul className="list-disc ml-4">
                    {order.items.map((item, index) => (
                        <li key={index} className="text-xs">
                            {item.name} x {item.quantity} ({item.price}元/{item.unit})
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-l-4 pl-4" style={{ borderLeftColor: COLOR_TECH_BLUE }}>會員中心與訂單查詢</h2>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-8">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'profile' ? 'border-b-4 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    style={{ borderBottomColor: activeTab === 'profile' ? COLOR_TECH_BLUE : undefined }}
                >
                    個人資料編輯
                </button>
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'orders' ? 'border-b-4 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    style={{ borderBottomColor: activeTab === 'orders' ? COLOR_TECH_BLUE : undefined }}
                >
                    歷史訂單 ({orders.length})
                </button>
            </div>
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-xl font-bold mb-4" style={{ color: COLOR_TECH_BLUE }}>個人資訊</h3>
                    <div className="space-y-4">
                        <ProfileField label="用戶 ID" value={userId} readOnly />
                        <ProfileField label="姓名" value={tempProfile.name} isEditing={isEditing} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} />
                        <ProfileField label="電子郵件" value={tempProfile.email} isEditing={isEditing} onChange={(e) => setTempProfile({...tempProfile, email: e.target.value})} />
                        <ProfileField label="配送地址" value={tempProfile.address} isEditing={isEditing} onChange={(e) => setTempProfile({...tempProfile, address: e.target.value})} />
                    </div>

                    <div className="mt-8 flex justify-end space-x-4">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100">
                                    取消
                                </button>
                                {/* 儲存按鈕使用新鮮綠 */}
                                <button onClick={handleSave} className="px-4 py-2 text-white rounded-lg hover:opacity-90" style={{ backgroundColor: COLOR_FRESH_GREEN }}>
                                    儲存變更
                                </button>
                            </>
                        ) : (
                            // 編輯按鈕使用科技藍
                            <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-white rounded-lg hover:opacity-90" style={{ backgroundColor: COLOR_TECH_BLUE }}>
                                編輯資料
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    {orders.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">您目前沒有任何歷史訂單記錄。</p>
                    ) : (
                        orders.map(order => <OrderItem key={order.id} order={order} />)
                    )}
                </div>
            )}
        </div>
    );
};

// Profile Field Helper Component
const ProfileField = ({ label, value, isEditing, onChange, readOnly = false }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {isEditing && !readOnly ? (
            <input
                type="text"
                value={value || ''}
                onChange={onChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
        ) : (
            <p className={`p-3 border rounded-lg ${readOnly ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-800'}`}>
                {value || '未設定'}
            </p>
        )}
    </div>
);

// 購物車側欄
const CartSidebar = () => {
    const { cart, cartTotal, adjustItemQuantity, checkout } = useContext(AppContext);

    return (
        <aside className="lg:w-full sticky top-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100 border-t-4" style={{ borderTopColor: COLOR_TECH_BLUE }}>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <ShoppingBagIcon className="w-6 h-6 mr-2" style={{ color: COLOR_TECH_BLUE }} />
                    我的訂單 ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                </h2>

                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {cart.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">購物車是空的，立即選購新鮮蔬果！</p>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="flex-grow">
                                    <h4 className="text-sm font-semibold text-gray-700">{item.icon} {item.name}</h4>
                                    <p className="text-xs text-gray-500">NT$ {item.price} x {item.quantity}</p>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => adjustItemQuantity(item.id, -1)} className="w-6 h-6 bg-white border border-gray-300 text-gray-500 rounded-full hover:bg-gray-100 transition duration-150 flex items-center justify-center font-bold text-lg leading-none">-</button>
                                    <span className="font-medium w-4 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => adjustItemQuantity(item.id, 1)} className="w-6 h-6 bg-white border border-gray-300 text-gray-500 rounded-full hover:bg-gray-100 transition duration-150 flex items-center justify-center font-bold text-lg leading-none">+</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t border-gray-200 mt-6 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xl font-bold text-gray-800">
                        <span>總金額 (TWD)</span>
                        <span className="text-red-600">NT$ {cartTotal}</span>
                    </div>
                    
                    {/* 結帳按鈕使用 行動橘 (#FF8800) */}
                    <button 
                        onClick={checkout}
                        disabled={cart.length === 0}
                        className="w-full py-3 text-white font-semibold rounded-lg shadow-md transition duration-300 transform hover:scale-[1.01] disabled:opacity-50 hover:shadow-lg"
                        style={{ backgroundColor: COLOR_ACTION_ORANGE }}
                    >
                        前往結帳
                    </button>
                </div>
            </div>
        </aside>
    );
};

// =========================================================================
// Main App Component
// =========================================================================

const App = () => {
    const { page, setPage, isAuthReady, userProfile } = useContext(AppContext);

    const renderPage = () => {
        if (!isAuthReady) {
            return <div className="text-center py-20 text-gray-500">系統連線中，請稍候...</div>;
        }

        switch (page) {
            case 'login':
                return <LoginScreen />;
            case 'shop':
                return <ShopScreen />;
            case 'profile':
                return <ProfileScreen />;
            default:
                return <ShopScreen />;
        }
    };

    useEffect(() => {
        if (isAuthReady && !userProfile.name && page !== 'login') {
            setPage('login');
        }
    }, [isAuthReady, userProfile.name, page, setPage]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            {/* Header and Navigation (使用科技藍 VI) */}
            <header className="bg-white shadow-md sticky top-0 z-10 border-b-4" style={{ borderColor: COLOR_TECH_BLUE }}>
                <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
                    <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: COLOR_FRESH_GREEN }}>VeggieTech Direct</h1>
                    <div className="flex space-x-3">
                        {page !== 'login' && (
                            <>
                                <NavButton page="shop" currentPage={page} setPage={setPage} icon={HomeIcon}>智慧選購</NavButton>
                                <NavButton page="profile" currentPage={page} setPage={setPage} icon={UserIcon}>{userProfile.name || '會員中心'}</NavButton>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 md:p-8 lg:flex lg:space-x-8">
                {/* Main Content Area */}
                <main className="lg:w-3/4">
                    {renderPage()}
                </main>

                {/* Shopping Cart Sidebar */}
                {(page !== 'login') && (
                    <div className="lg:w-1/4 mt-10 lg:mt-0">
                        <CartSidebar />
                    </div>
                )}
            </div>
            
            <NotificationToast />
            <GlobalStyles /> {/* 修正 2: 插入全域樣式 */}
        </div>
    );
};

// SVG Icons (Lucide-React style)
const HomeIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const UserIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const ShoppingBagIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-bag"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 0-8 0"/></svg>
);
const HeartOutline = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);
const HeartFilled = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="lucide lucide-heart-filled"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);


export default () => (
    <AppProvider>
        <App />
    </AppProvider>
);
