const express = require('express');
const path = require('path');
const app = express();

// 設置 Port，使用 Render 提供的 PORT
const PORT = process.env.PORT || 3000;

// =========================================================================
// 靜態檔案服務設定 (Serving the 'build' folder)
// =========================================================================

// 告訴 Express 去 'build' 資料夾找編譯後的靜態檔案
// React 的 'npm run build' 會將最終檔案輸出到 /build 目錄
const BUILD_PATH = path.join(__dirname, 'build');
app.use(express.static(BUILD_PATH));

// 根路由：將所有請求導向 React 應用的主 HTML (index.html)
// 這是單頁應用程式 (SPA) 路由的關鍵，確保無論訪問哪個路徑都由 React 處理
app.get('/*', (req, res) => {
    // 發送編譯後的 index.html 檔案
    res.sendFile(path.join(BUILD_PATH, 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}. Serving React content.`);
});
