import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
   // 使用相對路徑，避免部署在子路徑或以 file:// 直接開啟時載入不到資源而呈現空白畫面
  base: "./",
  plugins: [react()],
});
