import { supabase } from '../supabase.js';

const app = document.querySelector('#app');
const fileName = window.location.pathname.split('/').pop();
const page = fileName === '' || fileName === 'index.html' ? 'dashboard' : fileName.replace('.html', '');
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const cart = [];
let sessionProfile = null;

const PENDING_ACCOUNTS_KEY = 'pos_pending_accounts';
const APPROVED_ACCOUNTS_KEY = 'pos_approved_accounts';
const DEMO_ACCOUNTS_KEY = 'pos_demo_accounts';

const mockAccounts = {
  admin: { username: 'admin', password: 'admin123', role: 'Administrator', full_name: 'System Administrator' },
  manager: { username: 'manager', password: 'manager123', role: 'Manager', full_name: 'Store Manager' },
  cashier: { username: 'cashier', password: 'cashier123', role: 'Cashier', full_name: 'Store Cashier' },
  inventory: { username: 'inventory', password: 'inventory123', role: 'Inventory Staff', full_name: 'Inventory Staff' }
};

function getDemoAccounts() {
  const stored = JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}');
  return Object.fromEntries(Object.entries(mockAccounts).filter(([key]) => stored[key]?.deleted !== true).map(([key, account]) => [
    key,
    { ...account, ...stored[key], id: `demo-${key}`, active: stored[key]?.active !== false }
  ]));
}

const pageInfo = {
  dashboard: ['OVERVIEW', 'Dashboard', 'Your store activity and inventory at a glance.'],
  products: ['CATALOG', 'Products', 'Manage products and monitor inventory.'],
  customers: ['RELATIONSHIPS', 'Customers', 'Register and manage customer records.'],
  sales: ['TRANSACTIONS', 'Point of sale', 'Build a cart, process payment, and complete a sale.'],
  history: ['TRANSACTIONS', 'Sales history', 'Search and reprint completed transactions.'],
  receipt: ['TRANSACTION', 'Receipt', 'Review or print a completed sale.'],
  reports: ['PERFORMANCE', 'Sales reports', 'Review sales, products, categories, and payment activity.'],
  users: ['TEAM', 'Users', 'Manage POS roles and access.'],
  login: ['WELCOME', 'Welcome back', 'Sign in to your store workspace.']
};

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function header(actions = '') {
  const [eyebrow, title, description] = pageInfo[page] || ['POS SYSTEM', 'Point of sale', ''];
  document.title = `${title} | POS System`;
  return `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}

function metric(label, value, detail, tone = '') {
  return `<article class="metric ${tone}"><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>`;
}

function failure(message) {
  return `<div class="empty-state"><span class="empty-symbol">!</span><h2>Could not load data</h2><p>${escapeHtml(message)}</p></div>`;
}

async function loadProfile() {
  const demoProfile = localStorage.getItem('pos_demo_profile');
  if (demoProfile) {
    try {
      const savedProfile = JSON.parse(demoProfile);
      const account = savedProfile.id?.startsWith('demo-')
        ? Object.values(getDemoAccounts()).find(item => item.id === savedProfile.id || item.username === savedProfile.username)
        : JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]').find(item => item.id === savedProfile.id);
      if (savedProfile.demo && (!account || account.active === false)) {
        localStorage.removeItem('pos_demo_profile');
        return null;
      }
      sessionProfile = account
        ? { ...savedProfile, username: account.username, full_name: account.full_name, role: account.role, active: account.active }
        : savedProfile;
      localStorage.setItem('pos_demo_profile', JSON.stringify(sessionProfile));
      return { demo: true };
    } catch {
      localStorage.removeItem('pos_demo_profile');
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error || !data) return null;
  if (data.active === false) {
    await supabase.auth.signOut();
    return null;
  }
  sessionProfile = data;
  return session;
}

function canAccess(targetPage) {
  const role = sessionProfile?.role || 'Cashier';
  const access = {
    dashboard: ['Administrator'],
    products: ['Administrator', 'Manager', 'Inventory Staff'],
    customers: ['Administrator'],
    sales: ['Administrator', 'Manager', 'Cashier'],
    history: ['Administrator'],
    receipt: ['Administrator', 'Cashier'],
    reports: ['Administrator', 'Manager'],
    users: ['Administrator']
  };
  return (access[targetPage] || []).includes(role);
}

function roleLandingUrl(role) {
  const destination = role === 'Administrator'
    ? 'index.html'
    : role === 'Inventory Staff'
      ? 'views/products.html'
      : 'views/sales.html';
  return new URL(destination, new URL('../', import.meta.url)).href;
}

function accessDenied() {
  app.innerHTML = `${header()}<div class="empty-state"><span class="empty-symbol">!</span><h2>Access denied</h2><p>Your role does not have permission to open this module.</p><a class="button button-secondary" href="${roleLandingUrl(sessionProfile?.role)}">Return to your workspace</a></div>`;
}

async function renderDashboard() {
  app.innerHTML = `${header('<a class="button button-primary" href="views/sales.html">Open POS</a>')}<section class="metric-grid" data-metrics><div class="loading-state">Loading dashboard</div></section><section class="dashboard-grid"><article class="data-panel"><div class="panel-heading"><div><h2>Recent sales</h2><p>Latest completed transactions</p></div><a class="text-link" href="views/history.html">View history →</a></div><div data-recent></div></article><aside class="quick-panel"><p class="eyebrow">SHORTCUTS</p><h2>Go to work</h2><a href="views/products.html"><span class="shortcut-symbol">▦</span><span><strong>Products</strong><small>Manage catalog and stock</small></span><b>→</b></a><a href="views/customers.html"><span class="shortcut-symbol">◉</span><span><strong>Customers</strong><small>Manage customer records</small></span><b>→</b></a><a href="views/reports.html"><span class="shortcut-symbol">▤</span><span><strong>Reports</strong><small>Review store performance</small></span><b>→</b></a></aside></section>`;
  const [productsResult, customersResult, salesResult] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('sales').select('*').order('sale_date', { ascending: false })
  ]);
  if (productsResult.error || customersResult.error || salesResult.error) {
    app.querySelector('[data-metrics]').innerHTML = failure(productsResult.error?.message || customersResult.error?.message || salesResult.error?.message);
    return;
  }
  const products = productsResult.data || [];
  const customers = customersResult.data || [];
  const sales = salesResult.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(sale => String(sale.sale_date).startsWith(today));
  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const lowStock = products.filter(product => product.status === 'Active' && Number(product.quantity) <= Number(product.reorder_level)).length;
  app.querySelector('[data-metrics]').innerHTML = `
    ${metric("Today's sales", peso.format(todayTotal), `${todaySales.length} transactions`, 'metric-green')}
    ${metric('Products', products.length, `${lowStock} low stock`, 'metric-orange')}
    ${metric('Customers', customers.length, 'Registered records', 'metric-blue')}
    ${metric('Sales total', peso.format(sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)), 'Available transactions', 'metric-lime')}`;
  app.querySelector('[data-recent]').innerHTML = sales.length
    ? `<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>${sales.slice(0, 5).map(sale => `<tr><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</td><td>${peso.format(Number(sale.total_amount))}</td><td>${escapeHtml(sale.status)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><h2>No sales yet</h2></div>';
}

async function renderProducts() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Search products"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Product details</h2><p>Add or update catalog items.</p></div></div><form class="sale-form" data-product-form><input type="hidden" name="product_id"><div class="field-grid"><label>Product code<input name="product_code" required></label><label>Product name<input name="product_name" required></label><label>Category<input name="category"></label><label>Price<input name="price" type="number" min="0" step="0.01" required></label><label>Cost<input name="cost" type="number" min="0" step="0.01" value="0"></label><label>Quantity<input name="quantity" type="number" min="0" step="1" value="0" required></label><label>Reorder level<input name="reorder_level" type="number" min="0" step="1" value="0"></label></div><button class="button button-primary" type="submit">Save product</button><button class="button button-secondary" type="button" data-reset>Clear</button><p class="form-message" data-message></p></form></section><section class="data-panel"><div class="panel-heading"><div><h2>Product catalog</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const form = app.querySelector('[data-product-form]');
  const message = app.querySelector('[data-message]');
  let rows = [];
  async function load() {
    const { data, error } = await supabase.from('products').select('*').order('product_name');
    if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
    rows = data || [];
    renderTable(rows);
  }
  function renderTable(items) {
    app.querySelector('[data-count]').textContent = `${items.length} products`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Code</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.product_code)}</td><td>${escapeHtml(item.product_name)}</td><td>${escapeHtml(item.category || '—')}</td><td>${peso.format(Number(item.price))}</td><td>${Number(item.quantity) <= Number(item.reorder_level) ? `<strong class="stock-low">${item.quantity} Low</strong>` : item.quantity}</td><td><button class="button button-secondary" data-edit="${item.product_id}">Edit</button> <button class="button button-secondary" data-inactive="${item.product_id}">Deactivate</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No products found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    renderTable(rows.filter(row => [row.product_code, row.product_name, row.category].join(' ').toLowerCase().includes(term)));
  });
  app.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); form.elements.product_id.value = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = data.get('product_id');
    const product = {
      product_code: String(data.get('product_code')).trim().toUpperCase(),
      product_name: String(data.get('product_name')).trim(),
      category: String(data.get('category')).trim() || null,
      price: Number(data.get('price')),
      cost: Number(data.get('cost')),
      quantity: Number(data.get('quantity')),
      reorder_level: Number(data.get('reorder_level')),
      status: 'Active'
    };
    if (!product.product_code || !product.product_name) { message.textContent = 'Product code and name are required.'; return; }
    if (product.price < 0 || product.quantity < 0 || product.reorder_level < 0) { message.textContent = 'Price and stock values cannot be negative.'; return; }
    const duplicate = rows.find(row => row.product_code === product.product_code && String(row.product_id) !== String(id));
    if (duplicate) { message.textContent = 'That product code already exists.'; return; }
    message.textContent = 'Saving…';
    const result = id
      ? await supabase.from('products').update(product).eq('product_id', id).select('*').single()
      : await supabase.from('products').insert(product).select('*').single();
    if (result.error) { message.textContent = result.error.message; return; }
    message.textContent = id ? 'Product updated.' : 'Product added.';
    form.reset(); form.elements.product_id.value = '';
    await load();
  });
  app.querySelector('[data-table]').addEventListener('click', async event => {
    const editId = event.target.dataset.edit;
    const inactiveId = event.target.dataset.inactive;
    if (editId) {
      const item = rows.find(row => String(row.product_id) === editId);
      if (!item) return;
      for (const name of ['product_code', 'product_name', 'category', 'price', 'cost', 'quantity', 'reorder_level']) form.elements[name].value = item[name] ?? '';
      form.elements.product_id.value = item.product_id;
      form.elements.product_code.focus();
    }
    if (inactiveId && window.confirm('Deactivate this product?')) {
      await supabase.from('products').update({ status: 'Inactive' }).eq('product_id', inactiveId);
      await load();
    }
  });
  await load();
}

async function renderCustomers() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Search customers"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Customer details</h2><p>Register or update customer records.</p></div></div><form class="sale-form" data-customer-form><input type="hidden" name="customer_id"><div class="field-grid"><label>Customer code<input name="customer_code" placeholder="CUST-001"></label><label>Customer name<input name="customer_name" required></label><label>Contact number<input name="contact_number"></label><label>Email<input name="email" type="email"></label><label>Address<input name="address"></label></div><button class="button button-primary" type="submit">Save customer</button><button class="button button-secondary" type="button" data-reset>Clear</button><p class="form-message" data-message></p></form></section><section class="data-panel"><div class="panel-heading"><div><h2>All customers</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const form = app.querySelector('[data-customer-form]');
  const message = app.querySelector('[data-message]');
  let rows = [];
  async function load() {
    const { data, error } = await supabase.from('customers').select('*').order('customer_name');
    if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
    rows = data || [];
    renderTable(rows);
  }
  function renderTable(items) {
    app.querySelector('[data-count]').textContent = `${items.length} customers`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Email</th><th>Address</th><th>Action</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.customer_code || '—')}</td><td>${escapeHtml(item.customer_name)}</td><td>${escapeHtml(item.contact_number || '—')}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(item.address || '—')}</td><td><button class="button button-secondary" data-edit="${item.customer_id}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No customers found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    renderTable(rows.filter(row => [row.customer_code, row.customer_name, row.contact_number, row.email, row.address].join(' ').toLowerCase().includes(term)));
  });
  app.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); form.elements.customer_id.value = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = data.get('customer_id');
    const customer = {
      customer_code: String(data.get('customer_code')).trim().toUpperCase() || null,
      customer_name: String(data.get('customer_name')).trim(),
      contact_number: String(data.get('contact_number')).trim() || null,
      email: String(data.get('email')).trim() || null,
      address: String(data.get('address')).trim() || null,
      status: 'Active'
    };
    if (!customer.customer_name) { message.textContent = 'Customer name is required.'; return; }
    if (customer.customer_code && rows.some(row => row.customer_code === customer.customer_code && String(row.customer_id) !== String(id))) { message.textContent = 'That customer code already exists.'; return; }
    const result = id
      ? await supabase.from('customers').update(customer).eq('customer_id', id)
      : await supabase.from('customers').insert(customer);
    if (result.error) { message.textContent = result.error.message; return; }
    message.textContent = id ? 'Customer updated.' : 'Customer registered.';
    form.reset(); form.elements.customer_id.value = '';
    await load();
  });
  app.querySelector('[data-table]').addEventListener('click', event => {
    if (!event.target.dataset.edit) return;
    const item = rows.find(row => String(row.customer_id) === event.target.dataset.edit);
    if (!item) return;
    for (const name of ['customer_code', 'customer_name', 'contact_number', 'email', 'address']) form.elements[name].value = item[name] ?? '';
    form.elements.customer_id.value = item.customer_id;
  });
  await load();
}

function createProductSearch({ container, products, getReservedQuantity, onSelect }) {
  const categories = [...new Set(products.map(product => String(product.category || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  container.innerHTML = `<div class="product-search"><div class="product-search__controls"><label class="product-search__query">Search product<input type="search" data-product-query placeholder="Product name or code" autocomplete="off"></label><label>Category<select data-product-category><option value="">All categories</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select></label></div><div class="product-search__summary" data-product-summary></div><div class="sale-items" data-product-results></div></div>`;

  const queryInput = container.querySelector('[data-product-query]');
  const categorySelect = container.querySelector('[data-product-category]');
  const results = container.querySelector('[data-product-results]');
  const summary = container.querySelector('[data-product-summary]');

  function render() {
    const query = queryInput.value.trim().toLowerCase();
    const category = categorySelect.value;
    const matching = products.filter(product => {
      const matchesQuery = [product.product_name, product.product_code].some(value => String(value || '').toLowerCase().includes(query));
      const matchesCategory = !category || String(product.category || '').trim() === category;
      return matchesQuery && matchesCategory;
    });

    summary.textContent = `${matching.length} product${matching.length === 1 ? '' : 's'} · Low-stock items are marked`;
    results.innerHTML = matching.length
      ? `<div class="table-scroll product-search__table"><div class="sale-item-head"><span>Code</span><span>Product</span><span>Category</span><span>Price</span><span>Available</span><span></span></div>${matching.map(product => {
        const stock = Math.max(Number(product.quantity) - getReservedQuantity(product.product_id), 0);
        const lowStock = Number(product.quantity) <= Number(product.reorder_level || 0);
        const outOfStock = stock < 1;
        const stockLabel = outOfStock
          ? '<span class="product-stock product-stock--empty">Out</span>'
          : `<span class="product-stock ${lowStock ? 'product-stock--low' : ''}">${stock}${lowStock ? ' · Low' : ''}</span>`;
        return `<div class="sale-item-row${lowStock ? ' sale-item-row--low' : ''}"><span class="product-code">${escapeHtml(product.product_code || '—')}</span><span class="product-name">${escapeHtml(product.product_name)}</span><span class="product-category">${escapeHtml(product.category || '—')}</span><span>${peso.format(product.price)}</span>${stockLabel}<button class="button button-secondary" type="button" data-add-product="${escapeHtml(product.product_id)}" ${outOfStock ? 'disabled' : ''}>${outOfStock ? 'Out' : 'Add'}</button></div>`;
      }).join('')}</div>`
      : '<div class="product-search__empty">No products match your search.</div>';
  }

  queryInput.addEventListener('input', render);
  categorySelect.addEventListener('change', render);
  results.addEventListener('click', event => {
    const button = event.target.closest('button[data-add-product]');
    if (!button || button.disabled) return;
    const product = products.find(item => String(item.product_id) === button.dataset.addProduct);
    if (!product || Number(product.quantity) - getReservedQuantity(product.product_id) < 1) return;
    onSelect(product);
    render();
  });

  return { render };
}

async function renderSales() {
  app.innerHTML = `${header('<button class="button button-secondary" type="button" data-clear>Clear cart</button>')}<section class="sale-layout"><article class="data-panel sale-terminal"><div class="panel-heading"><div><h2>Current transaction</h2><p>Select a customer and add products.</p></div><span class="live-indicator">LIVE</span></div><div class="sale-form"><label class="sale-customer">Customer<select name="customer_id" data-customer><option value="">Walk-in customer</option></select></label><div data-product-search-widget></div></div></article><aside class="receipt-card"><p class="eyebrow">SUMMARY</p><h2>Order total</h2><div class="summary-row"><span>Subtotal</span><strong data-subtotal>₱0.00</strong></div><label class="payment-field">Discount <input type="number" min="0" step="0.01" value="0" data-discount></label><label class="payment-field">Tax <input type="number" min="0" step="0.01" value="0" data-tax></label><div class="summary-row total"><span>Total</span><strong data-total>₱0.00</strong></div><label class="payment-field">Payment method<select data-method><option>Cash</option><option>Card</option><option>E-wallet</option></select></label><label class="payment-field">Cash / amount<input type="number" min="0" step="0.01" value="0" data-paid></label><div class="summary-row"><span>Change</span><strong data-change>₱0.00</strong></div><button class="button button-primary wide" type="button" data-checkout>Complete payment</button><p class="form-message" data-sale-message></p></aside></section><section class="data-panel"><div class="panel-heading"><div><h2>Shopping cart</h2><p data-cart-count>0 items</p></div></div><div data-cart class="table-content"></div></section>`;
  let products = [];
  const [productResult, customerResult] = await Promise.all([
    supabase.from('products').select('*').eq('status', 'Active').order('product_name'),
    supabase.from('customers').select('*').eq('status', 'Active').order('customer_name')
  ]);
  products = productResult.data || [];
  const customerSelect = app.querySelector('[data-customer]');
  for (const customer of customerResult.data || []) {
    const option = document.createElement('option');
    option.value = customer.customer_id;
    option.textContent = `${customer.customer_name}${customer.customer_code ? ` (${customer.customer_code})` : ''}`;
    customerSelect.append(option);
  }
  if (productResult.error) {
    app.querySelector('[data-product-search-widget]').innerHTML = failure(productResult.error.message);
    return;
  }
  function subtotal() { return cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0); }
  function totals() { const discount = Math.max(Number(app.querySelector('[data-discount]').value) || 0, 0); const tax = Math.max(Number(app.querySelector('[data-tax]').value) || 0, 0); return { discount, tax, total: Math.max(subtotal() - discount + tax, 0) }; }
  function renderCart() {
    app.querySelector('[data-cart-count]').textContent = `${cart.reduce((sum, item) => sum + item.quantity, 0)} items`;
    const total = totals();
    app.querySelector('[data-subtotal]').textContent = peso.format(subtotal());
    app.querySelector('[data-total]').textContent = peso.format(total.total);
    const paid = Math.max(Number(app.querySelector('[data-paid]').value) || 0, 0);
    app.querySelector('[data-change]').textContent = peso.format(Math.max(paid - total.total, 0));
    app.querySelector('[data-cart]').innerHTML = cart.length ? `<div class="table-scroll"><table><thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>${cart.map(item => `<tr><td>${escapeHtml(item.product_name)}</td><td><input class="cart-qty" type="number" min="1" max="${item.quantity_available}" data-qty="${item.product_id}" value="${item.quantity}"></td><td>${peso.format(item.price)}</td><td>${peso.format(item.price * item.quantity)}</td><td><button class="button button-secondary" data-remove="${item.product_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>Cart is empty</h2><p>Add an available product from the list.</p></div>';
    productSearch?.render();
  }
  const productSearch = createProductSearch({
    container: app.querySelector('[data-product-search-widget]'),
    products,
    getReservedQuantity: productId => cart.find(item => String(item.product_id) === String(productId))?.quantity || 0,
    onSelect: product => {
      const existing = cart.find(item => String(item.product_id) === String(product.product_id));
      if (existing) existing.quantity += 1;
      else cart.push({ product_id: product.product_id, product_name: product.product_name, price: Number(product.price), quantity: 1, quantity_available: Number(product.quantity) });
      renderCart();
    }
  });
  app.querySelector('[data-cart]').addEventListener('input', event => {
    if (!event.target.dataset.qty) return;
    const item = cart.find(cartItem => String(cartItem.product_id) === event.target.dataset.qty);
    if (!item) return;
    const requested = Math.max(1, Number(event.target.value) || 1);
    if (requested > item.quantity_available) { event.target.value = item.quantity_available; item.quantity = item.quantity_available; }
    else item.quantity = requested;
    renderCart();
  });
  app.querySelector('[data-cart]').addEventListener('click', event => {
    if (!event.target.dataset.remove) return;
    const index = cart.findIndex(item => String(item.product_id) === event.target.dataset.remove);
    if (index >= 0) cart.splice(index, 1);
    renderCart();
  });
  for (const selector of ['[data-discount]', '[data-tax]', '[data-paid]']) app.querySelector(selector).addEventListener('input', renderCart);
  app.querySelector('[data-clear]').addEventListener('click', () => { cart.splice(0); renderCart(); });
  app.querySelector('[data-checkout]').addEventListener('click', async () => {
    const message = app.querySelector('[data-sale-message]');
    if (!cart.length) { message.textContent = 'Cart is empty.'; return; }
    const total = totals();
    const paid = Number(app.querySelector('[data-paid]').value) || 0;
    if (paid < total.total) { message.textContent = 'Insufficient payment.'; return; }
    const button = app.querySelector('[data-checkout]'); button.disabled = true; message.textContent = 'Processing transaction…';
    const items = cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }));
    const cashierName = sessionProfile?.full_name || sessionProfile?.username || 'Cashier';
    const { data, error } = await supabase.rpc('process_sale', {
      p_customer_id: app.querySelector('[data-customer]').value ? Number(app.querySelector('[data-customer]').value) : null,
      p_items: items,
      p_discount: total.discount,
      p_tax: total.tax,
      p_payment_method: app.querySelector('[data-method]').value,
      p_amount_received: paid,
      p_cashier_name: cashierName
    });
    button.disabled = false;
    if (error) { message.textContent = error.message; return; }
    const sale = data?.[0];
    if (!sale) { message.textContent = 'Sale completed but receipt data was unavailable.'; return; }
    sessionStorage.setItem('pos_receipt_sale_id', String(sale.sale_id));
    window.location.href = `receipt.html?id=${encodeURIComponent(sale.sale_id)}`;
  });
  renderCart();
}

async function renderReceipt() {
  app.innerHTML = `${header('<button class="button button-secondary" data-print>Print receipt</button>')}<section class="data-panel receipt-panel" data-receipt><div class="loading-state">Loading receipt</div></section>`;
  app.querySelector('[data-print]').addEventListener('click', () => window.print());
  const id = new URLSearchParams(window.location.search).get('id') || sessionStorage.getItem('pos_receipt_sale_id');
  if (!id) { app.querySelector('[data-receipt]').innerHTML = failure('No receipt was selected.'); return; }
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*, customers(customer_name, customer_code), sale_items(*, products(product_name, product_code)), payments(*)')
    .eq('sale_id', id)
    .maybeSingle();
  if (error) { app.querySelector('[data-receipt]').innerHTML = failure(error.message); return; }
  if (!sale) { app.querySelector('[data-receipt]').innerHTML = failure('Receipt not found.'); return; }
  const payment = sale.payments?.[0];
  app.querySelector('[data-receipt]').innerHTML = `<article class="print-receipt"><h2>POS SYSTEM</h2><p>Point-of-Sale System</p><hr><dl class="receipt-details"><div><dt>Transaction</dt><dd>${escapeHtml(sale.transaction_no)}</dd></div><div><dt>Date</dt><dd>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</dd></div><div><dt>Customer</dt><dd>${escapeHtml(sale.customers?.customer_name || 'Walk-in customer')}</dd></div><div><dt>Cashier</dt><dd>${escapeHtml(sale.cashier_name || 'Cashier')}</dd></div></dl><div class="table-scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead><tbody>${(sale.sale_items || []).map(item => `<tr><td>${escapeHtml(item.products?.product_name || 'Product')}</td><td>${item.quantity}</td><td>${peso.format(item.unit_price)}</td><td>${peso.format(item.subtotal)}</td></tr>`).join('')}</tbody></table></div><dl class="receipt-details"><div><dt>Subtotal</dt><dd>${peso.format(sale.subtotal)}</dd></div><div><dt>Discount</dt><dd>${peso.format(sale.discount)}</dd></div><div><dt>Tax</dt><dd>${peso.format(sale.tax)}</dd></div><div><dt>Total</dt><dd>${peso.format(sale.total_amount)}</dd></div><div><dt>${escapeHtml(payment?.payment_method || 'Payment')}</dt><dd>${peso.format(payment?.amount_received || 0)}</dd></div><div><dt>Change</dt><dd>${peso.format(payment?.change_amount || 0)}</dd></div></dl><p class="receipt-thanks">THANK YOU!</p></article>`;
}

async function renderHistory() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Transaction or customer"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Sales history</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const { data, error } = await supabase.from('sales').select('*, customers(customer_name), payments(*)').order('sale_date', { ascending: false });
  if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
  let rows = data || [];
  function render(items) {
    app.querySelector('[data-count]').textContent = `${items.length} transactions`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Payment</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map(sale => `<tr><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</td><td>${escapeHtml(sale.customers?.customer_name || 'Walk-in')}</td><td>${escapeHtml(sale.cashier_name || '—')}</td><td>${escapeHtml(sale.payments?.[0]?.payment_method || '—')}</td><td>${peso.format(sale.total_amount)}</td><td>${escapeHtml(sale.status)}</td><td><a class="button button-secondary" href="receipt.html?id=${sale.sale_id}">View</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No transactions found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    render(rows.filter(sale => [sale.transaction_no, sale.customers?.customer_name, sale.cashier_name, sale.status].join(' ').toLowerCase().includes(term)));
  });
  render(rows);
}

async function renderReports() {
  app.innerHTML = `${header()}<section class="metric-grid" data-metrics></section><section class="data-panel"><div class="panel-heading"><div><h2>Sales records</h2><p data-report-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-report-table class="table-content"></div></section>`;
  const { data, error } = await supabase.from('sales').select('*, sale_items(*, products(product_name, category)), payments(payment_method)').order('sale_date', { ascending: false });
  if (error) { app.querySelector('[data-report-table]').innerHTML = failure(error.message); return; }
  const rows = data || [];
  const total = rows.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  app.querySelector('[data-metrics]').innerHTML = metric('Transactions', rows.length, 'Completed records') + metric('Total sales', peso.format(total), 'Available sales', 'metric-orange') + metric('Average sale', peso.format(rows.length ? total / rows.length : 0), 'Per transaction', 'metric-blue');
  app.querySelector('[data-report-count]').textContent = `${rows.length} records`;
  app.querySelector('[data-report-table]').innerHTML = rows.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Payment</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows.map(sale => `<tr><td>${escapeHtml(new Date(sale.sale_date).toLocaleDateString())}</td><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(sale.payments?.[0]?.payment_method || '—')}</td><td>${peso.format(sale.subtotal)}</td><td>${peso.format(sale.discount)}</td><td>${peso.format(sale.tax)}</td><td>${peso.format(sale.total_amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No sales reports yet</h2></div>';
}

async function renderUsers() {
  app.innerHTML = `<div class="users-page">${header()}<section class="users-section data-panel"><div class="panel-heading users-section__heading"><div class="users-section__title"><span class="users-section__icon users-section__icon--pending" aria-hidden="true">⌛</span><div><h2>Pending approvals</h2><p>Review and approve new account requests.</p></div></div><span class="users-count users-count--pending" data-pending-count>0 pending</span></div><div data-pending-users class="table-content"></div></section><section class="users-section data-panel"><div class="panel-heading users-section__heading"><div class="users-section__title"><span class="users-section__icon" aria-hidden="true">♙</span><div><h2>Account directory</h2><p>Manage account details, roles, passwords, and access.</p></div></div><span class="users-count" data-user-count>0 accounts</span></div><div class="user-filters"><label class="user-search"><span aria-hidden="true">⌕</span><input type="search" data-user-search placeholder="Search name, username, or email" aria-label="Search accounts"></label><label>Role<select data-user-role-filter aria-label="Filter by role"><option value="">All roles</option><option>Administrator</option><option>Manager</option><option>Cashier</option><option>Inventory Staff</option></select></label><label>Status<select data-user-status-filter aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><div data-users class="table-content"></div></section></div><dialog class="user-edit-dialog" data-user-dialog><form data-user-form><span class="eyebrow">ACCOUNT SETTINGS</span><h2>Edit user account</h2><p class="user-edit-intro">Update this team member’s profile and access.</p><label>Full name<input name="full_name" required></label><label>Username<input name="username" required></label><label>Role<select name="role"><option>Administrator</option><option>Manager</option><option>Cashier</option><option>Inventory Staff</option></select></label><label data-new-password-field>New password<input name="new_password" type="password" minlength="8" autocomplete="new-password"><small>Leave blank to keep current password. Use at least 8 characters.</small></label><button class="button button-secondary user-reset-button" type="button" data-reset-password hidden>Send password reset email</button><p class="form-message" data-user-message></p><div class="user-edit-actions"><button class="button button-primary" type="submit">Save changes</button><button class="button button-secondary" type="button" data-close-dialog>Cancel</button></div></form></dialog>`;
  if (sessionProfile?.role !== 'Administrator') { app.querySelector('[data-pending-users]').innerHTML = '<div class="empty-state"><h2>Administrator access required</h2></div>'; return; }

  async function loadPendingUsers() {
    const pending = JSON.parse(localStorage.getItem(PENDING_ACCOUNTS_KEY) || '[]');
    app.querySelector('[data-pending-count]').textContent = `${pending.length} pending`;
    const container = app.querySelector('[data-pending-users]');
    container.innerHTML = pending.length
      ? `<div class="table-scroll users-table-wrap"><table class="users-table users-pending-table"><thead><tr><th>Applicant</th><th>Username</th><th>Requested role</th><th>Status</th><th>Review</th></tr></thead><tbody>${pending.map(account => `<tr><td><span class="user-name">${escapeHtml(account.full_name)}</span></td><td><span class="user-username">@${escapeHtml(account.username)}</span></td><td><span class="role-badge role-badge--${String(account.role || '').toLowerCase().replace(/[^a-z]+/g, '-')}">${escapeHtml(account.role)}</span></td><td><span class="account-status account-status--pending"><span></span>Pending</span></td><td><div class="user-row-actions"><button class="button button-primary" data-approve-user="${escapeHtml(account.id)}">Approve</button><button class="button button-secondary" data-reject-user="${escapeHtml(account.id)}">Reject</button></div></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="users-empty"><span aria-hidden="true">✓</span><strong>All caught up</strong><p>There are no accounts waiting for approval.</p></div>';
  }


  let allUsers = [];
  function renderUserRows() {
    const search = app.querySelector('[data-user-search]').value.trim().toLowerCase();
    const roleFilter = app.querySelector('[data-user-role-filter]').value;
    const statusFilter = app.querySelector('[data-user-status-filter]').value;
    const rows = allUsers.filter(row => {
      const matchesSearch = [row.full_name, row.username, row.email].join(' ').toLowerCase().includes(search);
      const matchesRole = !roleFilter || row.role === roleFilter;
      const matchesStatus = !statusFilter || (statusFilter === 'inactive' ? row.active === false : row.active !== false);
      return matchesSearch && matchesRole && matchesStatus;
    });
    app.querySelector('[data-user-count]').textContent = `${rows.length} of ${allUsers.length} accounts`;
    app.querySelector('[data-users]').innerHTML = rows.length
      ? `<div class="table-scroll users-table-wrap"><table class="users-table"><thead><tr><th>Team member</th><th>Username</th>${!sessionProfile?.demo ? '<th>Email</th>' : ''}<th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(row => {
        const isCurrentUser = String(row.id) === String(sessionProfile?.id) || row.username === sessionProfile?.username;
        const attributes = `data-user-id="${escapeHtml(row.id)}" data-user-source="${row.source}"`;
        const roleClass = String(row.role || '').toLowerCase().replace(/[^a-z]+/g, '-');
        return `<tr><td><span class="user-name">${escapeHtml(row.full_name || '—')}</span>${isCurrentUser ? '<span class="user-you">You</span>' : ''}</td><td><span class="user-username">@${escapeHtml(row.username || '—')}</span></td>${!sessionProfile?.demo ? `<td>${escapeHtml(row.email || '—')}</td>` : ''}<td><span class="role-badge role-badge--${roleClass}">${escapeHtml(row.role)}</span></td><td><span class="account-status ${row.active === false ? 'account-status--inactive' : 'account-status--active'}"><span></span>${row.active === false ? 'Inactive' : 'Active'}</span></td><td><div class="user-row-actions"><button class="button button-secondary" data-edit-user ${attributes} ${isCurrentUser ? 'disabled' : ''}>Edit</button><button class="button button-secondary" data-toggle-user ${attributes} ${isCurrentUser ? 'disabled' : ''}>${row.active === false ? 'Activate' : 'Deactivate'}</button><button class="button button-danger" data-delete-user ${attributes} ${isCurrentUser ? 'disabled' : ''}>Delete</button></div></td></tr>`;
      }).join('')}</tbody></table></div>`
      : '<div class="empty-state"><h2>No matching accounts</h2><p>Try changing the search or filters.</p></div>';
  }

  async function loadUsers() {
    let rows;
    if (sessionProfile?.demo) {
      const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
      rows = [
        ...Object.values(getDemoAccounts()).map(account => ({ ...account, source: 'demo' })),
        ...approved.map(account => ({ ...account, active: account.active !== false, source: 'approved' }))
      ];
    } else {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) { app.querySelector('[data-users]').innerHTML = failure(error.message); return; }
      rows = (data || []).map(account => ({ ...account, source: 'profile' }));
    }

    allUsers = rows;
    renderUserRows();
  }

  for (const selector of ['[data-user-search]', '[data-user-role-filter]', '[data-user-status-filter]']) {
    app.querySelector(selector).addEventListener(selector.includes('search') ? 'input' : 'change', renderUserRows);
  }

  const dialog = app.querySelector('[data-user-dialog]');
  const userForm = app.querySelector('[data-user-form]');
  const resetPasswordButton = app.querySelector('[data-reset-password]');
  const newPasswordField = app.querySelector('[data-new-password-field]');
  app.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  resetPasswordButton.addEventListener('click', async () => {
    const email = userForm.dataset.userEmail;
    const message = app.querySelector('[data-user-message]');
    if (!email) { message.textContent = 'This account does not have a reset-email address.'; return; }
    resetPasswordButton.disabled = true;
    const redirectTo = new URL('../login.html?reset=1', window.location.href).href;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    resetPasswordButton.disabled = false;
    message.textContent = error ? error.message : `Password reset email sent to ${email}.`;
  });
  app.querySelector('[data-users]').addEventListener('click', async event => {
    const button = event.target.closest('button[data-edit-user], button[data-toggle-user], button[data-delete-user]');
    if (!button) return;
    const { userId, userSource } = button.dataset;
    if (button.hasAttribute('data-delete-user')) {
      if (!window.confirm('Permanently delete this account? This cannot be undone.')) return;
      if (userSource === 'profile') {
        const { error } = await supabase.rpc('delete_pos_user', { p_user_id: userId });
        if (error) {
          app.querySelector('[data-users]').insertAdjacentHTML('afterbegin', failure(error.message));
          return;
        }
      } else if (userSource === 'approved') {
        const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
        localStorage.setItem(APPROVED_ACCOUNTS_KEY, JSON.stringify(approved.filter(account => account.id !== userId)));
      } else {
        const key = userId.replace(/^demo-/, '');
        const saved = JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}');
        saved[key] = { ...saved[key], deleted: true };
        localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(saved));
      }
      await loadUsers();
      return;
    }

    if (button.hasAttribute('data-edit-user')) {
      let row;
      if (userSource === 'profile') {
        const { data, error } = await supabase.from('profiles').select('full_name, username, role, email').eq('id', userId).maybeSingle();
        if (error || !data) { app.querySelector('[data-users]').insertAdjacentHTML('afterbegin', failure(error?.message || 'Account not found.')); return; }
        row = data;
      } else {
        const accounts = userSource === 'approved'
          ? JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]')
          : Object.values(getDemoAccounts());
        row = userSource === 'approved'
          ? accounts.find(account => account.id === userId)
          : accounts.find(account => account.id === userId);
      }
      if (!row) return;
      userForm.elements.full_name.value = row.full_name || '';
      userForm.elements.username.value = row.username || '';
      userForm.elements.role.value = row.role;
      userForm.elements.new_password.value = '';
      newPasswordField.hidden = userSource === 'profile';
      resetPasswordButton.hidden = userSource !== 'profile';
      userForm.dataset.userId = userId;
      userForm.dataset.userSource = userSource;
      userForm.dataset.userEmail = row.email || '';
      app.querySelector('[data-user-message]').textContent = '';
      dialog.showModal();
      return;
    }

    if (!window.confirm(`${button.textContent} this account?`)) return;
    if (userSource === 'profile') {
      const { data: row, error: readError } = await supabase.from('profiles').select('active').eq('id', userId).maybeSingle();
      if (readError || !row) { app.querySelector('[data-users]').insertAdjacentHTML('afterbegin', failure(readError?.message || 'Account not found.')); return; }
      const { error } = await supabase.from('profiles').update({ active: row.active === false }).eq('id', userId);
      if (error) { app.querySelector('[data-users]').insertAdjacentHTML('afterbegin', failure(error.message)); return; }
    } else if (userSource === 'approved') {
      const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
      const account = approved.find(item => item.id === userId);
      if (!account) return;
      account.active = account.active === false;
      localStorage.setItem(APPROVED_ACCOUNTS_KEY, JSON.stringify(approved));
    } else {
      const saved = JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}');
      const key = userId.replace(/^demo-/, '');
      const account = getDemoAccounts()[key];
      if (!account) return;
      saved[key] = { ...saved[key], active: account.active === false };
      localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(saved));
    }
    await loadUsers();
  });

  userForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(userForm);
    const fullName = String(data.get('full_name')).trim();
    const username = String(data.get('username')).trim();
    const role = String(data.get('role'));
    const newPassword = String(data.get('new_password') || '');
    const message = app.querySelector('[data-user-message]');
    if (!fullName || !username) { message.textContent = 'Name and username are required.'; return; }
    if (newPassword && newPassword.length < 8) { message.textContent = 'New password must be at least 8 characters.'; return; }
    const { userId, userSource } = userForm.dataset;

    if (userSource === 'profile') {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, username, role }).eq('id', userId);
      if (error) { message.textContent = error.message; return; }
    } else if (userSource === 'approved') {
      const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
      if (approved.some(account => account.id !== userId && account.username.toLowerCase() === username.toLowerCase()) ||
          Object.values(getDemoAccounts()).some(account => account.username.toLowerCase() === username.toLowerCase())) {
        message.textContent = 'That username is already in use.';
        return;
      }
      const account = approved.find(item => item.id === userId);
      if (!account) { message.textContent = 'Account not found.'; return; }
      Object.assign(account, { full_name: fullName, username, role });
      if (newPassword) account.password = newPassword;
      localStorage.setItem(APPROVED_ACCOUNTS_KEY, JSON.stringify(approved));
    } else {
      const accounts = getDemoAccounts();
      const key = userId.replace(/^demo-/, '');
      if (Object.entries(accounts).some(([otherKey, account]) => otherKey !== key && account.username.toLowerCase() === username.toLowerCase()) ||
          JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]').some(account => account.username.toLowerCase() === username.toLowerCase())) {
        message.textContent = 'That username is already in use.';
        return;
      }
      const saved = JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}');
      saved[key] = { ...saved[key], full_name: fullName, username, role };
      if (newPassword) saved[key].password = newPassword;
      localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(saved));
    }
    dialog.close();
    await loadUsers();
  });
  await loadPendingUsers();
  app.querySelector('[data-pending-users]').addEventListener('click', async event => {
    const approveId = event.target.dataset.approveUser;
    const rejectId = event.target.dataset.rejectUser;
    if (!approveId && !rejectId) return;
    const pending = JSON.parse(localStorage.getItem(PENDING_ACCOUNTS_KEY) || '[]');
    const targetId = approveId || rejectId;
    const account = pending.find(item => item.id === targetId);
    if (!account) return;
    const remaining = pending.filter(item => item.id !== targetId);
    localStorage.setItem(PENDING_ACCOUNTS_KEY, JSON.stringify(remaining));
    if (approveId) {
      const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
      approved.push({ ...account, status: 'Approved', active: true });
      localStorage.setItem(APPROVED_ACCOUNTS_KEY, JSON.stringify(approved));
    }
    await loadPendingUsers();
    await loadUsers();
  });

  await loadUsers();
}

async function renderLogin() {
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    app.innerHTML = `<section class="login-panel"><p class="eyebrow">POS SYSTEM</p><h1>Set a new password</h1><p class="page-description">Choose a new password for your account.</p><form data-password-reset-form><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirm new password<input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></label><button class="button button-primary" type="submit">Update password</button><p class="form-message" data-reset-message aria-live="polite"></p></form></section>`;
    app.querySelector('[data-password-reset-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = form.elements.password.value;
      const message = app.querySelector('[data-reset-message]');
      if (password.length < 8) { message.textContent = 'Password must be at least 8 characters.'; return; }
      if (password !== form.elements.confirm_password.value) { message.textContent = 'Passwords do not match.'; return; }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        button.disabled = false;
        message.textContent = error.message;
        return;
      }
      await supabase.auth.signOut();
      window.location.replace('login.html');
    });
    return;
  }

  app.innerHTML = `<section class="login-panel"><p class="eyebrow">POS SYSTEM</p><h1>Welcome back</h1><p class="page-description">Sign in to your store workspace.</p><div data-login-view><form data-login-form><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary" type="submit">Login</button><button class="button button-secondary" type="button" data-show-signup>Create account</button><p class="form-message" data-login-message></p></form><div class="mock-accounts"><p class="mock-accounts__title">Demo role accounts</p><div class="mock-accounts__grid"><button type="button" data-mock="admin"><strong>Administrator</strong><span>admin / admin123</span></button><button type="button" data-mock="manager"><strong>Manager</strong><span>manager / manager123</span></button><button type="button" data-mock="cashier"><strong>Cashier</strong><span>cashier / cashier123</span></button><button type="button" data-mock="inventory"><strong>Inventory Staff</strong><span>inventory / inventory123</span></button></div></div></div><div data-signup-view hidden><form data-signup-form><label>Full name<input name="full_name" autocomplete="name" required></label><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required></label><label>Requested role<select name="role"><option>Administrator</option><option>Manager</option><option>Cashier</option><option>Inventory Staff</option></select></label><button class="button button-primary" type="submit">Create account</button><button class="button button-secondary" type="button" data-show-login>Back to login</button><p class="form-message" data-signup-message></p></form></div></section>`;
  const form = app.querySelector('[data-login-form]');
  const loginView = app.querySelector('[data-login-view]');
  const signupView = app.querySelector('[data-signup-view]');

  app.querySelector('[data-show-signup]').addEventListener('click', () => { loginView.hidden = true; signupView.hidden = false; });
  app.querySelector('[data-show-login]').addEventListener('click', () => { signupView.hidden = true; loginView.hidden = false; });

  for (const preset of app.querySelectorAll('[data-mock]')) {
    preset.addEventListener('click', () => {
      const account = mockAccounts[preset.dataset.mock];
      form.elements.username.value = account.username;
      form.elements.password.value = account.password;
      app.querySelector('[data-login-message]').textContent = `${account.role} demo credentials filled.`;
    });
  }

  app.querySelector('[data-signup-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const signupForm = event.currentTarget;
    const data = new FormData(signupForm);
    const message = app.querySelector('[data-signup-message]');
    const fullName = String(data.get('full_name')).trim();
    const username = String(data.get('username')).trim();
    const password = String(data.get('password'));
    const role = String(data.get('role'));
    if (!fullName || !username || password.length < 6) {
      message.textContent = 'Complete all fields with a password of at least 6 characters.';
      return;
    }

    const pending = JSON.parse(localStorage.getItem(PENDING_ACCOUNTS_KEY) || '[]');
    const approved = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
    if ([...pending, ...approved].some(account => account.username.toLowerCase() === username.toLowerCase()) || Object.values(mockAccounts).some(account => account.username.toLowerCase() === username.toLowerCase())) {
      message.textContent = 'That username already exists.';
      return;
    }

    pending.push({
      id: `pending-${Date.now()}-${username.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      full_name: fullName,
      username,
      password,
      role,
      status: 'Pending',
      created_at: new Date().toISOString()
    });
    localStorage.setItem(PENDING_ACCOUNTS_KEY, JSON.stringify(pending));
    message.textContent = `Account created and pending approval for the ${role} role.`;
    signupForm.reset();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form); const message = app.querySelector('[data-login-message]');
    const credential = String(data.get('username')).trim();
    const password = String(data.get('password'));
    if (!credential || !password) { message.textContent = 'Username and password are required.'; return; }
    const button = form.querySelector('button'); button.disabled = true; message.textContent = 'Signing in…';

    const pendingAccounts = JSON.parse(localStorage.getItem(PENDING_ACCOUNTS_KEY) || '[]');
    const pendingAccount = pendingAccounts.find(account => account.username === credential);
    if (pendingAccount) {
      button.disabled = false;
      message.textContent = 'This account is pending Manager approval.';
      return;
    }

    const approvedAccounts = JSON.parse(localStorage.getItem(APPROVED_ACCOUNTS_KEY) || '[]');
    const approvedAccount = approvedAccounts.find(account => account.username === credential && account.password === password);
    if (approvedAccount) {
      if (approvedAccount.active === false) {
        button.disabled = false;
        message.textContent = 'This account is inactive.';
        return;
      }
      localStorage.setItem('pos_demo_profile', JSON.stringify({
        id: approvedAccount.id,
        username: approvedAccount.username,
        full_name: approvedAccount.full_name,
        role: approvedAccount.role,
        active: approvedAccount.active !== false,
        demo: true
      }));
      window.location.href = roleLandingUrl(approvedAccount.role);
      return;
    }

    const mockAccount = Object.values(getDemoAccounts()).find(account => account.username === credential && account.password === password);
    if (mockAccount) {
      if (mockAccount.active === false) {
        button.disabled = false;
        message.textContent = 'This account is inactive.';
        return;
      }
      localStorage.setItem('pos_demo_profile', JSON.stringify({
        id: mockAccount.id,
        username: mockAccount.username,
        full_name: mockAccount.full_name,
        role: mockAccount.role,
        active: true,
        demo: true
      }));
      window.location.href = roleLandingUrl(mockAccount.role);
      return;
    }

    let email = credential.includes('@') ? credential : null;
    if (!email) {
      const { data, error } = await supabase.rpc('lookup_login_account', { p_username: credential });
      const profile = data?.[0];
      if (error || !profile) { button.disabled = false; message.textContent = 'Invalid username or password.'; return; }
      if (profile.active === false) { button.disabled = false; message.textContent = 'This account is inactive.'; return; }
      email = profile.email;
    }

    if (!email) { button.disabled = false; message.textContent = 'This account has no login email.'; return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    button.disabled = false;
    if (error) { message.textContent = 'Invalid username or password.'; return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      message.textContent = profileError?.message || 'Could not load your account role.';
      return;
    }
    window.location.href = roleLandingUrl(profile.role);
  });
}

const activeSession = await loadProfile();
if (page === 'login') {
  if (new URLSearchParams(window.location.search).get('reset') === '1') await renderLogin();
  else if (activeSession) window.location.href = roleLandingUrl(sessionProfile?.role);
  else await renderLogin();
} else if (!activeSession) {
  window.location.href = '../login.html';
} else if (!canAccess(page)) {
  accessDenied();
} else if (page === 'dashboard') await renderDashboard();
else if (page === 'products') await renderProducts();
else if (page === 'customers') await renderCustomers();
else if (page === 'sales') await renderSales();
else if (page === 'receipt') await renderReceipt();
else if (page === 'history') await renderHistory();
else if (page === 'reports') await renderReports();
else if (page === 'users') await renderUsers();
else await renderDashboard();
