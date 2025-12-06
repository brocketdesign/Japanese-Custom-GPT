
window.fetchAndShowImageInfo = async function(imageId) {
    const modalEl = document.getElementById(`modal-${imageId}`);
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl);
    const modalBody = modalEl.querySelector('.modal-body');

    // Loading
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" style="width: 2.5rem; height: 2.5rem;"></div>
            <p class="mt-3 text-muted small">Loading details...</p>
        </div>`;

    modal.show();

    try {
        const res = await fetch(`/gallery/${imageId}/info`);
        if (!res.ok) throw new Error('Network error');
        const { success, data } = await res.json();
        if (!success || !data) throw new Error('No data received');

        const { image, request, chat } = data;

        modalBody.innerHTML = `
<div class="p-3">

  <!-- Title + Chat Info -->
  <div class="text-center mb-4">
    <h6 class="fw-bold text-primary mb-2">
      ${image.title?.en || image.title?.ja || image.title?.fr || 'Untitled'}
    </h6>
    <div class="small text-muted">
      <i class="bi bi-chat-dots-fill me-1"></i><strong>${chat.name}</strong>
      <span class="mx-1">•</span>
      ${new Date(image.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </div>
  </div>

  <hr class="border-secondary opacity-25">

  <!-- Prompt -->
  <div class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold text-success mb-0">Prompt</h6>
      <button class="btn btn-sm btn-outline-success rounded-pill copy-btn" data-clipboard="${(image.prompt || '').replace(/"/g, '&quot;')}">
        <i class="bi bi-clipboard"></i>
      </button>
    </div>
    <p class="small text-body mb-0 lh-lg text-break bg-light rounded-3 p-3">
      ${image.prompt || '<em class="text-muted">No prompt recorded</em>'}
    </p>
  </div>

  <!-- Negative Prompt -->
  -->
  ${request.negative_prompt ? `
  <div class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold text-danger mb-0">Negative Prompt</h6>
      <button class="btn btn-sm btn-outline-danger rounded-pill copy-btn" data-clipboard="${request.negative_prompt.replace(/"/g, '&quot;')}">
        <i class="bi bi-clipboard-x"></i>
      </button>
    </div>
    <p class="small text-body mb-0 lh-lg text-break bg-light rounded-3 p-3">
      ${request.negative_prompt}
    </p>
  </div>` : ''}

  <!-- Quick Metadata Grid -->
  <div class="row g-2 text-center mb-4">
    <div class="col-6">
      <div class="bg-primary text-white rounded-3 py-2 small fw-bold">
        Ratio<br><strong>${image.aspectRatio}</strong>
      </div>
    </div>
    <div class="col-6">
      <div class="bg-info text-dark rounded-3 py-2 small fw-bold">
        Seed<br><strong>${image.seed}</strong>
      </div>
    </div>
    <div class="col-6">
      <div class="bg-${image.nsfw ? 'danger' : 'success'} text-white rounded-3 py-2 small fw-bold">
        ${image.nsfw ? 'NSFW' : 'SFW'}
      </div>
    </div>
    <div class="col-6">
      <div class="bg-secondary text-white rounded-3 py-2 small fw-bold">
        ${chat.language.toUpperCase()}
      </div>
    </div>
  </div>

  <!-- Extra Flags -->
  <div class="d-flex flex-wrap gap-2 justify-content-center mb-3">
    ${image.isMerged ? '<span class="badge bg-warning text-dark">Merged</span>' : ''}
    ${request.blur ? '<span class="badge bg-secondary">Blur</span>' : ''}
    ${request.chatCreation ? '<span class="badge bg-teal text-white">Chat Created</span>' : ''}
  </div>

  <!-- Technical Info -->
  <div class="small text-muted">
    <div><strong>ID:</strong> <code class="text-primary">${image._id}</code></div>
    <div><strong>Slug:</strong> ${image.slug}</div>
    <div><strong>Chat:</strong> ${chat.slug}</div>
  </div>

</div>`;

        // Copy to clipboard with visual feedback
        modalBody.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(btn.dataset.clipboard || '');
                    const icon = btn.querySelector('i');
                    const origClass = icon.classList.value;
                    icon.className = 'bi bi-check2-all';
                    btn.classList.remove('btn-outline-success', 'btn-outline-danger');
                    btn.classList.add('btn-success');
                    setTimeout(() => {
                        icon.className = origClass;
                        btn.classList.remove('btn-success');
                        btn.classList.add(btn.dataset.clipboard.includes('Negative') ? 'btn-outline-danger' : 'btn-outline-success');
                    }, 2000);
                } catch (e) {
                    btn.innerHTML = '<i class="bi bi-x"></i>';
                }
            });
        });

    } catch (err) {
        modalBody.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle-fill fs-3"></i>
                <p class="mt-2">Failed to load info</p>
                <small>${err.message}</small>
            </div>`;
        console.error('Image info error:', err);
    }
};