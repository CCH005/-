// index.js - 新鮮市集 Node.js 後端服務器

// 引入核心模組
const express = require('express');
const path = require('path'); // 用於處理檔案路徑
const app = express();

// 設置 Port。優先使用 Render 提供的環境變數 PORT，否則使用 3000 (本地開發用)
const PORT = process.env.PORT || 3000;

// =========================================================================
// 中介軟體 (Middleware) 設定
// =========================================================================

// 讓 Express 能夠解析傳入的 JSON 格式請求 body
app.use(express.json());

// =========================================================================
// 1. 靜態檔案服務設定 (Static Files Middleware) - 關鍵！
// =========================================================================
// 告訴 Express，所有在 'public' 資料夾中的檔案（如 CSS, JS, 圖片）都可以直接被瀏覽器存取。
// 這樣您的 index.html 才能找到 app.js 和 Tailwind CSS。
app.use(express.static(path.join(__dirname, 'public')));


// =========================================================================
// 2. 應用程式路由 (Routes)
// =========================================================================

// 根路由 (Root Route)
// 當用戶訪問網址根目錄 (e.g., https://yoursite.onrender.com/) 時
app.get('/', (req, res) => {
    // 傳送 public 資料夾中的 index.html 檔案給瀏覽器
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// 範例 API 路由 - 獲取商品清單 (未來會連線資料庫)
app.get('/api/products', (req, res) => {
    // 這裡的邏輯未來會替換成查詢 PostgreSQL 資料庫
    res.json({ message: "API 運行中，準備好連線資料庫獲取商品清單..." });
});

// 範例 API 路由 - 處理結帳請求 (未來會寫入訂單到資料庫)
app.post('/api/checkout', (req, res) => {
    // 這裡的邏輯未來會替換成處理訂單和庫存扣除
    console.log('接收到新的結帳請求，資料如下:', req.body);

    res.status(200).json({
        message: '訂單處理請求已接收！ (請注意，目前僅為模擬)',
        status: 'pending'
    });
});


// =========================================================================
// 3. 啟動伺服器
// =========================================================================

app.listen(PORT, () => {
    // 伺服器啟動成功時，會在 Render 的日誌 (Logs) 中顯示
    console.log(`Server is running on port ${PORT}`);
    console.log(`Web Service Accessible at http://localhost:${PORT} (local dev only)`);
});
