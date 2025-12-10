// 引入所需的模組
const express = require('express');
const app = express();
const path = require('path');

// 設置 Port。優先使用 Render 提供的環境變數 PORT，否則使用 3000 (本地開發用)
const PORT = process.env.PORT || 3000;

// =========================================================================
// 中介軟體 (Middleware) 設定
// =========================================================================

// 讓 Express 能夠解析傳入的 JSON 格式請求 body
app.use(express.json());

// =========================================================================
// 路由 (Routes) 定義
// =========================================================================

// 1. 根路由 (Root Route) - 用於檢查服務是否活著
app.get('/', (req, res) => {
    // 部署成功後，瀏覽器訪問網站會看到這段文字
    res.send('新鮮市集 Node.js 後端服務運行中！版本 1.0');
});

// 2. 範例 API 路由 - 商品清單 (未來將連線資料庫)
app.get('/api/products', (req, res) => {
    // 模擬從資料庫讀取的商品資料
    const demoProducts = [
        { id: 1, name: '高麗菜', price: 80, unit: '顆' },
        { id: 2, name: '小黃瓜', price: 45, unit: '把' },
        { id: 3, name: '牛番茄', price: 75, unit: '盒' }
    ];
    
    // 返回 JSON 格式數據
    res.json(demoProducts);
});

// 3. 範例 API 路由 - 結帳 (未來將寫入訂單到資料庫)
app.post('/api/checkout', (req, res) => {
    // 假設前端發送了訂單資訊
    // const orderData = req.body; 

    // 這裡應該執行：
    // 1. 驗證訂單資料
    // 2. 扣除庫存 (資料庫寫入)
    // 3. 建立訂單紀錄 (資料庫寫入)

    console.log('接收到新的結帳請求');
    
    // 模擬成功回應
    res.status(200).json({ 
        message: '訂單處理成功！', 
        orderId: Math.floor(Math.random() * 10000)
    });
});


// =========================================================================
// 啟動伺服器
// =========================================================================

app.listen(PORT, () => {
    // 伺服器啟動成功時，會在 Render 的日誌 (Logs) 中顯示
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the root at http://localhost:${PORT} (local dev only)`);
});
