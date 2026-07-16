document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  lucide.createIcons();

  // --- APP STATE ---
  const state = {
    isAuthenticated: false,
    sales: [],
    selectedLocation: 'Jales',
    selectedPayment: 'PIX',
    uploadedPhotoBase64: null,
    showAllSales: false
  };

  // --- DOM ELEMENTS ---
  const screenLogin = document.getElementById('screen-login');
  const appWrapper = document.getElementById('app-wrapper');
  const loginPassword = document.getElementById('login-password');
  const btnLogin = document.getElementById('btn-login');
  const loginError = document.getElementById('login-error');

  const screenDashboard = document.getElementById('screen-dashboard');
  const screenNewSale = document.getElementById('screen-new-sale');
  
  const navBtnDashboard = document.getElementById('nav-btn-dashboard');
  const navBtnNewSale = document.getElementById('nav-btn-new-sale');
  const fabAddSaleBtn = document.getElementById('fab-add-sale-btn');
  const btnLogoutHeader = document.getElementById('btn-logout-header');

  // Desktop sidebar elements
  const sidebarNavBtns = document.querySelectorAll('.sidebar-nav-btn');
  const btnLogoutSidebar = document.getElementById('btn-logout-sidebar');

  // Extra stat cards
  const dashboardCount = document.getElementById('dashboard-count');
  const dashboardAvg = document.getElementById('dashboard-avg');

  // Dashboard Elements
  const dashboardTotal = document.getElementById('dashboard-total');
  const salesListContainer = document.getElementById('sales-list-container');
  const btnVerTudo = document.getElementById('btn-ver-tudo');
  const btnOpenAI = document.getElementById('btn-open-ai');

  // New Sale Elements
  const newSaleForm = document.getElementById('new-sale-form');
  const btnPhotoCapture = document.getElementById('btn-photo-capture');
  const photoUploadInput = document.getElementById('photo-upload-input');
  const photoPreviewContainer = document.getElementById('photo-preview-container');
  const saleProductSelect = document.getElementById('sale-product');
  const saleValueInput = document.getElementById('sale-value-input');
  const locationPills = document.querySelectorAll('.location-pill');
  const paymentCards = document.querySelectorAll('.payment-card');

  // AI Modal Elements
  const aiModal = document.getElementById('ai-modal');
  const btnCloseAI = document.getElementById('btn-close-ai');
  const btnCloseAIFooter = document.getElementById('btn-close-ai-footer');
  const aiInsightsLoading = document.getElementById('ai-insights-loading');
  const aiInsightsContent = document.getElementById('ai-insights-content');

  // --- AUTHENTICATION ---
  function attemptLogin() {
    const password = loginPassword.value.trim();
    if (password === '1234') {
      state.isAuthenticated = true;
      loginPassword.value = '';
      loginError.style.display = 'none';

      // Fade out login, show dashboard
      screenLogin.style.opacity = '0';
      screenLogin.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        screenLogin.style.display = 'none';
        appWrapper.classList.remove('hidden');
        appWrapper.style.opacity = '0';
        appWrapper.style.transition = 'opacity 0.4s ease';
        requestAnimationFrame(() => {
          appWrapper.style.opacity = '1';
        });
      }, 380);

      loadSales();
    } else {
      loginError.style.display = 'block';
      loginPassword.value = '';
    }
  }

  btnLogin.addEventListener('click', attemptLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  function doLogout() {
    state.isAuthenticated = false;
    // Fade out app, show login
    appWrapper.style.opacity = '0';
    appWrapper.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      appWrapper.classList.add('hidden');
      appWrapper.style.opacity = '';
      appWrapper.style.transition = '';
      screenLogin.style.display = 'flex';
      screenLogin.style.opacity = '0';
      screenLogin.style.transition = 'opacity 0.4s ease';
      requestAnimationFrame(() => {
        screenLogin.style.opacity = '1';
      });
      loginPassword.value = '';
    }, 280);
  }

  if (btnLogoutHeader)  btnLogoutHeader.addEventListener('click', doLogout);
  if (btnLogoutSidebar) btnLogoutSidebar.addEventListener('click', doLogout);

  // --- SCREEN ROUTING ---
  function switchScreen(target) {
    if (target === 'dashboard') {
      screenDashboard.classList.add('active');
      screenNewSale.classList.remove('active');
      navBtnDashboard.classList.add('active');
      navBtnNewSale.classList.remove('active');
      // Sync sidebar
      sidebarNavBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === 'dashboard'));
      loadSales();
    } else if (target === 'new-sale') {
      screenNewSale.classList.add('active');
      screenDashboard.classList.remove('active');
      navBtnNewSale.classList.add('active');
      navBtnDashboard.classList.remove('active');
      // Sync sidebar
      sidebarNavBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === 'new-sale'));
    }
  }

  // Wire sidebar nav buttons
  sidebarNavBtns.forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.getAttribute('data-target')));
  });

  navBtnDashboard.addEventListener('click', () => switchScreen('dashboard'));
  navBtnNewSale.addEventListener('click', () => switchScreen('new-sale'));
  fabAddSaleBtn.addEventListener('click', () => switchScreen('new-sale'));

  // --- SALES LOADER & RENDERER ---
  async function loadSales() {
    try {
      const response = await fetch('/api/sales');
      if (!response.ok) throw new Error('Failed to fetch sales');
      
      state.sales = await response.json();
      renderDashboard();
    } catch (err) {
      console.error('Error loading sales:', err);
    }
  }

  function renderDashboard() {
    // 1. Calculate stats
    const total = state.sales.reduce((sum, s) => sum + s.value, 0);
    const count = state.sales.length;
    const avg   = count > 0 ? total / count : 0;

    dashboardTotal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (dashboardCount) dashboardCount.textContent = count;
    if (dashboardAvg)   dashboardAvg.textContent   = avg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 2. Render Sales List
    salesListContainer.innerHTML = '';
    
    // Determine limit
    const renderLimit = state.showAllSales ? state.sales.length : 4;
    const itemsToRender = state.sales.slice(0, renderLimit);

    if (itemsToRender.length === 0) {
      salesListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma venda registrada.</div>`;
      return;
    }

    itemsToRender.forEach(sale => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('sales-item');

      // Check if custom photo base64 is present, otherwise use generic icon
      let photoHTML = `<i data-lucide="bike"></i>`;
      if (sale.photo) {
        photoHTML = `<img src="${sale.photo}" alt="${sale.product}">`;
      } else {
        // Map products to icons/placeholders
        if (sale.product.includes('Carbon')) {
          photoHTML = `<i data-lucide="shield-alert" style="color: var(--accent-red);"></i>`;
        } else if (sale.product.includes('Neon')) {
          photoHTML = `<i data-lucide="shield" style="color: var(--color-jales);"></i>`;
        } else if (sale.product.includes('Dirt')) {
          photoHTML = `<i data-lucide="navigation" style="color: var(--color-riopreto);"></i>`;
        } else {
          photoHTML = `<i data-lucide="helmet" style="color: var(--text-muted);"></i>`;
        }
      }

      const locationClass = sale.location.toLowerCase().replace(/\s+/g, '');

      itemDiv.innerHTML = `
        <div class="product-img-box">
          ${photoHTML}
        </div>
        <div class="sales-details">
          <div class="product-name">${escapeHTML(sale.product)}</div>
          <div class="product-price">${sale.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <div class="sales-meta">
          <span class="loc-badge ${locationClass}">${escapeHTML(sale.location)}</span>
          <span class="payment-method">${escapeHTML(sale.payment)}</span>
        </div>
      `;
      salesListContainer.appendChild(itemDiv);
    });

    // Update Lucide icons inside list
    lucide.createIcons();
  }

  // Toggle show all
  btnVerTudo.addEventListener('click', () => {
    state.showAllSales = !state.showAllSales;
    btnVerTudo.textContent = state.showAllSales ? 'VER MENOS' : 'VER TUDO';
    renderDashboard();
  });

  // --- NEW SALE FORM HANDLERS ---

  // BRL Currency Input Mask
  saleValueInput.addEventListener('input', function(e) {
    let value = this.value.replace(/\D/g, ''); // Remove non-digits
    let cents = parseInt(value, 10) || 0;
    
    // Format BRL style
    let formatted = (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2
    });
    
    this.value = 'R$ ' + formatted;
  });

  // Handle location pill selection
  locationPills.forEach(pill => {
    pill.addEventListener('click', () => {
      locationPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedLocation = pill.getAttribute('data-location');
    });
  });

  // Handle payment method card selection
  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      paymentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedPayment = card.getAttribute('data-payment');
    });
  });

  // Simulated photo capture / File Upload
  btnPhotoCapture.addEventListener('click', () => {
    photoUploadInput.click();
  });

  photoUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      state.uploadedPhotoBase64 = event.target.result;
      
      // Update preview card
      photoPreviewContainer.innerHTML = `
        <img src="${state.uploadedPhotoBase64}" class="uploaded-preview-img" alt="Foto Carregada">
      `;
    };
    reader.readAsDataURL(file);
  });

  // Form submit
  newSaleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const product = saleProductSelect.value;
    
    // Parse value input (strip "R$ ", remove dots, replace comma with dot)
    const rawValue = saleValueInput.value
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const value = parseFloat(rawValue) || 0;

    if (value <= 0) {
      alert('Por favor, digite um valor de venda válido.');
      return;
    }

    const payload = {
      product: product,
      value: value,
      location: state.selectedLocation,
      payment: state.selectedPayment,
      photo: state.uploadedPhotoBase64
    };

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to register sale');

      // Reset form
      saleValueInput.value = 'R$ 0,00';
      state.uploadedPhotoBase64 = null;
      photoPreviewContainer.innerHTML = `
        <div class="camera-icon-wrapper">
          <i data-lucide="camera" class="camera-icon"></i>
        </div>
        <span>TIRAR FOTO DO PRODUTO</span>
      `;
      // Update Lucide icons
      lucide.createIcons();

      // Return to dashboard
      switchScreen('dashboard');
    } catch (err) {
      console.error('Error submitting sale:', err);
      alert('Erro ao enviar a venda para o servidor.');
    }
  });

  // --- AI INSIGHTS DIALOGS ---

  btnOpenAI.addEventListener('click', async () => {
    aiModal.classList.add('active');
    aiInsightsLoading.style.display = 'flex';
    aiInsightsContent.innerHTML = '';

    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('API server error');
      const data = await response.json();

      aiInsightsLoading.style.display = 'none';

      if (data.insights) {
        aiInsightsContent.innerHTML = parseMarkdownToHTML(data.insights);
      }
    } catch (err) {
      console.error(err);
      aiInsightsLoading.style.display = 'none';
      aiInsightsContent.innerHTML = `<p style="color: var(--color-votuporanga); font-weight:600;">Falha de comunicação neural. Erro ao analisar os dados de vendas.</p>`;
    }
  });

  function closeModal() {
    aiModal.classList.remove('active');
  }

  btnCloseAI.addEventListener('click', closeModal);
  btnCloseAIFooter.addEventListener('click', closeModal);

  // Helper Markdown-to-HTML parser (handles headers, bullets, bold text)
  function parseMarkdownToHTML(md) {
    let html = md;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Lists (simple conversion)
    html = html.replace(/^\*\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\-\s+(.*$)/gim, '<li>$1</li>');
    
    // Wrap groups of <li> in <ul> (quick approximate helper)
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    // clean up duplicate adjacent <ul> tags
    html = html.replace(/<\/ul>\s*<ul>/gim, '');

    // Paragraph breaks
    html = html.replace(/\n\n/gim, '</p><p>');
    
    // Horizontal rule
    html = html.replace(/^---/gim, '<hr>');

    // Wrap the whole string in a paragraph tag if it doesn't start with block element
    if (!html.startsWith('<h') && !html.startsWith('<u') && !html.startsWith('<p')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  }

  // Escape HTML helper
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
