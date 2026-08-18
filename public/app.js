document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  lucide.createIcons();

  // --- APP STATE ---
  const state = {
    isAuthenticated: false,
    events: [],
    currentEventId: null,
    sales: [],
    selectedLocation: 'Jales',
    selectedPayment: 'PIX',
    showAllSales: false,
    editingSaleId: null,
    selectedInstallments: null,
    currentPhoto: null,
    notes: ''
  };

  // --- DOM ELEMENTS ---
  const screenLogin = document.getElementById('screen-login');
  const screenEvents = document.getElementById('screen-events');
  const appWrapper = document.getElementById('app-wrapper');
  const loginPassword = document.getElementById('login-password');
  const btnLogin = document.getElementById('btn-login');
  const loginError = document.getElementById('login-error');

  // Events screen elements
  const eventsListContainer = document.getElementById('events-list-container');
  const btnNewEvent = document.getElementById('btn-new-event');
  const eventModal = document.getElementById('event-modal');
  const btnCloseEvent = document.getElementById('btn-close-event');
  const btnSaveEvent = document.getElementById('btn-save-event');
  const eventNameInput = document.getElementById('event-name-input');
  const btnSwitchEvent = document.getElementById('btn-switch-event');

  const screenDashboard = document.getElementById('screen-dashboard');
  const screenNewSale = document.getElementById('screen-new-sale');
  
  const navBtnDashboard = document.getElementById('nav-btn-dashboard');
  const navBtnNewSale = document.getElementById('nav-btn-new-sale');
  const fabAddSaleBtn = document.getElementById('fab-add-sale-btn');
  const btnLogoutHeader = document.getElementById('btn-logout-header');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  // Desktop sidebar elements
  const sidebarNavBtns = document.querySelectorAll('.sidebar-nav-btn');
  const btnLogoutSidebar = document.getElementById('btn-logout-sidebar');

  // Extra stat cards
  const dashboardCount = document.getElementById('dashboard-count');

  // Dashboard Elements
  const dashboardTotal = document.getElementById('dashboard-total');
  const dashboardEventName = document.getElementById('dashboard-event-name');
  const btnRefreshData = document.getElementById('btn-refresh-data');
  const btnFinalizeEvent = document.getElementById('btn-finalize-event');
  const salesListContainer = document.getElementById('sales-list-container');
  const btnVerTudo = document.getElementById('btn-ver-tudo');
  const dashboardSearch = document.getElementById('dashboard-search');

  // Locations detail modal
  const locationsModal = document.getElementById('locations-modal');
  const btnCloseLocations = document.getElementById('btn-close-locations');
  const btnCloseLocationsFooter = document.getElementById('btn-close-locations-footer');
  const locationsModalBody = document.getElementById('locations-modal-body');

  // Photo zoom
  const photoZoomOverlay = document.getElementById('photo-zoom-overlay');
  const photoZoomImg = document.getElementById('photo-zoom-img');
  const photoZoomClose = document.getElementById('photo-zoom-close');

  // New Sale Elements
  const newSaleForm = document.getElementById('new-sale-form');
  const saleProductSelect = document.getElementById('sale-product');
  const saleValueInput = document.getElementById('sale-value-input');
  const saleNotes = document.getElementById('sale-notes');
  const locationPills = document.querySelectorAll('.location-pill');
  const paymentCards = document.querySelectorAll('.payment-card');
  const photoCaptureCard = document.getElementById('photo-capture-card');
  const salePhotoInput = document.getElementById('sale-photo-input');
  const photoPreview = document.getElementById('photo-preview');
  const photoPlaceholder = document.getElementById('photo-placeholder');

  // Theme mode
  const THEME_KEY = 'radical-theme';
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      applyTheme('light');
    }
  }
  function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }
  initTheme();
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // --- AUTHENTICATION ---
  // Helper to fetch with auth token
  async function secureFetch(url, options = {}) {
    const token = localStorage.getItem('radical_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      // Token expired or invalid
      doLogout();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return response;
  }

  async function attemptLogin() {
    const password = loginPassword.value.trim();
    if (!password) return;

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('radical_token', data.token);
        state.isAuthenticated = true;
        loginPassword.value = '';
        loginError.style.display = 'none';

        // Fade out login, show event selection
        screenLogin.style.opacity = '0';
        screenLogin.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
          screenLogin.style.display = 'none';
          screenEvents.classList.remove('hidden');
          loadEvents();
        }, 380);
      } else {
        const errData = await response.json().catch(() => ({}));
        loginError.textContent = errData.error || 'Senha incorreta.';
        loginError.style.display = 'block';
        loginPassword.value = '';
      }
    } catch (err) {
      console.error(err);
      loginError.textContent = 'Erro ao conectar ao servidor.';
      loginError.style.display = 'block';
    }
  }

  btnLogin.addEventListener('click', attemptLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });

  function doLogout() {
    state.isAuthenticated = false;
    state.sales = [];
    state.currentEventId = null;
    localStorage.removeItem('radical_token');
    // Fade out app, show login
    appWrapper.style.opacity = '0';
    appWrapper.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      appWrapper.classList.add('hidden');
      screenEvents.classList.add('hidden'); // Certifica que oculta seleção de eventos
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

  // Auto-login if token is present
  const existingToken = localStorage.getItem('radical_token');
  if (existingToken) {
    state.isAuthenticated = true;
    screenLogin.style.display = 'none';
    screenEvents.classList.remove('hidden');
    loadEvents();
  }

  // --- EVENT SELECTION ---
  // Return to the events screen (from the app)
  if (btnSwitchEvent) {
    btnSwitchEvent.addEventListener('click', () => {
      appWrapper.classList.add('hidden');
      screenEvents.classList.remove('hidden');
      loadEvents();
    });
  }

  async function loadEvents() {
    try {
      const response = await secureFetch('/api/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      state.events = await response.json();
      renderEvents();
    } catch (err) {
      console.error('Error loading events:', err);
    }
  }

  function renderEvents() {
    eventsListContainer.innerHTML = '';

    if (state.events.length === 0) {
      eventsListContainer.innerHTML = `<div class="events-empty">Nenhum evento criado ainda.</div>`;
      return;
    }

    state.events.forEach(ev => {
      // Container div to wrap the button card and action button
      const cardWrapper = document.createElement('div');
      cardWrapper.style.display = 'flex';
      cardWrapper.style.alignItems = 'center';
      cardWrapper.style.width = '100%';
      cardWrapper.style.gap = '8px';

      const btn = document.createElement('button');
      btn.className = 'event-card';
      btn.style.flexGrow = '1';
      btn.innerHTML = `
        <div class="event-card-icon"><i data-lucide="ticket"></i></div>
        <div class="event-card-info">
          <div class="event-card-name">${escapeHTML(ev.name)}</div>
          <div class="event-card-action">Entrar no evento</div>
        </div>
        <i data-lucide="chevron-right" class="event-card-arrow"></i>
      `;
      btn.addEventListener('click', () => enterEvent(ev.id));
      cardWrapper.appendChild(btn);

      // PDF export event button
      const pdfBtn = document.createElement('button');
      pdfBtn.className = 'event-pdf-btn';
      pdfBtn.title = 'Gerar Relatório PDF deste Evento';
      pdfBtn.innerHTML = `<i data-lucide="file-text"></i>`;
      pdfBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          let eventSales = [];
          if (state.currentEventId !== null && String(state.currentEventId) === String(ev.id) && state.sales?.length) {
            eventSales = state.sales;
          } else {
            const response = await secureFetch(`/api/sales?eventId=${encodeURIComponent(ev.id)}`);
            if (!response.ok) throw new Error('Erro ao buscar vendas');
            eventSales = await response.json();
          }
          exportEventPDF(ev.id, ev.name, eventSales);
        } catch (err) {
          alert('Erro ao carregar vendas do evento: ' + err.message);
        }
      });
      cardWrapper.appendChild(pdfBtn);

      // Delete event button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'event-delete-btn';
      deleteBtn.title = 'Excluir Evento';
      deleteBtn.innerHTML = `<i data-lucide="trash-2"></i>`;
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const passwordInput = prompt(`Para excluir o evento "${ev.name}", digite a senha de confirmação:`);
        if (passwordInput === null) return;

        try {
          const response = await secureFetch('/api/verify-delete', {
            method: 'POST',
            body: JSON.stringify({ password: passwordInput })
          });

          if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Senha incorreta. O evento não foi excluído.');
            return;
          }
        } catch (err) {
          console.error(err);
          alert('Erro ao verificar senha.');
          return;
        }

        if (!confirm(`Tem certeza que deseja excluir o evento "${ev.name}"? Todas as vendas vinculadas a ele serão excluídas permanentemente.`)) {
          return;
        }

        try {
          const response = await secureFetch(`/api/events/${ev.id}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Erro ao deletar o evento.');
          }

          alert('Evento excluído com sucesso!');
          if (state.currentEventId !== null && String(state.currentEventId) === String(ev.id)) {
            state.currentEventId = null;
            state.sales = [];
          }
          loadEvents();
        } catch (err) {
          console.error(err);
          alert(err.message || 'Erro ao deletar o evento.');
        }
      });
      cardWrapper.appendChild(deleteBtn);

      eventsListContainer.appendChild(cardWrapper);
    });

    lucide.createIcons();
  }

  async function enterEvent(eventId) {
    state.currentEventId = eventId;
    const currentEv = state.events.find(e => String(e.id) === String(eventId));
    if (dashboardEventName) {
      dashboardEventName.textContent = currentEv ? currentEv.name : 'Geral';
    }
    screenEvents.classList.add('hidden');
    appWrapper.classList.remove('hidden');
    appWrapper.style.opacity = '0';
    appWrapper.style.transition = 'opacity 0.4s ease';
    requestAnimationFrame(() => { appWrapper.style.opacity = '1'; });
    await loadSales(eventId);
    switchScreen('dashboard');
  }

  // New event modal
  btnNewEvent.addEventListener('click', () => {
    eventNameInput.value = '';
    eventModal.classList.add('active');
    setTimeout(() => eventNameInput.focus(), 100);
  });

  function closeEventModal() {
    eventModal.classList.remove('active');
  }
  btnCloseEvent.addEventListener('click', closeEventModal);

  btnSaveEvent.addEventListener('click', async () => {
    const name = eventNameInput.value.trim();
    if (!name) {
      eventNameInput.focus();
      return;
    }
    try {
      const response = await secureFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('Failed to create event');
      const newEvent = await response.json();
      state.events.push(newEvent);
      renderEvents();
      closeEventModal();
    } catch (err) {
      console.error(err);
      alert('Erro ao criar o evento.');
    }
  });

  // --- SCREEN ROUTING ---
  function switchScreen(target) {
    if (target === 'dashboard') {
      screenDashboard.classList.add('active');
      screenNewSale.classList.remove('active');
      navBtnDashboard.classList.add('active');
      navBtnNewSale.classList.remove('active');
      // Sync sidebar
      sidebarNavBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === 'dashboard'));
      renderDashboard();
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
  async function loadSales(eventId) {
    const targetEventId = (eventId !== undefined) ? eventId : state.currentEventId;
    try {
      const url = targetEventId ? `/api/sales?eventId=${encodeURIComponent(targetEventId)}` : '/api/sales';
      const response = await secureFetch(url);
      if (!response.ok) throw new Error('Failed to fetch sales');

      state.sales = await response.json();
      renderDashboard();
    } catch (err) {
      console.error('Error loading sales:', err);
    }
  }

  function renderDashboard() {
    // 1. Calculate stats
    const query = (dashboardSearch ? dashboardSearch.value.trim() : '').toLowerCase();
    const baseSales = state.sales || [];
    const filteredSales = query ? baseSales.filter(s => (s.product || '').toLowerCase().includes(query)) : baseSales;
    const total = filteredSales.reduce((sum, s) => sum + s.value, 0);
    const count = filteredSales.length;

    dashboardTotal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (dashboardCount) dashboardCount.textContent = count;

    // 2. Render Sales List
    salesListContainer.innerHTML = '';
    
    // Determine limit
    const renderLimit = state.showAllSales ? filteredSales.length : 4;
    const itemsToRender = filteredSales.slice(0, renderLimit);

    if (itemsToRender.length === 0) {
      salesListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma venda registrada.</div>`;
      return;
    }

    itemsToRender.forEach(sale => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('sales-item');

      // Map products to icons/placeholders
      let photoHTML = `<i data-lucide="bike"></i>`;
      if (sale.photo) {
        photoHTML = `<img src="${sale.photo}" alt="${escapeHTML(sale.product)}" />`;
      } else if (sale.product.includes('Carbon')) {
        photoHTML = `<i data-lucide="shield-alert" style="color: var(--accent-red);"></i>`;
      } else if (sale.product.includes('Neon')) {
        photoHTML = `<i data-lucide="shield" style="color: var(--color-jales);"></i>`;
      } else if (sale.product.includes('Dirt')) {
        photoHTML = `<i data-lucide="navigation" style="color: var(--color-riopreto);"></i>`;
      } else {
        photoHTML = `<i data-lucide="helmet" style="color: var(--text-muted);"></i>`;
      }

      const locationClass = sale.location.toLowerCase().replace(/\s+/g, '');

      itemDiv.innerHTML = `
        <div class="product-img-box">
          ${photoHTML}
        </div>
        <div class="sales-details">
          <div class="product-name">${escapeHTML(sale.product)}</div>
          <div class="product-price">${sale.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          ${sale.notes ? `<div class="product-notes">${escapeHTML(sale.notes)}</div>` : ''}
        </div>
        <div class="sales-meta">
          <span class="loc-badge ${locationClass}">${escapeHTML(sale.location)}</span>
          <span class="payment-method">${escapeHTML(sale.payment)}${sale.installments ? ' ' + sale.installments + 'x' : ''}</span>
        </div>
        <div class="sales-actions">
          <button class="sale-action-btn edit" data-id="${sale.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="sale-action-btn delete" data-id="${sale.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      salesListContainer.appendChild(itemDiv);
    });

    // Wire edit/delete buttons
    salesListContainer.querySelectorAll('.sale-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => openEditSale(btn.getAttribute('data-id')));
    });
    salesListContainer.querySelectorAll('.sale-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteSale(btn.getAttribute('data-id')));
    });

    // Update Lucide icons inside list
    lucide.createIcons();
  }

  // ── Helper para garantir carregamento do jsPDF ──
  function getJsPdfConstructor() {
    if (typeof window.jspdf !== 'undefined') {
      if (typeof window.jspdf.jsPDF === 'function') return window.jspdf.jsPDF;
      if (typeof window.jspdf === 'function') return window.jspdf;
    }
    if (typeof window.jsPDF === 'function') return window.jsPDF;
    if (typeof jsPDF === 'function') return jsPDF;
    return null;
  }

  async function ensureJsPDF() {
    let ctor = getJsPdfConstructor();
    if (ctor) return ctor;

    const loadScript = (src) => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });

    if (!getJsPdfConstructor()) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }
    if (!getJsPdfConstructor()) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    if (!getJsPdfConstructor()) {
      await loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }

    // Garantir plugin AutoTable
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');

    return getJsPdfConstructor();
  }

  // --- FINALIZAR EVENTO & EXPORTAR RELATÓRIO PDF ---
  async function exportEventPDF(eventId, eventName, salesList) {
    const sales = salesList || [];
    if (sales.length === 0) {
      alert(`Nenhuma venda registrada para o evento "${eventName}".`);
      return;
    }

    const confirmed = confirm(`Deseja finalizar o evento "${eventName}" e baixar o relatório completo de vendas em PDF?`);
    if (!confirmed) return;

    try {
      const JsPDFClass = await ensureJsPDF();
      if (!JsPDFClass) {
        alert('Não foi possível carregar a biblioteca de PDF. Verifique sua conexão com a internet e tente novamente.');
        return;
      }

      const doc = new JsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Cálculos gerais
      const totalValue = sales.reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
      const totalCount = sales.length;
      const ticketMedio = totalCount > 0 ? (totalValue / totalCount) : 0;

      // Agrupamento por Filial
      const byLoc = {};
      sales.forEach(s => {
        const loc = s.location || 'Outros';
        if (!byLoc[loc]) byLoc[loc] = { count: 0, total: 0 };
        byLoc[loc].count += 1;
        byLoc[loc].total += (parseFloat(s.value) || 0);
      });

      // Agrupamento por Forma de Pagamento
      const byPay = {};
      sales.forEach(s => {
        const pay = s.payment || 'Outros';
        if (!byPay[pay]) byPay[pay] = { count: 0, total: 0 };
        byPay[pay].count += 1;
        byPay[pay].total += (parseFloat(s.value) || 0);
      });

      const now = new Date();
      const dataHoraStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // ── CABEÇALHO COM BRANDING RADICAL ──
      doc.setFillColor(196, 24, 10); // Vermelho Radical
      doc.rect(0, 0, 210, 30, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('RADICAL CAPACETES', 14, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 220, 215);
      doc.text('RELATÓRIO DE FECHAMENTO DE EVENTO', 14, 22);

      // ── INFORMAÇÕES DO EVENTO ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text(`EVENTO: ${eventName.toUpperCase()}`, 14, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(`Data de Emissão: ${dataHoraStr}`, 14, 46);

      // ── CARDS DE RESUMO (KPIS) ──
      // Total Geral
      doc.setFillColor(245, 245, 248);
      doc.roundedRect(14, 51, 58, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text('TOTAL FATURADO', 18, 58);
      doc.setFontSize(12);
      doc.setTextColor(196, 24, 10);
      doc.text(totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 18, 67);

      // Total Pedidos
      doc.setFillColor(245, 245, 248);
      doc.roundedRect(76, 51, 58, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text('TOTAL DE VENDAS', 80, 58);
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(`${totalCount} capacete(s)`, 80, 67);

      // Ticket Médio
      doc.setFillColor(245, 245, 248);
      doc.roundedRect(138, 51, 58, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text('TICKET MÉDIO', 142, 58);
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 142, 67);

      // ── TABELAS RESUMO (FILIAIS E FORMAS DE PAGAMENTO) ──
      const locRows = Object.entries(byLoc).map(([loc, data]) => [
        loc,
        `${data.count} un`,
        data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);

      const payRows = Object.entries(byPay).map(([pay, data]) => [
        pay,
        `${data.count} un`,
        data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);

      const applyAutoTable = (opts) => {
        if (typeof doc.autoTable === 'function') {
          doc.autoTable(opts);
        } else if (typeof window.jspdfAutoTable === 'function') {
          window.jspdfAutoTable(doc, opts);
        } else if (typeof window.autoTable === 'function') {
          window.autoTable(doc, opts);
        } else if (window.jspdf?.autoTable) {
          window.jspdf.autoTable(doc, opts);
        }
      };

      // Tabela Filiais
      applyAutoTable({
        startY: 78,
        margin: { left: 14, right: 110 },
        head: [['Filial', 'Qtd', 'Total']],
        body: locRows,
        theme: 'grid',
        headStyles: { fillColor: [45, 45, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 16 },
          2: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const afterLocY = doc.lastAutoTable?.finalY || 115;

      // Tabela Formas de Pagamento
      applyAutoTable({
        startY: 78,
        margin: { left: 110, right: 14 },
        head: [['Forma de Pagamento', 'Qtd', 'Total']],
        body: payRows,
        theme: 'grid',
        headStyles: { fillColor: [45, 45, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 16 },
          2: { halign: 'right', fontStyle: 'bold' }
        }
      });

      const afterPayY = doc.lastAutoTable?.finalY || 115;
      const startDetailsY = Math.max(afterLocY, afterPayY) + 10;

      // ── TABELA DETALHADA DE VENDAS ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text('DETALHAMENTO DE TODAS AS VENDAS', 14, startDetailsY - 3);

      const salesTableBody = sales.map((sale, index) => {
        let dataStr = '-';
        if (sale.date) {
          const d = new Date(sale.date);
          dataStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        const paymentStr = (sale.payment || '-') + (sale.installments ? ` (${sale.installments}x)` : '');
        const valStr = (parseFloat(sale.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return [
          String(index + 1),
          dataStr,
          sale.product || 'Capacete',
          sale.location || '-',
          paymentStr,
          sale.notes || '-',
          valStr
        ];
      });

      applyAutoTable({
        startY: startDetailsY,
        margin: { left: 14, right: 14 },
        head: [['#', 'Data/Hora', 'Produto / Capacete', 'Filial', 'Pagamento', 'Observações', 'Valor']],
        body: salesTableBody,
        foot: [['', '', 'TOTAL GERAL', '', `${totalCount} itens`, '', totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]],
        theme: 'striped',
        headStyles: {
          fillColor: [196, 24, 10],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5
        },
        footStyles: {
          fillColor: [240, 240, 245],
          textColor: [196, 24, 10],
          fontStyle: 'bold',
          fontSize: 9.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [40, 40, 40]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { cellWidth: 26, fontSize: 7.5 },
          2: { fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 24 },
          4: { halign: 'center', cellWidth: 26 },
          5: { fontSize: 7.5 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 26 }
        }
      });

      // ── NUMERAÇÃO DAS PÁGINAS NO RODAPÉ ──
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Radical Capacetes • Página ${p} de ${totalPages}`,
          14,
          290
        );
      }

      const safeName = (eventName || 'Evento').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileDate = now.toISOString().slice(0, 10);
      doc.save(`Fechamento_Evento_${safeName}_${fileDate}.pdf`);

    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o arquivo PDF: ' + err.message);
    }
  }

  // Finalizar evento button handler
  if (btnFinalizeEvent) {
    btnFinalizeEvent.addEventListener('click', () => {
      const ev = state.events.find(e => String(e.id) === String(state.currentEventId));
      const eventName = ev ? ev.name : (dashboardEventName ? dashboardEventName.textContent : 'Geral');
      exportEventPDF(state.currentEventId, eventName, state.sales);
    });
  }

  // --- LOCATIONS DETAIL MODAL ---
  function openLocationsModal() {
    const sales = state.sales || [];
    if (sales.length === 0) {
      locationsModalBody.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Nenhuma venda registrada para este evento.</p>';
      locationsModal.classList.add('active');
      return;
    }

    const grouped = {};
    sales.forEach(s => {
      if (!grouped[s.location]) grouped[s.location] = { total: 0, items: [] };
      grouped[s.location].total += s.value;
      grouped[s.location].items.push(s);
    });

    let activeLocation = null;
    let html = `
      <div class="locations-summary">
        <div class="locations-summary-item" data-location="Jales">
          <span class="locations-summary-label">Jales</span>
          <span class="locations-summary-value">${(grouped['Jales']?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div class="locations-summary-item" data-location="Votuporanga">
          <span class="locations-summary-label">Votuporanga</span>
          <span class="locations-summary-value">${(grouped['Votuporanga']?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div class="locations-summary-item" data-location="Rio Preto">
          <span class="locations-summary-label">Rio Preto</span>
          <span class="locations-summary-value">${(grouped['Rio Preto']?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      </div>
      <button type="button" class="locations-reset-btn" id="locations-reset-btn" style="display:none;">MOSTRAR TODAS AS FILIAIS</button>
      <div class="location-groups-wrapper"></div>
    `;

    locationsModalBody.innerHTML = html;
    locationsModal.classList.add('active');

    const resetBtn = document.getElementById('locations-reset-btn');
    const summaryItems = locationsModalBody.querySelectorAll('.locations-summary-item');
    const groupsWrapper = locationsModalBody.querySelector('.location-groups-wrapper');

    function renderFiltered() {
      const locationsToRender = activeLocation ? [activeLocation] : Object.keys(grouped);
      let newHtml = '';
      locationsToRender.forEach(loc => {
        const data = grouped[loc];
        if (!data) return;
        newHtml += `
          <div class="location-group">
            <div class="location-header">
              <span class="location-name">${escapeHTML(loc)}</span>
              <span class="location-total">${data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div class="location-items">
        `;
        data.items.forEach(item => {
          newHtml += `
            <div class="location-item">
              <div class="location-item-left">
                ${item.photo ? `<img class="location-item-photo" src="${item.photo}" alt="${escapeHTML(item.product)}">` : `<i data-lucide="bike" class="location-item-icon"></i>`}
                <div class="location-item-info">
                  <span class="location-item-name">${escapeHTML(item.product)}</span>
                  ${item.notes ? `<span class="location-item-note">${escapeHTML(item.notes)}</span>` : ''}
                </div>
              </div>
              <div class="location-item-right">
                <span class="location-item-payment">${escapeHTML(item.payment)}${item.installments ? ' ' + item.installments + 'x' : ''}</span>
                <span class="location-item-value">${item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>
          `;
        });
        newHtml += `</div></div>`;
      });
      groupsWrapper.innerHTML = newHtml;
      lucide.createIcons();
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        activeLocation = null;
        resetBtn.style.display = 'none';
        summaryItems.forEach(item => item.classList.remove('active'));
        renderFiltered();
      });
    }

    summaryItems.forEach(item => {
      item.addEventListener('click', () => {
        const loc = item.getAttribute('data-location');
        if (activeLocation === loc) {
          activeLocation = null;
          resetBtn.style.display = 'none';
          summaryItems.forEach(i => i.classList.remove('active'));
        } else {
          activeLocation = loc;
          resetBtn.style.display = 'block';
          summaryItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-location') === loc));
        }
        renderFiltered();
      });
    });

    renderFiltered();
  }

  function closeLocationsModal() {
    locationsModal.classList.remove('active');
  }

  if (dashboardTotal) {
    dashboardTotal.addEventListener('click', openLocationsModal);
    dashboardTotal.style.cursor = 'pointer';
  }
  if (btnCloseLocations) btnCloseLocations.addEventListener('click', closeLocationsModal);
  if (btnCloseLocationsFooter) btnCloseLocationsFooter.addEventListener('click', closeLocationsModal);

  locationsModalBody.addEventListener('click', (e) => {
    const img = e.target.closest('.location-item-photo');
    if (!img) return;
    photoZoomImg.src = img.src;
    photoZoomOverlay.classList.add('active');
  });

  photoZoomClose.addEventListener('click', () => photoZoomOverlay.classList.remove('active'));
  photoZoomOverlay.addEventListener('click', (e) => { if (e.target === photoZoomOverlay) photoZoomOverlay.classList.remove('active'); });

  async function deleteSale(id) {
    if (!confirm('Tem certeza que deseja excluir esta venda?')) return;
    try {
      const response = await secureFetch('/api/sales/' + id, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      state.sales = (state.sales || []).filter(s => String(s.id) !== String(id));
      renderDashboard();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir a venda.');
    }
  }

  // Refresh button listener
  if (btnRefreshData) {
    btnRefreshData.addEventListener('click', async () => {
      btnRefreshData.classList.add('spinning');
      try {
        await loadSales(state.currentEventId);
      } catch (err) {
        console.error('Erro ao atualizar:', err);
      } finally {
        setTimeout(() => btnRefreshData.classList.remove('spinning'), 600);
      }
    });
  }

  function openEditSale(id) {
    const sale = state.sales.find(s => String(s.id) === String(id));
    if (!sale) return;

    // Fill the new-sale form with existing data
    saleProductSelect.value = sale.product;
    state.selectedLocation = sale.location;
    state.selectedPayment = sale.payment;

    // Sync location pills
    locationPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-location') === sale.location));
    // Sync payment cards
    paymentCards.forEach(c => c.classList.toggle('active', c.getAttribute('data-payment') === sale.payment));

    // Sync installments
    state.selectedInstallments = sale.installments || null;
    if (sale.payment === 'PARCELADO') {
      installmentsPanel.style.display = 'flex';
      installmentsGrid.querySelectorAll('.installment-pill').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-installments'), 10) === (sale.installments || 0));
      });
    } else {
      installmentsPanel.style.display = 'none';
    }

    // Value
    saleValueInput.value = 'R$ ' + sale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // Photo preview
    state.currentPhoto = sale.photo || null;
    if (sale.photo) {
      photoPreview.src = sale.photo;
      photoPreview.classList.remove('hidden');
      photoPlaceholder.classList.add('hidden');
    } else {
      photoPreview.src = '';
      photoPreview.classList.add('hidden');
      photoPlaceholder.classList.remove('hidden');
    }

    lucide.createIcons();

    // Switch to the form and mark editing mode
    state.editingSaleId = id;
    switchScreen('new-sale');
  }

  if (btnVerTudo) {
    btnVerTudo.addEventListener('click', () => {
      state.showAllSales = !state.showAllSales;
      btnVerTudo.textContent = state.showAllSales ? 'VER MENOS' : 'VER TUDO';
      renderDashboard();
    });
  }

  if (dashboardSearch) {
    dashboardSearch.addEventListener('input', () => {
      renderDashboard();
    });
  }

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
  const installmentsPanel = document.getElementById('installments-panel');
  const installmentsGrid = document.getElementById('installments-grid');

  // Build installments buttons (2 to 12)
  for (let i = 2; i <= 12; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'installment-pill';
    btn.setAttribute('data-installments', i);
    btn.textContent = i + 'x';
    btn.addEventListener('click', () => {
      installmentsGrid.querySelectorAll('.installment-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedInstallments = i;
    });
    installmentsGrid.appendChild(btn);
  }

  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      paymentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedPayment = card.getAttribute('data-payment');

      if (state.selectedPayment === 'PARCELADO') {
        installmentsPanel.style.display = 'flex';
        if (state.selectedInstallments === null) {
          const first = installmentsGrid.querySelector('.installment-pill');
          if (first) first.click();
        }
      } else {
        installmentsPanel.style.display = 'none';
        state.selectedInstallments = null;
      }
    });
  });

  // Form submit
  newSaleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const product = saleProductSelect.value.trim();
    if (!product) {
      alert('Por favor, digite o nome do capacete.');
      saleProductSelect.focus();
      return;
    }

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
      installments: state.selectedPayment === 'PARCELADO' ? (state.selectedInstallments || 1) : null,
      eventId: state.currentEventId,
      photo: state.currentPhoto,
      notes: saleNotes ? saleNotes.value.trim() : ''
    };

    const isEditing = state.editingSaleId !== null;
    const url = isEditing ? '/api/sales/' + state.editingSaleId : '/api/sales';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await secureFetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save sale');
      const savedSale = await response.json();

      if (isEditing) {
        const idx = (state.sales || []).findIndex(s => String(s.id) === String(state.editingSaleId));
        if (idx !== -1) {
          state.sales[idx] = { ...state.sales[idx], ...savedSale };
        }
      } else {
        if (!state.sales) state.sales = [];
        state.sales.unshift(savedSale);
      }

      // Reset form
      saleProductSelect.value = '';
      saleValueInput.value = 'R$ 0,00';
      saleNotes.value = '';
      state.editingSaleId = null;
      state.currentPhoto = null;
      state.notes = '';
      photoPreview.src = '';
      photoPreview.classList.add('hidden');
      photoPlaceholder.classList.remove('hidden');
      
      // Update Lucide icons
      lucide.createIcons();

      // Return to dashboard
      switchScreen('dashboard');
    } catch (err) {
      console.error('Error submitting sale:', err);
      alert('Erro ao enviar a venda para o servidor.');
    }
  });

  // --- PHOTO CAPTURE & COMPRESSION ---
  if (photoCaptureCard && salePhotoInput) {
    photoCaptureCard.addEventListener('click', () => {
      salePhotoInput.click();
    });

    salePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      compressImage(file, (compressedBase64) => {
        state.currentPhoto = compressedBase64;
        photoPreview.src = compressedBase64;
        photoPreview.classList.remove('hidden');
        photoPlaceholder.classList.add('hidden');
      });
    });
  }

  function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG with 0.6 quality to keep payload very small
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
