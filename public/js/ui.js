// --- Page Loader ---
window.addEventListener('load', () => {
  const loader = document.querySelector('.loader-wrapper');
  if (loader) {
    loader.classList.add('fade-out');
    document.body.classList.remove('loading');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // --- Re-activate loader on heavy-page navigations ---
  const loader = document.querySelector('.loader-wrapper');
  const loadingLinks = document.querySelectorAll(
    'a[href="/dashboard"], a[href="/account"], a[href="/admin"]'
  );
  loadingLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.which === 2) return;
      if (loader) {
        document.body.classList.add('loading');
        loader.classList.remove('fade-out');
      }
    });
  });

  // --- Confirmation Modal ---
  const modal = document.getElementById('confirmation-modal');
  if (modal) {
    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    let formToSubmit = null;

    document.querySelectorAll('form[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        formToSubmit = e.target;
        modalTitle.textContent =
          form.dataset.confirmTitle || 'Confirmation Required';
        modalBody.textContent = form.dataset.confirm;
        modal.classList.remove('hidden');
      });
    });

    const hideModal = () => {
      modal.classList.add('hidden');
      formToSubmit = null;
    };

    confirmBtn.addEventListener('click', () => {
      if (formToSubmit) formToSubmit.submit();
    });
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  // --- Toast Notifications ---
  const toastContainer = document.getElementById('toast-container');
  if (toastContainer) {
    const showToast = (toastData) => {
      const toast = document.createElement('div');
      toast.className = `toast-notification toast-${toastData.type}`;

      const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        achievement: toastData.icon || 'bi-trophy-fill',
      };
      const titles = {
        success: 'Success',
        error: 'Error',
        achievement: 'Achievement Unlocked!',
      };

      const message =
        toastData.type === 'achievement' ? toastData.name : toastData.message;

      const iconEl = document.createElement('div');
      iconEl.className = 'toast-icon';
      const iconI = document.createElement('i');
      iconI.className = `bi ${icons[toastData.type]}`;
      iconEl.appendChild(iconI);

      const contentEl = document.createElement('div');
      contentEl.className = 'toast-content';

      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = titles[toastData.type];
      contentEl.appendChild(titleEl);

      const msgEl = document.createElement('div');
      msgEl.className = 'toast-message';
      msgEl.textContent = message;
      contentEl.appendChild(msgEl);

      if (toastData.type === 'achievement' && toastData.description) {
        const descEl = document.createElement('div');
        descEl.className = 'toast-description';
        descEl.textContent = toastData.description;
        contentEl.appendChild(descEl);
      }

      toast.appendChild(iconEl);
      toast.appendChild(contentEl);
      toastContainer.appendChild(toast);

      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
      }, 5000);
    };

    const flashData = toastContainer.dataset.flash;
    if (flashData) {
      try {
        const toasts = JSON.parse(flashData);
        toasts.forEach(showToast);
      } catch (e) {
        console.error('Failed to parse flash data:', e);
      }
    }
  }

  // --- Timestamp Formatting ---
  document.querySelectorAll('[data-timestamp]').forEach((el) => {
    const ts = el.getAttribute('data-timestamp');
    if (ts) el.textContent = new Date(ts).toLocaleString();
  });
});
