// index.js - 新鮮市集 Node.js 後端服務器 (針對 public 資料夾的修正版)

// 引入核心模組
const express = require('express');
const path = require('path');
const app = express();

// 設置 Port。優先使用 Render 提供的環境變數 PORT
const PORT = process.env.PORT || 3000;
// ⚠️ 修正：將路徑設定為指向您實際使用的 public 資料夾
const PUBLIC_DIR = path.join(__dirname, 'public'); 

// =========================================================================
// 1. 中介軟體 (Middleware) 設定
// =========================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態檔案服務設定 (Static Files Middleware)
// 告訴 Express，public 資料夾中的所有資源都可以直接被存取。
app.use(express.static(PUBLIC_DIR)); 


// =========================================================================
// 2. 應用程式路由 (Routes)
// =========================================================================

// 根路由 (Root Route) - 提供網站主頁面
// 當用戶訪問網址根目錄時
app.get('/', (req, res) => {
    // 傳送 public 資料夾中的 index.html 檔案給瀏覽器
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});


// 範例 API 路由 - 商品清單 (GET)
app.get('/api/products', (req, res) => {
    res.json({ message: "API 運行中，準備好連線資料庫獲取商品清單..." });
});

// 範例 API 路由 - 結帳處理 (POST)
app.post('/api/checkout', (req, res) => {
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
    console.log(`Server is running on port ${PORT}`);
    console.log(`Web Service Accessible at http://localhost:${PORT} (local dev only)`);
});
