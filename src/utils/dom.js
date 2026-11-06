export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Event delegation: ouve eventos no container, filtra por selector.
 */
export function delegate(container, selector, eventType, handler, options) {
  container.addEventListener(eventType, e => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) {
      handler(e, target);
    }
  }, options);
}

/**
 * Efeito ripple em elementos com position: relative.
 */
export function createRipple(e, element) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  element.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

export function show(el) {
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

export function hide(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

/**
 * Substitui o conteúdo de um elemento e re-inicializa ícones Lucide no escopo.
 */
export function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
  if (window.lucide) {
    lucide.createIcons({ nodes: [el] });
  }
}

/**
 * Substitui um elemento no DOM por novo HTML (útil para patches cirúrgicos).
 */
export function sectionHideBtn(id, hiddenSections) {
  const hidden = (hiddenSections ?? []).includes(id);
  return `<button data-action="toggle-section" data-section="${id}"
                  class="w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-all active:scale-90">
    <i data-lucide="${hidden ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i>
  </button>`;
}

export function replaceElement(el, newHtml) {
  if (!el) return null;
  const temp = document.createElement('div');
  temp.innerHTML = newHtml.trim();
  const newEl = temp.firstElementChild;
  el.parentNode.replaceChild(newEl, el);
  if (window.lucide) {
    lucide.createIcons({ nodes: [newEl] });
  }
  return newEl;
}
