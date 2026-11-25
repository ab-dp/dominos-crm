// הדמיה v3: תפריט צד וסרגל תחתון משותפים. data-active על <body> קובע את הפריט הפעיל.
(function () {
  const groups = [
    ['עבודה יומית', [
      ['today', 'house', 'היום', '9'],
      ['orders', 'clipboard-list', 'הזמנות'],
      ['ops', 'truck', 'סיכום לתפעול'],
      ['tasks', 'list-checks', 'משימות וחריגים', '4', true],
    ]],
    ['לקוחות ומכירות', [
      ['customers', 'building-2', 'לקוחות'],
      ['quotes', 'file-text', 'הצעות מחיר', '2', true],
      ['leads', 'target', 'לקוחות פוטנציאליים', '3'],
    ]],
    ['קטלוג', [
      ['menu', 'book-open', 'תפריט ומחירונים'],
      ['branches', 'store', 'סניפים ואשכולות'],
    ]],
    ['ניהול', [
      ['board', 'layout-dashboard', 'בורד'],
      ['reports', 'chart-column', 'דוחות'],
      ['settings', 'settings', 'הגדרות'],
    ]],
  ];
  // סימן אריח דומינו (כחול ואדום, נקודות לבנות) – המקום היחיד של האדום מלבד מונה קריטי
  const logo = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
    <g transform="rotate(-45 13 13)"><rect x="7" y="1" width="12" height="12" rx="2" fill="#E31837"/><rect x="7" y="13" width="12" height="12" rx="2" fill="#006491"/>
    <circle cx="13" cy="7" r="1.8" fill="#fff"/><circle cx="10.5" cy="19" r="1.8" fill="#fff"/><circle cx="15.5" cy="19" r="1.8" fill="#fff"/></g></svg>`;
  const active = document.body.dataset.active;
  const nav = groups.map(([g, items]) =>
    `<div class="rail__group">${g}</div>` + items.map(([id, ic, label, n, crit]) =>
      `<a href="#" class="nav${id === active ? ' nav--on' : ''}"${id === active ? ' aria-current="page"' : ''}><i data-lucide="${ic}" class="i i-lg"></i>${label}${n ? `<span class="nav__count${crit ? ' nav__count--crit' : ''}">${n}</span>` : ''}</a>`).join('')).join('');
  const rail = document.querySelector('.rail');
  if (rail) rail.innerHTML = `<div class="rail__in"><div class="rail__logo">${logo}<bdi dir="ltr">Domino's <span>CRM</span></bdi></div><nav aria-label="ראשי">${nav}</nav>
    <div class="rail__foot"><span class="person">ד</span><div><b>דנה לוי</b><span style="color:var(--navy-muted);font-size:12px">מנהלת מערכת</span></div><button class="icon-btn" aria-label="יציאה" style="margin-inline-start:auto;color:var(--navy-muted)"><i data-lucide="log-out" class="i"></i></button></div></div>`;
  const bb = document.querySelector('.bottombar');
  if (bb) bb.innerHTML = [['today', 'house', 'היום'], ['orders', 'clipboard-list', 'הזמנות'], ['customers', 'building-2', 'לקוחות'], ['quotes', 'file-text', 'הצעות'], ['more', 'menu', 'עוד']]
    .map(([id, ic, l]) => `<a href="#" class="${id === active ? 'on' : ''}"><i data-lucide="${ic}" class="i i-lg"></i>${l}</a>`).join('');
  const run = () => window.lucide && window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
