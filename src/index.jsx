import React from 'react';
import ReactDOM from 'react-dom/client';
// 修正路徑: 必須使用標準的相對匯入 ./App.jsx，以符合 React 專案編譯器的要求。
// 雖然 Render 環境可能存在路徑解析錯誤，但必須先解決編譯器本身的錯誤。
import App from './App.jsx'; 

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
