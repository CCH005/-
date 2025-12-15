import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// --- VI 顏色定義 ---
const COLOR_TECH_BLUE = '#007BFF'; // 科技藍
const COLOR_FRESH_GREEN = '#28A745'; // 新鮮綠
const COLOR_ACTION_ORANGE = '#FF8800'; // 行動橘
// --------------------

// --- Global Variables (Provided by Canvas Environment) ---
// Note: These must be accessed defensively in case the environment isn't fully set up yet.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The core component for the application
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newProductName, setNewProductName] = useState('');

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    // Check if configuration is available
    if (!Object.keys(firebaseConfig).length) {
        console.error("Firebase configuration is missing or empty.");
        return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Listener for Auth State Changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // If the user logs out, clear the ID
          setUserId(null); 
        }
        setIsAuthReady(true); // Signal that the initial auth check is complete
      });

      // Handle initial sign-in logic (runs once)
      const handleSignIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (e) {
          console.error("Firebase sign-in failed:", e);
          setError("Authentication failed. Check console for details.");
          setIsAuthReady(true);
        }
      };

      // Ensure sign-in runs right after setting up the listener
      handleSignIn();

      // Cleanup function
      return () => unsubscribe();

    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setError("Failed to initialize Firebase services.");
    }
  }, []);

  // 2. Data Fetching (runs when db/auth is ready and userId is set)
  useEffect(() => {
    // Guard clause: Do not run query until Firebase is initialized and auth state is confirmed
    if (!db || !isAuthReady || !userId) {
      if (isAuthReady) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // CRITICAL FIX: Ensure the public path is constructed correctly:
    // /artifacts/{appId}/public/data/{collectionName}
    const collectionPath = `artifacts/${appId}/public/data/products`;
    const publicProductsRef = collection(db, collectionPath);

    console.log(`Attempting to listen to public path: ${collectionPath}`);

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(publicProductsRef, (snapshot) => {
      try {
        const productList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productList);
        setLoading(false);
      } catch (e) {
        console.error("Error processing public products snapshot:", e);
        setError("Error fetching products. Permissions likely fixed, but data structure might be wrong.");
        setLoading(false);
      }
    }, (e) => {
      // This catches the 'Missing or insufficient permissions' error directly
      console.error("Error fetching public products:", e);
      setError(`Error fetching public data: ${e.message}.`);
      setLoading(false);
    });

    // Cleanup function to detach the listener
    return () => unsubscribe();
  }, [db, isAuthReady, userId]); // Dependencies ensure this runs only after initialization and sign-in

  // 3. Data Submission Function
  const addProduct = useCallback(async (e) => {
    e.preventDefault();
    if (!db || !userId || !newProductName.trim()) return;

    setLoading(true);

    try {
      const collectionPath = `artifacts/${appId}/public/data/products`;
      const publicProductsRef = collection(db, collectionPath);

      // Add a new document to the public collection
      await setDoc(doc(publicProductsRef), {
        name: newProductName.trim(),
        price: (Math.random() * 100 + 10).toFixed(2), // Example data
        createdAt: serverTimestamp(),
        createdBy: userId,
      });

      setNewProductName('');
    } catch (e) {
      console.error("Error adding public product:", e);
      setError("Failed to add product. Check write permissions.");
    } finally {
      setLoading(false);
    }
  }, [db, userId, newProductName]);


  // --- UI Rendering ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <header className="w-full max-w-2xl text-center py-6">
        {/* VI: 標題使用科技藍 */}
        <h1 
          className="text-3xl font-bold" 
          style={{ color: COLOR_TECH_BLUE }}
        >
          VeggieTech Direct - 公開商品列表
        </h1>
        <p className="text-sm text-gray-500 mt-1">
            App ID: <span className="font-mono text-xs bg-gray-200 px-1 py-0.5 rounded">{appId}</span> | 
            User ID: {isAuthReady ? (
                <span className="font-mono text-xs bg-green-200 px-1 py-0.5 rounded">{userId || 'N/A'}</span>
            ) : (
                <span className="text-xs text-yellow-600">Authenticating...</span>
            )}
        </p>
      </header>

      <div className="w-full max-w-2xl bg-white shadow-xl rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">新增產品 (公開寫入測試)</h2>
        <form onSubmit={addProduct} className="flex gap-2">
          <input
            type="text"
            placeholder="產品名稱"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            // VI: Input Focus Ring 使用科技藍
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            disabled={!isAuthReady || loading}
            required
          />
          <button
            type="submit"
            // VI: 按鈕使用行動橘 (CTA)
            className="px-5 py-3 text-white font-medium rounded-lg hover:opacity-90 transition duration-150 disabled:bg-gray-300 shadow-md"
            style={{ backgroundColor: COLOR_ACTION_ORANGE }}
            disabled={!isAuthReady || loading || !newProductName.trim()}
          >
            {loading && newProductName.trim() ? '新增中...' : '新增產品'}
          </button>
        </form>
      </div>

      <main className="w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-3 text-gray-700 border-l-4 pl-3" style={{ borderColor: COLOR_TECH_BLUE }}>現有產品 (公開讀取測試)</h2>
        
        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4" role="alert">
                <p className="font-bold">資料庫錯誤</p>
                <p>{error}</p>
            </div>
        )}

        {loading && !products.length && (
            <div className="p-4 text-center text-gray-500">載入產品中...</div>
        )}

        {!loading && !products.length && !error && (
             <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">未找到任何產品。請在上方新增一個！</div>
        )}

        {products.length > 0 && (
          <div className="bg-white shadow-xl rounded-xl divide-y divide-gray-200">
            {products.map((product) => (
              <div key={product.id} className="p-4 hover:bg-gray-50 transition duration-100 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">{product.name}</span>
                  <span className="text-sm text-gray-500">建立者: {product.createdBy.substring(0, 8)}...</span>
                </div>
                {/* VI: 價格使用新鮮綠 */}
                <span className="text-lg font-bold" style={{ color: COLOR_FRESH_GREEN }}>NT$ {product.price}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
