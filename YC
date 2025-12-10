<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新鮮蔬菜線上購</title>
    <!-- 載入 Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* 使用 Inter 字體作為主要字體，並加入中文字體支援 */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', 'Noto Sans TC', sans-serif;
            background-color: #f8fcfb; /* 淺綠色背景 */
        }
        /* 自定義滾動條樣式，讓購物車看起來更乾淨 */
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #a7f3d0; /* 淺綠色滑塊 */
            border-radius: 20px;
        }
    </style>
</head>
<body class="min-h-screen">

    <div id="app" class="max-w-7xl mx-auto p-4 md:p-8">

        <!-- 標題區域 -->
        <header class="text-center mb-10">
            <h1 class="text-4xl font-extrabold text-green-700 tracking-tight mb-2">新鮮市集</h1>
            <p class="text-lg text-green-500">今日蔬菜，產地直送到您家</p>
        </header>

        <!-- 主要內容區域：左側商品清單，右側購物車 -->
        <div class="lg:flex lg:space-x-8">

            <!-- 1. 商品清單 (左側) -->
            <section class="lg:w-3/5">
                <h2 class="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-green-500 pl-3">本日菜單</h2>
                <div id="product-list" class="space-y-8">
                    <!-- 商品將由 JavaScript 渲染到此處 -->
                </div>
            </section>

            <!-- 2. 購物車 (右側) -->
            <aside class="lg:w-2/5 mt-10 lg:mt-0 sticky top-4">
                <div class="bg-white p-6 rounded-xl shadow-2xl border border-green-100">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                        <svg class="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        我的購物車
                        <span id="cart-item-count" class="ml-2 px-3 py-1 text-sm font-semibold bg-red-100 text-red-600 rounded-full">0</span>
                    </h2>

                    <!-- 購物車項目清單 -->
                    <div id="cart-items-container" class="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <p id="empty-cart-message" class="text-gray-500 text-center py-4">您的購物車是空的，快去選購吧！</p>
                        <!-- 購物車項目將由 JavaScript 渲染到此處 -->
                    </div>

                    <div class="border-t border-green-200 mt-6 pt-4 space-y-3">
                        <!-- 總計區域 -->
                        <div class="flex justify-between items-center text-xl font-bold text-gray-800">
                            <span>總金額 (TWD)</span>
                            <span id="cart-total" class="text-green-600">NT$ 0</span>
                        </div>
                        
                        <!-- 結帳按鈕 -->
                        <button onclick="checkout()" class="w-full py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition duration-300 transform hover:scale-[1.01]">
                            前往結帳
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <!-- JavaScript 邏輯開始 -->
    <script>
        // 設定 App ID (用於 Firestore 結構，此處為模擬)
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-shopping-app';
        
        // 1. 預設商品資料
        const products = [
            // 瓜果 (Cucurbits/Fruits)
            { id: 1, name: '小黃瓜', price: 45, unit: '把', category: '瓜果', icon: '🥒' },
            { id: 2, name: '絲瓜', price: 60, unit: '條', category: '瓜果', icon: '🧽' },
            { id: 3, name: '牛番茄', price: 75, unit: '盒', category: '瓜果', icon: '🍅' },

            // 葉菜 (Leafy Greens)
            { id: 4, name: '高麗菜', price: 80, unit: '顆', category: '葉菜', icon: '🥬' },
            { id: 5, name: '菠菜', price: 40, unit: '包', category: '葉菜', icon: '🌿' },
            { id: 6, name: '空心菜', price: 35, unit: '把', category: '葉菜', icon: '🍃' },
            { id: 7, name: 'A菜', price: 30, unit: '把', category: '葉菜', icon: '🥗' },

            // 根莖 (Root/Stem)
            { id: 8, name: '紅蘿蔔', price: 50, unit: '袋', category: '根莖', icon: '🥕' },
            { id: 9, name: '馬鈴薯', price: 65, unit: '袋', category: '根莖', icon: '🥔' },
            { id: 10, name: '洋蔥', price: 40, unit: '斤', category: '根莖', icon: '🧅' },
        ];

        // 2. 購物車狀態
        // 格式: { productId: { ...productData, quantity: X } }
        let cart = {};

        // 3. 主要 DOM 元素
        const productListEl = document.getElementById('product-list');
        const cartContainerEl = document.getElementById('cart-items-container');
        const cartTotalEl = document.getElementById('cart-total');
        const cartItemCountEl = document.getElementById('cart-item-count');
        const emptyCartMessageEl = document.getElementById('empty-cart-message');

        /**
         * 渲染商品清單
         */
        function renderProducts() {
            // 根據 category 分組
            const groupedProducts = products.reduce((acc, product) => {
                const category = product.category;
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(product);
                return acc;
            }, {});

            productListEl.innerHTML = Object.entries(groupedProducts).map(([category, items]) => {
                // 渲染每個分類的區塊
                const itemsHtml = items.map(product => `
                    <div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition duration-300 border border-gray-100">
                        <!-- 商品資訊 -->
                        <div class="flex items-center space-x-4">
                            <span class="text-3xl">${product.icon}</span>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800">${product.name}</h3>
                                <p class="text-sm text-green-500">${product.category}</p>
                            </div>
                        </div>
                        
                        <!-- 價格和動作 -->
                        <div class="flex items-center space-x-4">
                            <p class="text-xl font-bold text-red-500">NT$ ${product.price} / ${product.unit}</p>
                            <button 
                                onclick="addToCart(${product.id})"
                                class="px-4 py-2 bg-green-500 text-white font-medium rounded-full hover:bg-green-600 transition duration-150 shadow-md">
                                加入購物車
                            </button>
                        </div>
                    </div>
                `).join('');

                return `
                    <div class="category-block">
                        <h3 class="text-xl font-bold text-green-700 mb-4 border-b pb-2 border-green-200">${category}</h3>
                        <div class="space-y-3">${itemsHtml}</div>
                    </div>
                `;
            }).join('');
        }

        /**
         * 將商品加入購物車
         * @param {number} productId - 商品 ID
         */
        function addToCart(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            if (cart[productId]) {
                // 如果已在購物車中，增加數量
                cart[productId].quantity++;
            } else {
                // 否則，新增商品，數量為 1
                cart[productId] = { ...product, quantity: 1 };
            }

            updateCartUI();
        }

        /**
         * 移除購物車中的商品
         * @param {number} productId - 商品 ID
         */
        function removeFromCart(productId) {
            delete cart[productId];
            updateCartUI();
        }

        /**
         * 調整購物車中商品的數量
         * @param {number} productId - 商品 ID
         * @param {number} amount - 調整的數量 (+1 或 -1)
         */
        function changeQuantity(productId, amount) {
            if (cart[productId]) {
                cart[productId].quantity += amount;
                
                // 確保數量不小於 1
                if (cart[productId].quantity < 1) {
                    removeFromCart(productId);
                } else {
                    updateCartUI();
                }
            }
        }

        /**
         * 更新購物車的 UI 和總金額
         */
        function updateCartUI() {
            const cartItems = Object.values(cart);
            let total = 0;

            if (cartItems.length === 0) {
                cartContainerEl.innerHTML = '';
                emptyCartMessageEl.style.display = 'block';
                cartTotalEl.textContent = `NT$ 0`;
                cartItemCountEl.textContent = '0';
                return;
            }

            emptyCartMessageEl.style.display = 'none';
            
            const cartHtml = cartItems.map(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;

                return `
                    <div class="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                        <!-- 商品名稱/價格 -->
                        <div class="flex-grow">
                            <h4 class="text-sm font-semibold text-gray-700">${item.icon} ${item.name}</h4>
                            <p class="text-xs text-gray-500">NT$ ${item.price} x ${item.quantity} ${item.unit}</p>
                            <p class="text-md font-bold text-green-700 mt-1">小計: NT$ ${itemTotal}</p>
                        </div>
                        
                        <!-- 數量控制 -->
                        <div class="flex items-center space-x-2">
                            <button onclick="changeQuantity(${item.id}, -1)" class="w-8 h-8 bg-white border border-red-300 text-red-500 rounded-full hover:bg-red-100 transition duration-150 flex items-center justify-center font-bold text-lg leading-none">
                                -
                            </button>
                            <span class="font-medium w-4 text-center">${item.quantity}</span>
                            <button onclick="changeQuantity(${item.id}, 1)" class="w-8 h-8 bg-white border border-green-300 text-green-500 rounded-full hover:bg-green-100 transition duration-150 flex items-center justify-center font-bold text-lg leading-none">
                                +
                            </button>
                        </div>
                        
                        <!-- 移除按鈕 -->
                        <button onclick="removeFromCart(${item.id})" class="ml-4 text-gray-400 hover:text-red-500 transition duration-150" title="移除">
                             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
            }).join('');

            cartContainerEl.innerHTML = cartHtml;
            cartTotalEl.textContent = `NT$ ${total}`;
            cartItemCountEl.textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        }

        /**
         * 結帳功能 (顯示訊息代替實際結帳流程)
         */
        function checkout() {
            const total = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const message = total > 0
                ? `感謝您的訂購！本次訂單總金額為 NT$ ${total}。您的訂單正在處理中。`
                : '您的購物車是空的，無法結帳。';

            // 替代 alert() 的自定義提示框
            showNotification(message);

            // 如果成功結帳，清空購物車
            if (total > 0) {
                cart = {};
                updateCartUI();
            }
        }

        /**
         * 顯示自定義通知訊息 (替代 alert)
         * @param {string} message - 顯示的訊息
         */
        function showNotification(message) {
            let notification = document.getElementById('custom-notification');
            if (!notification) {
                // 建立通知框
                notification = document.createElement('div');
                notification.id = 'custom-notification';
                notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white p-4 rounded-lg shadow-xl transition-transform duration-300 transform translate-x-full opacity-0 z-50 max-w-sm';
                document.body.appendChild(notification);
            }

            notification.textContent = message;
            
            // 顯示通知
            notification.classList.remove('translate-x-full', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');

            // 3 秒後隱藏
            setTimeout(() => {
                notification.classList.remove('translate-x-0', 'opacity-100');
                notification.classList.add('translate-x-full', 'opacity-0');
            }, 3000);
        }


        // 初始化頁面
        window.onload = () => {
            renderProducts();
            updateCartUI(); // 初始載入時確保購物車是空的
        };
    </script>
</body>
</html>
