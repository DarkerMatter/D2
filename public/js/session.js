document.addEventListener('DOMContentLoaded', () => {
  // --- rage slider. 1 to 10. if you need higher than 10 you have bigger problems ---
  const rageSlider = document.getElementById('rageSlider');
  const rageValue = document.getElementById('rageValue');
  const hiddenInput = document.querySelector('input[name="rageLevel"]');

  if (rageSlider) {
    rageSlider.addEventListener('input', () => {
      rageValue.textContent = rageSlider.value;
      hiddenInput.value = rageSlider.value;
    });
  }

  // --- quick phrases so you don't have to type the same swear word every single time ---
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
