import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/**
 * 捕捉執行時錯誤，避免使用者只看到空白頁面。
 * Render production 頻繁因環境差異出現未預期的錯誤時，
 * 也會在此顯示回饋並提供重新整理按鈕。
 */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "未知錯誤" };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          background: "#f9fafb",
          color: "#1f2937",
          textAlign: "center",
          padding: "24px"
        }}>
          <div style={{
            padding: "16px 20px",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            maxWidth: "520px",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#ffe8e8",
              color: "#d0312d",
              fontSize: "24px",
              marginBottom: "10px",
            }}>
              ⚠️
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>系統出現小問題</h2>
            <p style={{ margin: 0, color: "#4b5563" }}>
              {this.state.message || "請稍後再試，或重新整理後繼續使用。"}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              marginTop: "4px",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#007BFF",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(0, 123, 255, 0.25)",
            }}
          >
            重新整理頁面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
