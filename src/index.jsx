import React from 'react';
import ReactDOM from 'react-dom/client';
// 修正路徑: 為了繞過 Render 環境中出現的 /src/src 路徑解析錯誤，
// 我們強制使用 '../App.jsx' 來跳出錯誤的巢狀目錄，找到正確位置的主元件。
import App from '../App.jsx'; 

// 取得 HTML 中的根元素 (<div id="root">)
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  
  // 渲染應用程式
  root.render(
    <React.StrictMode>
      {/* App 元件包含 Provider 和所有頁面 */}
      <App />
    </React.StrictMode>
  );
} else {
  // 如果找不到根元素，在開發者工具中發出警告
  console.error("錯誤：無法找到 ID 為 'root' 的元素，請檢查 public/index.html。");
}
