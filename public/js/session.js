document.addEventListener('DOMContentLoaded', () => {
  // --- Rage Slider ---
  const rageSlider = document.getElementById('rageSlider');
  const rageValue = document.getElementById('rageValue');
  const hiddenInput = document.querySelector('input[name="rageLevel"]');

  if (rageSlider) {
    rageSlider.addEventListener('input', () => {
      rageValue.textContent = rageSlider.value;
      hiddenInput.value = rageSlider.value;
    });
  }

  // --- Quick Phrase Selection ---
  const phraseButtons = document.querySelectorAll('.quick-phrase');
  const phraseInput = document.getElementById('ragePhraseInput');

  if (phraseButtons.length > 0 && phraseInput) {
    phraseButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        phraseInput.value = btn.textContent;
        phraseButtons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    phraseInput.addEventListener('input', () => {
      phraseButtons.forEach((b) => b.classList.remove('selected'));
    });
  }
});
