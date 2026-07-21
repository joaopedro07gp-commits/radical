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
    currentPhoto: null
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

  // Desktop sidebar elements
  const sidebarNavBtns = document.querySelectorAll('.sidebar-nav-btn');
  const btnLogoutSidebar = document.getElementById('btn-logout-sidebar');

  // Extra stat cards
  const dashboardCount = document.getElementById('dashboard-count');

  // Dashboard Elements
  const dashboardTotal = document.getElementById('dashboard-total');
  const salesListContainer = document.getElementById('sales-list-container');
  const btnVerTudo = document.getElementById('btn-ver-tudo');

  // Locations detail modal
  const locationsModal = document.getElementById('locations-modal');
  const btnCloseLocations = document.getElementById('btn-close-locations');
  const btnCloseLocationsFooter = document.getElementById('btn-close-locations-footer');
  const locationsModalBody = document.getElementById('locations-modal-body');

  // New Sale Elements
  const newSaleForm = document.getElementById('new-sale-form');
  const saleProductSelect = document.getElementById('sale-product');
  const saleValueInput = document.getElementById('sale-value-input');
  const locationPills = document.querySelectorAll('.location-pill');
  const paymentCards = document.querySelectorAll('.payment-card');
  const photoCaptureCard = document.getElementById('photo-capture-card');
  const salePhotoInput = document.getElementById('sale-photo-input');
  const photoPreview = document.getElementById('photo-preview');
  const photoPlaceholder = document.getElementById('photo-placeholder');

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

      // Delete event button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'event-delete-btn';
      deleteBtn.title = 'Excluir Evento';
      deleteBtn.innerHTML = `<i data-lucide="trash-2"></i>`;
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const passwordInput = prompt(`Para excluir o evento "${ev.name}", digite a senha de confirmação:`);
        if (passwordInput === null) return; // Cancelado

        if (passwordInput !== 'radical') {
          alert('Senha incorreta. O evento não foi excluído.');
          return;
        }

        if (!confirm(`Tem certeza que deseja excluir o evento "${ev.name}"? As vendas vinculadas a ele serão migradas para outro evento.`)) {
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
    screenEvents.classList.add('hidden');
    appWrapper.classList.remove('hidden');
    appWrapper.style.opacity = '0';
    appWrapper.style.transition = 'opacity 0.4s ease';
    requestAnimationFrame(() => { appWrapper.style.opacity = '1'; });
    await loadSales();
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
      const response = await secureFetch('/api/sales');
      if (!response.ok) throw new Error('Failed to fetch sales');

      const allSales = await response.json();
      // Filter to the currently selected event
      state.sales = (state.currentEventId !== null)
        ? allSales.filter(s => s.eventId === state.currentEventId)
        : allSales;
      renderDashboard();
    } catch (err) {
      console.error('Error loading sales:', err);
    }
  }

  function renderDashboard() {
    // 1. Calculate stats
    const total = state.sales.reduce((sum, s) => sum + s.value, 0);
    const count = state.sales.length;

    dashboardTotal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (dashboardCount) dashboardCount.textContent = count;

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

      // Map products to icons/placeholders
      let photoHTML = `<i data-lucide="bike"></i>`;
      if (sale.product.includes('Carbon')) {
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
      btn.addEventListener('click', () => openEditSale(parseInt(btn.getAttribute('data-id'), 10)));
    });
    salesListContainer.querySelectorAll('.sale-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteSale(parseInt(btn.getAttribute('data-id'), 10)));
    });

    // Update Lucide icons inside list
    lucide.createIcons();
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

    let html = '';
    Object.keys(grouped).forEach(loc => {
      const data = grouped[loc];
      html += `
        <div class="location-group">
          <div class="location-header">
            <span class="location-name">${escapeHTML(loc)}</span>
            <span class="location-total">${data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div class="location-items">
      `;
      data.items.forEach(item => {
        html += `
          <div class="location-item">
            <span class="location-item-name">${escapeHTML(item.product)}</span>
            <span class="location-item-value">${item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        `;
      });
      html += `</div></div>`;
    });

    locationsModalBody.innerHTML = html;
    locationsModal.classList.add('active');
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

  async function deleteSale(id) {
    if (!confirm('Tem certeza que deseja excluir esta venda?')) return;
    try {
      const response = await secureFetch('/api/sales/' + id, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      await loadSales();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir a venda.');
    }
  }

  function openEditSale(id) {
    const sale = state.sales.find(s => s.id === id);
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

    lucide.createIcons();

    // Switch to the form and mark editing mode
    state.editingSaleId = id;
    switchScreen('new-sale');
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
      eventId: state.currentEventId
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

      // Reset form
      saleValueInput.value = 'R$ 0,00';
      state.editingSaleId = null;
      // Update Lucide icons
      lucide.createIcons();

      // Return to dashboard
      switchScreen('dashboard');
    } catch (err) {
      console.error('Error submitting sale:', err);
      alert('Erro ao enviar a venda para o servidor.');
    }
  });

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
