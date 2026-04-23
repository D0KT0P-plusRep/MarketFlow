// ---------- DATA MODELS ----------
let users = [];
let products = [];
let orders = [];
let wallets = [];          // { userId, balance, heldBalance }
let transactions = [];     // история операций по кошельку
let currentUser = null;
let cart = [];
let currentPage = 'home';

// Статусы заказов
const ORDER_STATUS = {
    AWAITING_PAYMENT: 'Ожидает оплаты',
    FUNDS_HELD: 'Средства зарезервированы',
    CONFIRMED: 'Подтверждён продавцом',
    IN_TRANSIT: 'В пути',
    READY_FOR_PICKUP: 'Готов к получению',
    DELIVERED: 'Доставлен',
    CANCELLED: 'Отменён'
};

// ---------- HELPERS ----------
function getNextId(arr) {
    return arr.length > 0 ? Math.max(...arr.map(i => i.id)) + 1 : 1;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function saveAll() {
    localStorage.setItem('market_users', JSON.stringify(users));
    localStorage.setItem('market_products', JSON.stringify(products));
    localStorage.setItem('market_orders', JSON.stringify(orders));
    localStorage.setItem('market_wallets', JSON.stringify(wallets));
    localStorage.setItem('market_transactions', JSON.stringify(transactions));
    localStorage.setItem('market_cart', JSON.stringify(cart));
    if (currentUser) localStorage.setItem('market_currentUser', JSON.stringify(currentUser));
    else localStorage.removeItem('market_currentUser');
}

function loadData() {
    const storedUsers = localStorage.getItem('market_users');
    const storedProducts = localStorage.getItem('market_products');
    const storedOrders = localStorage.getItem('market_orders');
    const storedWallets = localStorage.getItem('market_wallets');
    const storedTransactions = localStorage.getItem('market_transactions');
    const storedCart = localStorage.getItem('market_cart');
    const storedUser = localStorage.getItem('market_currentUser');

    users = storedUsers ? JSON.parse(storedUsers) : [];
    products = storedProducts ? JSON.parse(storedProducts) : [];
    orders = storedOrders ? JSON.parse(storedOrders) : [];
    wallets = storedWallets ? JSON.parse(storedWallets) : [];
    transactions = storedTransactions ? JSON.parse(storedTransactions) : [];
    cart = storedCart ? JSON.parse(storedCart) : [];
    currentUser = storedUser ? JSON.parse(storedUser) : null;

    // Демо-данные
    if (users.length === 0) {
        users.push({ id: 1, username: 'demo_seller', password: '123', email: 'seller@demo.com' });
        users.push({ id: 2, username: 'demo_buyer', password: '123', email: 'buyer@demo.com' });
        users.push({ id: 3, username: 'alex', password: '123', email: 'alex@demo.com' });
    }

    // Инициализация кошельков
    if (wallets.length === 0) {
        users.forEach(user => {
            wallets.push({ userId: user.id, balance: 10000, heldBalance: 0 });
        });
    }

    if (products.length === 0 && users.length >= 2) {
        const sellerId = users.find(u => u.username === 'demo_seller')?.id || 1;
        products.push({
            id: 101,
            sellerId: sellerId,
            name: 'Игровая мышь',
            price: 2490,
            description: 'Беспроводная мышь с RGB, 6 кнопок',
            imageUrl: 'https://picsum.photos/id/1/200/150',
            quantity: 8,
            reservedQuantity: 0
        });
        products.push({
            id: 102,
            sellerId: sellerId,
            name: 'Механическая клавиатура',
            price: 5490,
            description: 'Красные свитчи, подсветка',
            imageUrl: 'https://picsum.photos/id/20/200/150',
            quantity: 3,
            reservedQuantity: 0
        });
        products.push({
            id: 103,
            sellerId: users.find(u => u.username === 'alex')?.id || 3,
            name: 'Наушники Studio',
            price: 3990,
            description: 'Звук высокого качества, микрофон',
            imageUrl: 'https://picsum.photos/id/30/200/150',
            quantity: 5,
            reservedQuantity: 0
        });
    }
    saveAll();
}

// ---------- AUTH ----------
function registerUser(username, password, email) {
    if (users.some(u => u.username === username)) return { success: false, message: 'Логин уже существует' };
    const newId = getNextId(users);
    users.push({ id: newId, username, password, email });
    wallets.push({ userId: newId, balance: 10000, heldBalance: 0 });
    saveAll();
    return { success: true };
}

function loginUser(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return { success: false, message: 'Неверный логин или пароль' };
    currentUser = { id: user.id, username: user.username, email: user.email };
    saveAll();
    return { success: true };
}

function logout() {
    currentUser = null;
    saveAll();
    currentPage = 'home';
    renderApp();
}

// ---------- PRODUCTS MANAGEMENT ----------
function addProduct(name, price, description, imageUrl, quantity) {
    if (!currentUser) return false;
    const newId = getNextId(products);
    products.push({
        id: newId,
        sellerId: currentUser.id,
        name,
        price: Number(price),
        description,
        imageUrl: imageUrl || 'https://picsum.photos/id/42/200/150',
        quantity: Number(quantity),
        reservedQuantity: 0
    });
    saveAll();
    return true;
}

function updateProduct(productId, updates) {
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1 && products[index].sellerId === currentUser?.id) {
        products[index] = { ...products[index], ...updates };
        saveAll();
        return true;
    }
    return false;
}

function deleteProduct(productId) {
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1 && products[index].sellerId === currentUser?.id) {
        products.splice(index, 1);
        cart = cart.filter(c => c.productId !== productId);
        saveAll();
        return true;
    }
    return false;
}

function getMyProducts() {
    if (!currentUser) return [];
    return products.filter(p => p.sellerId === currentUser.id);
}

// ---------- CART ----------
function addToCart(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    const available = product.quantity - product.reservedQuantity;
    if (available < quantity) return false;
    const existing = cart.find(c => c.productId === productId);
    if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > available) return false;
        existing.quantity = newQty;
    } else {
        cart.push({ productId, quantity });
    }
    saveAll();
    return true;
}

function removeFromCart(productId) {
    cart = cart.filter(c => c.productId !== productId);
    saveAll();
}

function updateCartQuantity(productId, newQuantity) {
    const product = products.find(p => p.id === productId);
    if (!product) return false;
    const available = product.quantity - product.reservedQuantity;
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return true;
    }
    if (newQuantity > available) return false;
    const item = cart.find(c => c.productId === productId);
    if (item) {
        item.quantity = newQuantity;
        saveAll();
        return true;
    }
    return false;
}

// ---------- КОШЕЛЁК И БЕЗОПАСНАЯ СДЕЛКА ----------
function getWallet(userId) {
    return wallets.find(w => w.userId === userId);
}

function addTransaction(userId, type, amount, orderId, description) {
    transactions.push({
        id: getNextId(transactions),
        userId,
        type, // 'deposit', 'hold', 'release', 'refund'
        amount,
        orderId: orderId || null,
        date: new Date().toISOString(),
        description
    });
    saveAll();
}

function depositFunds(amount) {
    if (!currentUser) return false;
    const wallet = getWallet(currentUser.id);
    wallet.balance += amount;
    addTransaction(currentUser.id, 'deposit', amount, null, `Пополнение на ${amount} ₽`);
    saveAll();
    return true;
}

// Холдирование средств и резервирование товаров
function holdFundsAndReserve(orderId, buyerId, total, items) {
    const wallet = getWallet(buyerId);
    if (wallet.balance < total) return false;
    wallet.balance -= total;
    wallet.heldBalance += total;
    addTransaction(buyerId, 'hold', total, orderId, `Зарезервировано ${total} ₽ по заказу #${orderId}`);
    
    // Резервируем товары
    for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.reservedQuantity += item.quantity;
        }
    }
    saveAll();
    return true;
}

// Подтверждение продавцом -> окончательное списание товаров
function confirmOrderBySeller(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Заказ не найден' };
    if (order.status !== ORDER_STATUS.FUNDS_HELD) return { success: false, message: 'Неверный статус заказа' };
    // Проверка, что текущий пользователь - продавец хотя бы одного товара
    const isSeller = order.items.some(item => item.sellerId === currentUser?.id);
    if (!isSeller) return { success: false, message: 'Вы не продавец' };
    
    // Окончательно списываем товары
    for (const item of order.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.quantity -= item.quantity;
            product.reservedQuantity -= item.quantity;
        }
    }
    order.status = ORDER_STATUS.CONFIRMED;
    saveAll();
    return { success: true };
}

// Подтверждение получения покупателем -> перевод денег продавцу
function confirmDeliveryByBuyer(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Заказ не найден' };
    if (order.buyerId !== currentUser?.id) return { success: false, message: 'Не ваш заказ' };
    if (order.status !== ORDER_STATUS.CONFIRMED && order.status !== ORDER_STATUS.IN_TRANSIT && order.status !== ORDER_STATUS.READY_FOR_PICKUP) {
        return { success: false, message: 'Нельзя подтвердить получение сейчас' };
    }
    
    const buyerWallet = getWallet(order.buyerId);
    // Переводим деньги продавцам (пропорционально)
    // Упрощённо: переводим всю сумму первому продавцу (или делим по долям)
    // Для простоты переведём всю сумму продавцу первого товара
    const sellerId = order.items[0].sellerId;
    const sellerWallet = getWallet(sellerId);
    const total = order.total;
    
    buyerWallet.heldBalance -= total;
    sellerWallet.balance += total;
    addTransaction(order.buyerId, 'release', total, orderId, `Средства переведены продавцу по заказу #${orderId}`);
    addTransaction(sellerId, 'release', total, orderId, `Получена оплата за заказ #${orderId}`);
    
    order.status = ORDER_STATUS.DELIVERED;
    saveAll();
    return { success: true };
}

// Отмена заказа (возврат холда и резервов)
function cancelOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Заказ не найден' };
    if (order.buyerId !== currentUser?.id) return { success: false, message: 'Вы не автор заказа' };
    if (order.status !== ORDER_STATUS.FUNDS_HELD && order.status !== ORDER_STATUS.AWAITING_PAYMENT) {
        return { success: false, message: `Нельзя отменить заказ в статусе "${order.status}"` };
    }
    
    if (order.status === ORDER_STATUS.FUNDS_HELD) {
        // Возвращаем деньги из холда
        const buyerWallet = getWallet(order.buyerId);
        buyerWallet.heldBalance -= order.total;
        buyerWallet.balance += order.total;
        addTransaction(order.buyerId, 'refund', order.total, orderId, `Возврат средств за отмену заказа #${orderId}`);
        
        // Возвращаем резерв товаров
        for (const item of order.items) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                product.reservedQuantity -= item.quantity;
            }
        }
    }
    order.status = ORDER_STATUS.CANCELLED;
    saveAll();
    return { success: true };
}

// Автоматическое завершение просроченных заказов (вызывается раз в минуту)
function autoCompleteExpiredOrders() {
    const now = new Date();
    orders.forEach(order => {
        if (order.status === ORDER_STATUS.CONFIRMED && order.deliveryDeadline && new Date(order.deliveryDeadline) < now) {
            // Если покупатель не подтвердил получение в срок, переводим деньги продавцу
            const buyerWallet = getWallet(order.buyerId);
            const sellerId = order.items[0].sellerId;
            const sellerWallet = getWallet(sellerId);
            buyerWallet.heldBalance -= order.total;
            sellerWallet.balance += order.total;
            addTransaction(order.buyerId, 'release', order.total, order.id, `Автозавершение: средства переведены продавцу`);
            addTransaction(sellerId, 'release', order.total, order.id, `Автозавершение: получена оплата`);
            order.status = ORDER_STATUS.DELIVERED;
        }
    });
    saveAll();
}
setInterval(autoCompleteExpiredOrders, 60000); // каждую минуту

// Оформление заказа с холдированием
function checkout() {
    if (!currentUser) return { success: false, message: 'Войдите в аккаунт' };
    if (cart.length === 0) return { success: false, message: 'Корзина пуста' };
    
    let orderItems = [];
    let total = 0;
    for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (!product) return { success: false, message: `Товар больше не существует` };
        const available = product.quantity - product.reservedQuantity;
        if (available < cartItem.quantity) {
            return { success: false, message: `Недостаточно ${product.name}. Доступно: ${available}` };
        }
        orderItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: cartItem.quantity,
            sellerId: product.sellerId
        });
        total += product.price * cartItem.quantity;
    }
    
    const wallet = getWallet(currentUser.id);
    if (wallet.balance < total) {
        return { success: false, message: `Недостаточно средств. Пополните баланс. Доступно: ${wallet.balance} ₽` };
    }
    
    // Создаём заказ со статусом "Средства зарезервированы"
    const newOrder = {
        id: getNextId(orders),
        buyerId: currentUser.id,
        items: orderItems,
        total: total,
        date: new Date().toISOString(),
        status: ORDER_STATUS.FUNDS_HELD,
        deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isReleased: false
    };
    orders.push(newOrder);
    
    // Холдируем средства и резервируем товары
    const held = holdFundsAndReserve(newOrder.id, currentUser.id, total, orderItems);
    if (!held) {
        orders.pop();
        return { success: false, message: 'Ошибка резервирования средств' };
    }
    
    cart = [];
    saveAll();
    return { success: true, orderId: newOrder.id };
}

function getMyOrders() {
    if (!currentUser) return [];
    return orders.filter(o => o.buyerId === currentUser.id).sort((a,b) => new Date(b.date) - new Date(a.date));
}

function getMySales() {
    if (!currentUser) return [];
    const salesOrders = orders.filter(order => 
        order.items.some(item => item.sellerId === currentUser.id)
    ).sort((a,b) => new Date(b.date) - new Date(a.date));
    return salesOrders.map(order => {
        const myItems = order.items.filter(item => item.sellerId === currentUser.id);
        return { ...order, myItems };
    });
}

function updateOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Заказ не найден' };
    const isSeller = order.items.some(item => item.sellerId === currentUser?.id);
    if (!isSeller) return { success: false, message: 'Вы не продавец' };
    if (order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.DELIVERED) {
        return { success: false, message: 'Нельзя изменить статус' };
    }
    order.status = newStatus;
    saveAll();
    return { success: true };
}

// ---------- RENDER FUNCTIONS ----------
function renderHeader() {
    const headerDiv = document.getElementById('header');
    if (!currentUser) {
        headerDiv.innerHTML = `
            <div class="logo">🛍️ MarketFlow</div>
            <div><button class="nav-btn" data-page="login">Вход</button>
            <button class="nav-btn" data-page="register">Регистрация</button></div>
        `;
    } else {
        const wallet = getWallet(currentUser.id);
        headerDiv.innerHTML = `
            <div class="logo">🛍️ MarketFlow</div>
            <div class="nav-links">
                <button class="nav-btn ${currentPage === 'home' ? 'active' : ''}" data-page="home">🏠 Главная</button>
                <button class="nav-btn ${currentPage === 'myProducts' ? 'active' : ''}" data-page="myProducts">📦 Мои товары</button>
                <button class="nav-btn ${currentPage === 'cart' ? 'active' : ''}" data-page="cart">🛒 Корзина (${cart.reduce((s,i)=>s+i.quantity,0)})</button>
                <button class="nav-btn ${currentPage === 'myOrders' ? 'active' : ''}" data-page="myOrders">📋 Заказы</button>
                <button class="nav-btn ${currentPage === 'mySales' ? 'active' : ''}" data-page="mySales">💰 Продажи</button>
                <button class="nav-btn ${currentPage === 'balance' ? 'active' : ''}" data-page="balance">💳 Баланс (${wallet.balance} ₽)</button>
            </div>
            <div class="user-info">
                <span class="username">${currentUser.username}</span>
                <button class="logout-btn" id="logoutBtn">Выйти</button>
            </div>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    }
    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = btn.getAttribute('data-page');
            if (page === 'login' || page === 'register') {
                currentPage = page;
            } else if (!currentUser && page !== 'login' && page !== 'register') {
                alert('Войдите в аккаунт');
                currentPage = 'login';
            } else {
                currentPage = page;
            }
            renderApp();
        });
    });
}

function renderLogin(container) { /* как раньше, без изменений */ 
    container.innerHTML = `<div class="form-card"><h2>Вход</h2><div class="form-group"><label>Логин</label><input id="loginUsername"></div><div class="form-group"><label>Пароль</label><input type="password" id="loginPassword"></div><button id="doLoginBtn">Войти</button><p><button class="secondary" id="toRegisterBtn">Регистрация</button></p></div>`;
    document.getElementById('doLoginBtn')?.addEventListener('click', () => {
        const res = loginUser(document.getElementById('loginUsername').value, document.getElementById('loginPassword').value);
        if(res.success){ currentPage='home'; renderApp(); } else alert(res.message);
    });
    document.getElementById('toRegisterBtn')?.addEventListener('click', () => { currentPage='register'; renderApp(); });
}
function renderRegister(container) { /* аналогично */
    container.innerHTML = `<div class="form-card"><h2>Регистрация</h2><div class="form-group"><label>Логин</label><input id="regUser"></div><div class="form-group"><label>Пароль</label><input type="password" id="regPass"></div><div class="form-group"><label>Email</label><input id="regEmail"></div><button id="doRegBtn">Создать</button><p><button class="secondary" id="toLoginBtn">Вход</button></p></div>`;
    document.getElementById('doRegBtn')?.addEventListener('click', () => {
        const res = registerUser(document.getElementById('regUser').value, document.getElementById('regPass').value, document.getElementById('regEmail').value);
        if(res.success){ alert('Успех, войдите'); currentPage='login'; renderApp(); } else alert(res.message);
    });
    document.getElementById('toLoginBtn')?.addEventListener('click', () => { currentPage='login'; renderApp(); });
}

function renderHome(container) {
    const availableProducts = products.filter(p => (p.quantity - p.reservedQuantity) > 0);
    if (availableProducts.length === 0) {
        container.innerHTML = '<div class="empty-message">Товаров нет</div>';
        return;
    }
    let html = `<h2>🔥 Все товары</h2><div class="products-grid">`;
    availableProducts.forEach(prod => {
        const isOwn = currentUser && prod.sellerId === currentUser.id;
        html += `<div class="product-card">
            <img class="product-img" src="${prod.imageUrl}">
            <div class="product-info">
                <div class="product-title">${escapeHtml(prod.name)}</div>
                <div class="product-price">${prod.price} ₽</div>
                <div class="product-desc">${escapeHtml(prod.description)}</div>
                <div class="product-quantity">✅ доступно: ${prod.quantity - prod.reservedQuantity} шт.</div>
                ${!isOwn ? `<button class="add-to-cart" data-id="${prod.id}">🛒 В корзину</button>` : `<span class="badge">Ваш товар</span>`}
            </div>
        </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', () => {
            if(addToCart(parseInt(btn.dataset.id), 1)) { alert('Добавлено'); renderHeader(); }
            else alert('Не удалось добавить');
        });
    });
}

function renderMyProducts(container) { /* оставляем как было, но с учётом reservedQuantity */
    const myProducts = getMyProducts();
    let html = `<h2>Мои товары</h2><div style="background:white; padding:1rem; border-radius:1rem; margin-bottom:1rem"><h3>Добавить</h3><div class="form-group"><input id="prodName" placeholder="Название"></div><div class="form-group"><input id="prodPrice" type="number" placeholder="Цена"></div><div class="form-group"><input id="prodQty" type="number" placeholder="Количество"></div><div class="form-group"><input id="prodDesc" placeholder="Описание"></div><div class="form-group"><input id="prodImg" placeholder="URL картинки"></div><button id="addProductBtn">➕ Добавить</button></div><div class="products-grid">`;
    myProducts.forEach(prod => {
        html += `<div class="product-card"><img src="${prod.imageUrl}"><div class="product-info"><div>${escapeHtml(prod.name)}</div><div>${prod.price} ₽</div><div>📦 Остаток: ${prod.quantity} (зарезервировано: ${prod.reservedQuantity})</div><div><button class="small edit-prod" data-id="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" data-qty="${prod.quantity}" data-desc="${prod.description}" data-img="${prod.imageUrl}">✏️</button><button class="small danger delete-prod" data-id="${prod.id}">🗑️</button></div></div></div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    document.getElementById('addProductBtn')?.addEventListener('click', () => {
        const name = document.getElementById('prodName').value;
        const price = parseFloat(document.getElementById('prodPrice').value);
        const qty = parseInt(document.getElementById('prodQty').value);
        if(name && !isNaN(price) && !isNaN(qty)) {
            addProduct(name, price, document.getElementById('prodDesc').value, document.getElementById('prodImg').value, qty);
            renderMyProducts(container);
        } else alert('Заполните поля');
    });
    document.querySelectorAll('.delete-prod').forEach(btn => btn.addEventListener('click', () => { if(confirm('Удалить?')) deleteProduct(parseInt(btn.dataset.id)); renderMyProducts(container); }));
    document.querySelectorAll('.edit-prod').forEach(btn => btn.addEventListener('click', () => { /* prompt update */ const id=parseInt(btn.dataset.id); const newName=prompt('Название', btn.dataset.name); if(newName) updateProduct(id,{name:newName}); renderMyProducts(container); }));
}

function renderCart(container) {
    if(cart.length===0) { container.innerHTML='<div class="empty-message">Корзина пуста</div>'; return; }
    let itemsHtml='', total=0;
    for(let item of cart){
        const prod = products.find(p=>p.id===item.productId);
        if(!prod){ removeFromCart(item.productId); continue; }
        const subtotal = prod.price*item.quantity;
        total+=subtotal;
        itemsHtml+=`<div class="cart-item"><div><strong>${escapeHtml(prod.name)}</strong><br>${prod.price}₽ x ${item.quantity}</div><div>${subtotal}₽</div><div><button class="small dec-cart" data-id="${prod.id}">-</button><span>${item.quantity}</span><button class="small inc-cart" data-id="${prod.id}">+</button><button class="small danger remove-cart" data-id="${prod.id}">Удалить</button></div></div>`;
    }
    const html = `<h2>Корзина</h2>${itemsHtml}<div class="total">Итого: ${total} ₽</div><button id="checkoutBtn" style="background:#10b981">💳 Оформить безопасную сделку</button>`;
    container.innerHTML = html;
    document.querySelectorAll('.dec-cart').forEach(btn=>btn.addEventListener('click',()=>{const id=parseInt(btn.dataset.id); const item=cart.find(c=>c.productId===id); if(item.quantity>1) updateCartQuantity(id, item.quantity-1); else removeFromCart(id); renderCart(container); renderHeader();}));
    document.querySelectorAll('.inc-cart').forEach(btn=>btn.addEventListener('click',()=>{const id=parseInt(btn.dataset.id); const item=cart.find(c=>c.productId===id); updateCartQuantity(id, item.quantity+1); renderCart(container); renderHeader();}));
    document.querySelectorAll('.remove-cart').forEach(btn=>btn.addEventListener('click',()=>{removeFromCart(parseInt(btn.dataset.id)); renderCart(container); renderHeader();}));
    document.getElementById('checkoutBtn')?.addEventListener('click',()=>{const res=checkout(); if(res.success){ alert(`Заказ #${res.orderId} оформлен! Средства зарезервированы.`); renderHeader(); currentPage='myOrders'; renderApp();} else alert(res.message);});
}

function renderMyOrders(container) {
    const myOrders = getMyOrders();
    if(myOrders.length===0){ container.innerHTML='<div class="empty-message">Нет заказов</div>'; return; }
    let html = `<h2>Мои заказы</h2>`;
    myOrders.forEach(order => {
        const statusClass = order.status.replace(/ /g,'-').toLowerCase();
        html += `<div style="background:white; border-radius:1rem; padding:1rem; margin-bottom:1rem">
            <div style="display:flex; justify-content:space-between"><strong>Заказ #${order.id}</strong> <span class="status-badge ${statusClass}">${order.status}</span></div>
            <div>${new Date(order.date).toLocaleString()} | Сумма: ${order.total} ₽</div>
            <hr>${order.items.map(it=>`<div>• ${escapeHtml(it.name)} x ${it.quantity} = ${it.price*it.quantity} ₽</div>`).join('')}
            <div style="margin-top:0.8rem">
                ${order.status === ORDER_STATUS.FUNDS_HELD ? `<button class="small danger cancel-order" data-id="${order.id}">❌ Отменить заказ</button>` : ''}
                ${(order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.IN_TRANSIT || order.status === ORDER_STATUS.READY_FOR_PICKUP) ? `<button class="small confirm-delivery" data-id="${order.id}">✅ Подтвердить получение</button>` : ''}
            </div>
        </div>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.cancel-order').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Отменить заказ?')){const res=cancelOrder(parseInt(btn.dataset.id)); if(res.success){alert('Заказ отменён'); renderMyOrders(container); renderHeader();}else alert(res.message);}}));
    document.querySelectorAll('.confirm-delivery').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Подтверждаете получение товара? Деньги будут переведены продавцу.')){const res=confirmDeliveryByBuyer(parseInt(btn.dataset.id)); if(res.success){alert('Спасибо! Деньги переведены продавцу.'); renderMyOrders(container); renderHeader();}else alert(res.message);}}));
}

function renderMySales(container) {
    const sales = getMySales();
    if(sales.length===0){ container.innerHTML='<div class="empty-message">Продаж пока нет</div>'; return; }
    let html = `<h2>Управление продажами</h2>`;
    sales.forEach(sale => {
        const statusClass = sale.status.replace(/ /g,'-').toLowerCase();
        html += `<div style="background:white; border-radius:1rem; padding:1rem; margin-bottom:1rem">
            <div style="display:flex; justify-content:space-between"><strong>Заказ #${sale.id}</strong> <span class="status-badge ${statusClass}">${sale.status}</span></div>
            <div>${new Date(sale.date).toLocaleString()} | Сумма: ${sale.total} ₽</div>
            <div><strong>Ваши товары:</strong> ${sale.myItems.map(it=>`${escapeHtml(it.name)} x${it.quantity}`).join(', ')}</div>
            <div style="margin-top:0.8rem">
                ${sale.status === ORDER_STATUS.FUNDS_HELD ? `<button class="small confirm-seller" data-id="${sale.id}">✅ Подтвердить заказ</button>` : ''}
                ${(sale.status === ORDER_STATUS.CONFIRMED) ? `
                    <select class="status-select" data-id="${sale.id}">
                        <option value="${ORDER_STATUS.IN_TRANSIT}">В пути</option>
                        <option value="${ORDER_STATUS.READY_FOR_PICKUP}">Готов к получению</option>
                    </select>
                    <button class="small update-status" data-id="${sale.id}">Изменить статус</button>
                ` : ''}
            </div>
        </div>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.confirm-seller').forEach(btn=>btn.addEventListener('click',()=>{const res=confirmOrderBySeller(parseInt(btn.dataset.id)); if(res.success){alert('Заказ подтверждён'); renderMySales(container);} else alert(res.message);}));
    document.querySelectorAll('.update-status').forEach(btn=>btn.addEventListener('click',()=>{const orderId=parseInt(btn.dataset.id); const select=btn.parentElement.querySelector('.status-select'); const newStatus=select.value; const res=updateOrderStatus(orderId, newStatus); if(res.success){alert('Статус обновлён'); renderMySales(container);} else alert(res.message);}));
}

function renderBalance(container) {
    const wallet = getWallet(currentUser.id);
    const userTransactions = transactions.filter(t => t.userId === currentUser.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
    let html = `<h2>💳 Мой кошелёк</h2>
    <div class="balance-card">
        <div><strong>Доступно:</strong> <span class="balance-amount">${wallet.balance} ₽</span></div>
        <div><strong>В сделках:</strong> <span class="held-amount">${wallet.heldBalance} ₽</span></div>
        <div><button id="depositBtn" class="small">➕ Пополнить (симуляция)</button></div>
    </div>
    <h3>История операций</h3>
    <div class="transaction-history">${userTransactions.map(t => `<div class="transaction-item">${new Date(t.date).toLocaleString()} — ${t.description} (${t.amount} ₽)</div>`).join('') || 'Нет операций'}</div>
    `;
    container.innerHTML = html;
    document.getElementById('depositBtn')?.addEventListener('click', () => {
        let amount = prompt('Сумма пополнения (руб.)', '1000');
        amount = parseInt(amount);
        if(amount > 0 && depositFunds(amount)) {
            alert(`Баланс пополнен на ${amount} ₽`);
            renderBalance(container);
            renderHeader();
        } else alert('Некорректная сумма');
    });
}

function renderApp() {
    renderHeader();
    const container = document.getElementById('app-container');
    if (!currentUser && currentPage !== 'register') currentPage = 'login';
    if (!currentUser && currentPage !== 'login' && currentPage !== 'register') currentPage = 'login';
    
    if (currentPage === 'login') renderLogin(container);
    else if (currentPage === 'register') renderRegister(container);
    else if (currentPage === 'home') renderHome(container);
    else if (currentPage === 'myProducts') renderMyProducts(container);
    else if (currentPage === 'cart') renderCart(container);
    else if (currentPage === 'myOrders') renderMyOrders(container);
    else if (currentPage === 'mySales') renderMySales(container);
    else if (currentPage === 'balance') renderBalance(container);
}

loadData();
renderApp();