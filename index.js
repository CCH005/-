// index.js - 新鮮市集 Node.js 後端服務器

// 引入核心模組
const express = require('express');
const path = require('path'); // 用於處理檔案路徑，確保跨系統兼容性
const app = express();

// 設置 Port。優先使用 Render 提供的環境變數 PORT，否則使用 3000 (本地開發用)
const PORT = process.env.PORT || 3000;
const VIEW_DIR = path.join(__dirname, 'views'); // 定義 views 資料夾的路徑

// =========================================================================
// 1. 中介軟體 (Middleware) 設定
// =========================================================================

// 讓 Express 能夠解析傳入的 JSON 格式請求 body (用於處理 POST 結帳請求)
app.use(express.json());

// 讓 Express 能夠處理表單數據 (如果未來有登入/註冊表單)
app.use(express.urlencoded({ extended: true }));

// 靜態檔案服務設定 (Static Files Middleware)
// 告訴 Express，views 資料夾中的所有資源（如 CSS, 圖片等）都可以直接被瀏覽器存取。
// 由於您的 CSS 是 CDN 引入，這段主要用於服務 index.html 本身。
app.use(express.static(VIEW_DIR));


// =========================================================================
// 2. 應用程式路由 (Routes)
// =========================================================================

// 根路由 (Root Route) - 提供網站主頁面
// 當用戶訪問網址根目錄 (e.g., https://yoursite.onrender.com/) 時
app.get('/', (req, res) => {
    // 傳送 views 資料夾中的 index.html 檔案給瀏覽器
    res.sendFile(path.join(VIEW_DIR, 'index.html'));
});


// 範例 API 路由 - 商品清單 (GET)
// 前端未來可以呼叫 /api/products 來獲取數據
app.get('/api/products', (req, res) => {
    // 這裡的邏輯未來會替換成查詢 PostgreSQL 資料庫
    res.json({ message: "API 運行中，準備好連線資料庫獲取商品清單..." });
});

// 範例 API 路由 - 結帳處理 (POST)
// 前端未來可以發送 POST 請求到 /api/checkout
app.post('/api/checkout', (req, res) => {
    // 這裡的邏輯未來會替換成處理訂單和庫存扣除 (資料庫操作)
    console.log('接收到新的結帳請求，資料如下:', req.body);

    res.status(200).json({
        message: '訂單處理請求已接收！ (目前僅為模擬)',
        status: 'pending'
    });
});


// =========================================================================
// 3. 啟動伺服器
// =========================================================================

app.listen(PORT, () => {
    // 伺服器啟動成功時，會顯示在 Render 的日誌 (Logs) 中
    console.log(`Server is running on port ${PORT}`);
    console.log(`Web Service Accessible at http://localhost:${PORT} (local dev only)`);
});
