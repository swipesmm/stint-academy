(() => {
  const FORM_ENDPOINT = 'https://functions.yandexcloud.net/d4ejp67aftq29hjcdf7q';
  const METRIKA_ID = 114470592;
  const PLANS = {
    base: { name: 'Базовый', base: 16670, promo: 15000 },
    setups: { name: 'Сетапы +', base: 22220, promo: 20000 },
    engineer: { name: 'Личный инженер', base: 38890, promo: 35000 }
  };

  const FLEET = [
    { id: 'bmw', name: 'BMW M4 GT3', file: 'BMW.webp' },
    { id: 'porsche', name: 'Porsche 911 GT3 R (992)', file: 'Porsche.webp' },
    { id: 'ferrari', name: 'Ferrari 296 GT3', file: 'Ferrari.webp' },
    { id: 'mercedes', name: 'Mercedes-AMG LMGT3', file: 'Mercedes.webp' },
    { id: 'mclaren', name: 'McLaren 720S LMGT3 Evo', file: 'McLaren.webp' },
    { id: 'aston', name: 'Aston Martin Vantage AMR', file: 'AstonMartin.webp' },
    { id: 'corvette', name: 'Corvette Z06 GT3.R', file: 'Corvette.webp' },
    { id: 'lambo', name: 'Lamborghini Huracan EVO2', file: 'Lamborghini.webp' },
    { id: 'mustang', name: 'Ford Mustang LMGT3', file: 'Mustang.webp' },
    { id: 'lexus', name: 'Lexus RC F LMGT3', file: 'Lexus.webp' }
  ];

  // 1. Мобильное боковое меню Liquid Glass
  const menuBtn = document.getElementById('menuToggle');
  const menuClose = document.getElementById('menuClose');
  const sidebar = document.getElementById('glassSidebar');
  const backdrop = document.getElementById('glassBackdrop');

  function setSidebar(open) {
    if (!sidebar || !backdrop) return;
    sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }

  if (menuBtn) menuBtn.addEventListener('click', () => setSidebar(true));
  if (menuClose) menuClose.addEventListener('click', () => setSidebar(false));
  if (backdrop) backdrop.addEventListener('click', () => setSidebar(false));
  if (sidebar) {
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setSidebar(false));
    });
  }

  // 2. Автоматическая смена 10 машин LMGT3 каждые 3 секунды
  const garageImg = document.getElementById('garageImg');
  const garageTitle = document.getElementById('garageTitle');
  const garageCounter = document.getElementById('garageCounter');

  if (garageImg && garageTitle) {
    let carIndex = 0;
    FLEET.forEach(car => {
      const preload = new Image();
      preload.src = 'assets/img/' + car.file;
    });

    setInterval(() => {
      carIndex = (carIndex + 1) % FLEET.length;
      const car = FLEET[carIndex];
      garageImg.classList.add('is-switching');
      setTimeout(() => {
        garageImg.src = 'assets/img/' + car.file;
        garageImg.alt = car.name + ' LMGT3 в Le Mans Ultimate, STINT ACADEMY';
        garageTitle.textContent = car.name;
        if (garageCounter) {
          garageCounter.textContent = String(carIndex + 1).padStart(2, '0') + ' / ' + FLEET.length;
        }
        garageImg.classList.remove('is-switching');
      }, 180);
    }, 3000);
  }

  // 2.5 Двухслойный шоурум-переход машин на первом экране
  const heroStage = document.getElementById('heroStage');
  const heroVisual = document.getElementById('heroVisual');

  if (heroStage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const layers = heroStage.querySelectorAll('.hero-car');
    if (layers.length === 2) {
      let activeLayer = 0;
      let heroIdx = 2; // Старт с Ferrari 296 GT3
      let busy = false;

      setInterval(async () => {
        if (busy || document.hidden) return;
        busy = true;

        heroIdx = (heroIdx + 1) % FLEET.length;
        const nextCar = FLEET[heroIdx];
        const currentImg = layers[activeLayer];
        const nextImg = layers[1 - activeLayer];

        nextImg.className = 'hero-car is-standby';
        nextImg.src = 'assets/img/' + nextCar.file;
        nextImg.alt = nextCar.name + ' LMGT3 в Le Mans Ultimate, STINT ACADEMY';

        try {
          if (nextImg.decode) await nextImg.decode();
        } catch (e) {}

        void nextImg.offsetWidth;

        if (heroVisual) heroVisual.classList.add('is-shifting');
        currentImg.className = 'hero-car is-leaving';
        nextImg.className = 'hero-car is-active';

        activeLayer = 1 - activeLayer;

        setTimeout(() => {
          if (heroVisual) heroVisual.classList.remove('is-shifting');
          busy = false;
        }, 1050);
      }, 4200);
    }
  }

  // 3. Аккордеон 4 разделов программы
  document.querySelectorAll('.prog-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.prog-item');
      const isOpen = item.classList.contains('is-open');
      document.querySelectorAll('.prog-item').forEach(el => el.classList.remove('is-open'));
      if (!isOpen) item.classList.add('is-open');
    });
  });

  // 4. Захват UTM и промокода из URL
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'promo'];
  const savedMeta = JSON.parse(localStorage.getItem('stint_meta') || '{}');

  utmKeys.forEach(k => {
    const val = params.get(k);
    if (val) savedMeta[k] = val.trim();
  });
  localStorage.setItem('stint_meta', JSON.stringify(savedMeta));

  // 5. Тарифы, пересчет цен и промокоды
  let selectedPlanKey = 'setups';
  let appliedPromoCode = '';

  const promoInput = document.getElementById('promoInput');
  const promoBtn = document.getElementById('promoApplyBtn');
  const priceCurrent = document.getElementById('priceCurrent');
  const priceOld = document.getElementById('priceOld');
  const promoBadge = document.getElementById('promoBadge');
  const planCards = document.querySelectorAll('.plan-card[data-plan]');
  const selectedPlanNameEl = document.getElementById('selectedPlanName');
  const selectedPlanNoteEl = document.getElementById('selectedPlanNote');
  const planInputEl = document.getElementById('planInput');
  const priceInputEl = document.getElementById('priceInput');

  const formatNum = n => Number(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  function animatePrice(el, toValue) {
    if (!el) return;
    const fromValue = parseInt(el.textContent.replace(/\s+/g, ''), 10) || toValue;
    if (fromValue === toValue) {
      el.textContent = formatNum(toValue);
      return;
    }
    const start = performance.now();
    const duration = 240;
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const current = Math.round(fromValue + (toValue - fromValue) * progress);
      el.textContent = formatNum(current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updatePricingUI() {
    const usePromo = Boolean(appliedPromoCode);

    planCards.forEach(card => {
      const key = card.dataset.plan;
      const plan = PLANS[key];
      if (!plan) return;
      card.classList.toggle('is-selected', key === selectedPlanKey);
      const priceEl = card.querySelector('[data-price-value]');
      animatePrice(priceEl, usePromo ? plan.promo : plan.base);
    });

    const activePlan = PLANS[selectedPlanKey];
    const finalPrice = usePromo ? activePlan.promo : activePlan.base;

    if (selectedPlanNameEl) selectedPlanNameEl.textContent = activePlan.name;
    if (priceCurrent) animatePrice(priceCurrent, finalPrice);
    if (planInputEl) planInputEl.value = activePlan.name;
    if (priceInputEl) priceInputEl.value = String(finalPrice);

    if (priceOld) {
      if (usePromo) {
        priceOld.textContent = formatNum(activePlan.base) + ' ₽';
        priceOld.style.display = 'inline';
      } else {
        priceOld.style.display = 'none';
      }
    }

    if (selectedPlanNoteEl) {
      selectedPlanNoteEl.textContent = usePromo
        ? `Промокод ${appliedPromoCode} применен: скидка 10% зафиксирована.`
        : 'Введите партнерский промокод справа, чтобы зафиксировать скидку 10% на выбранный тариф.';
    }
  }

  function resetPromoUI() {
    appliedPromoCode = '';
    if (promoBadge) promoBadge.classList.remove('is-visible');
    updatePricingUI();
  }

  async function applyPromo(code) {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) {
      resetPromoUI();
      return '';
    }

    if (!FORM_ENDPOINT) {
      if (clean.length >= 3) {
        appliedPromoCode = clean;
        if (promoBadge) {
          promoBadge.textContent = 'Промокод ' + clean + ' активен: скидка 10%';
          promoBadge.classList.add('is-visible');
        }
        updatePricingUI();
        return clean;
      }
      resetPromoUI();
      return '';
    }

    try {
      const resp = await fetch(`${FORM_ENDPOINT}?action=promo&code=${encodeURIComponent(clean)}`);
      const data = await resp.json();
      if (data && data.valid) {
        appliedPromoCode = data.code || clean;
        if (promoBadge) {
          promoBadge.textContent = `Промокод ${appliedPromoCode} активен: скидка ${data.discount || 10}%`;
          promoBadge.classList.add('is-visible');
        }
        updatePricingUI();
        return appliedPromoCode;
      }
      resetPromoUI();
      return '';
    } catch (e) {
      resetPromoUI();
      return '';
    }
  }

  planCards.forEach(card => {
    card.addEventListener('click', (e) => {
      const key = card.dataset.plan;
      if (!PLANS[key]) return;
      selectedPlanKey = key;
      updatePricingUI();

      if (e.target.closest('[data-select-plan]')) {
        const panel = document.getElementById('bookingPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  if (savedMeta.promo && promoInput) {
    promoInput.value = savedMeta.promo.toUpperCase();
    applyPromo(savedMeta.promo);
  } else {
    updatePricingUI();
  }

  if (promoBtn && promoInput) {
    promoBtn.addEventListener('click', () => applyPromo(promoInput.value));
    promoInput.addEventListener('change', () => applyPromo(promoInput.value));
  }

  // 6. Валидация 152-ФЗ, защита от спама и отправка заявки
  const TG_DIRECT_URL = 'https://t.me/stintacademy?direct';

  function renderStatusWithTg(statusNode, message, isOk) {
    if (!statusNode) return;
    statusNode.className = 'form-status ' + (isOk ? 'is-ok' : 'is-err');
    statusNode.textContent = '';

    const textEl = document.createElement('p');
    textEl.className = 'form-status-text';
    textEl.textContent = message;

    const btnEl = document.createElement('a');
    btnEl.className = 'btn btn-ghost btn-sm form-status-cta';
    btnEl.href = TG_DIRECT_URL;
    btnEl.target = '_blank';
    btnEl.rel = 'noopener noreferrer';
    btnEl.textContent = 'Написать нам в Телеграм';

    statusNode.appendChild(textEl);
    statusNode.appendChild(btnEl);
  }

  const form = document.getElementById('leadForm');
  const statusEl = document.getElementById('formStatus');
  let lastSubmitAt = 0;

  if (form && statusEl) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.className = 'form-status';

      // Ловушка для спам-ботов
      if (form.elements.website && form.elements.website.value.trim() !== '') {
        return;
      }

      if (Date.now() - lastSubmitAt < 5000) {
        statusEl.textContent = 'Подождите пару секунд перед повторной отправкой.';
        statusEl.classList.add('is-err');
        return;
      }

      const name = form.elements.name ? form.elements.name.value.trim() : '';
      const telegram = form.elements.telegram ? form.elements.telegram.value.trim() : '';
      const promoRaw = form.elements.promo ? form.elements.promo.value.trim().toUpperCase() : '';
      const consent = form.elements.consent ? form.elements.consent.checked : true;

      if (!name || !telegram) {
        statusEl.textContent = 'Укажите имя и ник в Телеграм.';
        statusEl.classList.add('is-err');
        return;
      }

      if (!consent) {
        statusEl.textContent = 'Для отправки заявки необходимо согласие на обработку персональных данных (152-ФЗ).';
        statusEl.classList.add('is-err');
        return;
      }

      lastSubmitAt = Date.now();
      const promo = promoRaw ? await applyPromo(promoRaw) : '';
      const activePlan = PLANS[selectedPlanKey];
      const finalPrice = promo ? activePlan.promo : activePlan.base;

      const payload = {
        type: 'lead',
        name,
        telegram,
        promo: promo || promoRaw,
        plan: activePlan.name,
        plan_id: selectedPlanKey,
        price: finalPrice,
        consent_152fz: true,
        utm: savedMeta,
        created_at: new Date().toISOString()
      };

      if (!FORM_ENDPOINT) {
        console.log('Локальный тест заявки:', payload);
        statusEl.textContent = 'Заявка принята (локальный тест).';
        statusEl.classList.add('is-ok');
        form.reset();
        resetPromoUI();
        return;
      }

      try {
        const resp = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'Bad status');
        }
        renderStatusWithTg(
          statusEl,
          'Заявка отправлена. Мы свяжемся с вами в Телеграм, или вы можете написать нам первым:',
          true
        );
        if (typeof ym === 'function' && METRIKA_ID) {
          ym(METRIKA_ID, 'reachGoal', 'lead_sent');
        }
        form.reset();
        resetPromoUI();
      } catch (err) {
        renderStatusWithTg(
          statusEl,
          'Ошибка отправки. Напишите нам напрямую в Телеграм:',
          false
        );
      }
    });
  }

  // 7. Лидерборд участников (динамическая загрузка с Yandex Cloud, свернут до топ-3)
  const lbList = document.getElementById('leaderboardList');
  const lbToggle = document.getElementById('leaderboardToggle');

  if (lbList && lbToggle) {
    function renderLeaderboardEmpty() {
      lbList.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = 'Таблица обновится после старта потока';
      lbList.appendChild(empty);
      lbToggle.style.display = 'none';
    }

    function renderLeaderboardItems(items) {
      if (!Array.isArray(items) || items.length === 0) {
        renderLeaderboardEmpty();
        return;
      }

      lbList.innerHTML = '';
      lbList.classList.remove('is-expanded');

      items.forEach((item, idx) => {
        const place = idx + 1;
        const row = document.createElement('div');
        row.className = 'lb-row' + (place <= 3 ? ' is-top rank-' + place : ' is-extra');

        const rankEl = document.createElement('span');
        rankEl.className = 'lb-rank';
        rankEl.textContent = String(place);

        const nameEl = document.createElement('span');
        nameEl.className = 'lb-name';
        nameEl.textContent = String(item.name || '');

        const ptsEl = document.createElement('span');
        ptsEl.className = 'lb-pts';
        ptsEl.textContent = String(Number(item.points) || 0);

        row.appendChild(rankEl);
        row.appendChild(nameEl);
        row.appendChild(ptsEl);
        lbList.appendChild(row);
      });

      if (items.length <= 3) {
        lbToggle.style.display = 'none';
      } else {
        lbToggle.style.display = '';
        lbToggle.textContent = 'Показать весь список';
      }
    }

    lbToggle.addEventListener('click', () => {
      const expanded = lbList.classList.toggle('is-expanded');
      lbToggle.textContent = expanded ? 'Свернуть до топ-3' : 'Показать весь список';
    });

    (async () => {
      if (!FORM_ENDPOINT) {
        renderLeaderboardEmpty();
        return;
      }
      try {
        const resp = await fetch(`${FORM_ENDPOINT}?action=leaderboard`);
        if (!resp.ok) throw new Error('Bad status');
        const data = await resp.json();
        renderLeaderboardItems(data && data.items ? data.items : []);
      } catch (e) {
        renderLeaderboardEmpty();
      }
    })();
  }

  // 8. Баннер cookie
  const cookieBar = document.getElementById('cookieBar');
  const cookieAccept = document.getElementById('cookieAccept');
  if (cookieBar && cookieAccept && !localStorage.getItem('stint_cookie_ok')) {
    cookieBar.classList.add('is-visible');
    cookieAccept.addEventListener('click', () => {
      localStorage.setItem('stint_cookie_ok', '1');
      cookieBar.classList.remove('is-visible');
    });
  }

  // 9. Автотипограф: убираем все висячие предлоги, союзы и короткие местоимения
  const prepsRe = /(^|[\s\u00A0(«„"'])(а|в|и|к|о|с|у|я|бы|во|вы|до|же|за|из|ко|ли|мы|на|не|ни|но|об|он|от|по|со|то|ты|без|вне|все|где|для|еще|или|как|кто|над|она|они|под|при|про|там|тут|уже|что|это)\s+/gi;
  const numUnitRe = /(\d)\s+([а-яёa-z₽%]+)/gi;
  const numGroupRe = /(\d)\s+(\d{3})/g;
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || skipTags.has(parent.tagName)) continue;
    let text = node.nodeValue;
    if (!text || !text.trim()) continue;

    let prev;
    do {
      prev = text;
      text = text.replace(prepsRe, '$1$2\u00A0');
    } while (text !== prev);

    text = text.replace(numGroupRe, '$1\u00A0$2').replace(numUnitRe, '$1\u00A0$2');
    node.nodeValue = text;
  }

  // 9.5 Обработка партнерской формы (partners.html)
  const partnerForm = document.getElementById('partnerForm');
  const partnerStatus = document.getElementById('partnerStatus');

  if (partnerForm && partnerStatus) {
    partnerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      partnerStatus.className = 'form-status';

      if (partnerForm.elements.website && partnerForm.elements.website.value.trim() !== '') {
        return;
      }

      const name = partnerForm.elements.name ? partnerForm.elements.name.value.trim() : '';
      const channel = partnerForm.elements.channel ? partnerForm.elements.channel.value.trim() : '';
      const telegram = partnerForm.elements.telegram ? partnerForm.elements.telegram.value.trim() : '';
      const consent = partnerForm.elements.consent ? partnerForm.elements.consent.checked : true;

      if (!name || !channel || !telegram) {
        partnerStatus.textContent = 'Заполните имя, ссылку на канал и ник в Телеграм.';
        partnerStatus.classList.add('is-err');
        return;
      }

      if (!consent) {
        partnerStatus.textContent = 'Для отправки заявки необходимо согласие на обработку персональных данных (152-ФЗ).';
        partnerStatus.classList.add('is-err');
        return;
      }

      const payload = {
        type: 'partner',
        name,
        channel,
        telegram,
        consent_152fz: true,
        created_at: new Date().toISOString()
      };

      if (!FORM_ENDPOINT) {
        console.log('Локальный тест партнерской заявки:', payload);
        partnerStatus.textContent = 'Заявка принята (локальный тест).';
        partnerStatus.classList.add('is-ok');
        partnerForm.reset();
        return;
      }

      try {
        const resp = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.error) {
          throw new Error(data.error || 'Bad status');
        }
        renderStatusWithTg(
          partnerStatus,
          'Заявка отправлена. Мы свяжемся с вами в Телеграм, или вы можете написать нам первым:',
          true
        );
        if (typeof ym === 'function' && METRIKA_ID) {
          ym(METRIKA_ID, 'reachGoal', 'partner_sent');
        }
        partnerForm.reset();
      } catch (err) {
        renderStatusWithTg(
          partnerStatus,
          'Ошибка отправки. Напишите нам напрямую в Телеграм:',
          false
        );
      }
    });
  }

  // 10. Голубое свечение ближайшего контура/угла карточек под курсором мыши
  document.querySelectorAll('.card-clean').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      card.style.setProperty('--glow-op', '1');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--glow-op', '0');
    });
  });

  // Страховка появления заголовка, если прелоадера нет на странице
  if (!document.getElementById('preloader')) {
    requestAnimationFrame(() => document.body.classList.add('is-hero-ready'));
  }

  // 11. Карусель фотографий эксперта (свайп, стрелки, точки)
  const mentorCarousel = document.getElementById('mentorCarousel');
  if (mentorCarousel) {
    const track = mentorCarousel.querySelector('.mentor-carousel-track');
    const slides = mentorCarousel.querySelectorAll('.mentor-slide');
    const dots = mentorCarousel.querySelectorAll('.mentor-dot');
    const prevBtn = mentorCarousel.querySelector('.mentor-nav-btn.is-prev');
    const nextBtn = mentorCarousel.querySelector('.mentor-nav-btn.is-next');
    const viewport = mentorCarousel.querySelector('.mentor-carousel-viewport');

    let currentSlide = 0;
    const totalSlides = slides.length;

    function goToSlide(index) {
      if (!track || totalSlides === 0) return;
      currentSlide = ((index % totalSlides) + totalSlides) % totalSlides;
      track.style.transform = `translate3d(-${currentSlide * 100}%, 0, 0)`;

      dots.forEach((dot, idx) => {
        const active = idx === currentSlide;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));
    }

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const target = parseInt(dot.dataset.slide || '0', 10);
        if (!Number.isNaN(target)) goToSlide(target);
      });
    });

    if (viewport) {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchActive = false;

      viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchActive = true;
      }, { passive: true });

      viewport.addEventListener('touchend', (e) => {
        if (!touchActive || e.changedTouches.length === 0) return;
        touchActive = false;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
          goToSlide(dx < 0 ? currentSlide + 1 : currentSlide - 1);
        }
      }, { passive: true });
    }
  }
})();