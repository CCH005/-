import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 如果你有 AppProvider，請啟用下一行
// import { AppProvider } from "./context/AppProvider.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // 如果你有 AppProvider，請改成：
  // <AppProvider>
  //   <App />
  // </AppProvider>

  <React.StrictMode>
    <App />
  </React.StrictMode>
);
