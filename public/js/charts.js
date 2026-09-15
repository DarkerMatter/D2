document.addEventListener('DOMContentLoaded', () => {
  // --- Rage Progression Chart ---
  const generateBtn = document.getElementById('generateChartBtn');
  const canvas = document.getElementById('rageProgressionChart');
  if (generateBtn && canvas) {
    const ctx = canvas.getContext('2d');
    let chart = null;

    const renderChart = (chartData) => {
      if (chart) chart.destroy();
      if (!chartData || chartData.length === 0) {
        canvas.style.display = 'none';
        const msg = document.createElement('p');
        msg.textContent = 'No data to display. Go log some deaths!';
        msg.style.color = 'var(--text-secondary)';
        canvas.parentNode.insertBefore(msg, canvas.nextSibling);
        return;
      }
      canvas.style.display = 'block';
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.map((d) => `Death #${d.death_number}`),
          datasets: [
            {
              label: 'Average Rage Level',
              data: chartData.map((d) => d.average_rage),
              fill: true,
              backgroundColor: 'rgba(220, 53, 69, 0.2)',
              borderColor: 'rgba(220, 53, 69, 1)',
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 10,
              grid: { color: 'rgba(255,255,255,0.1)' },
              ticks: { color: '#888' },
            },
            x: {
              grid: { color: 'rgba(255,255,255,0.1)' },
              ticks: { color: '#888' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#000',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#333',
              borderWidth: 1,
            },
          },
        },
      });
    };

    generateBtn.addEventListener('click', async () => {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      try {
        const res = await fetch('/account/analytics/rage-progression');
        if (!res.ok) throw new Error(res.status);
        renderChart(await res.json());
      } catch (err) {
        console.error('Chart fetch failed:', err);
        generateBtn.textContent = 'Failed. Try Again.';
      } finally {
        if (generateBtn.textContent.includes('Generating'))
          generateBtn.style.display = 'none';
        else generateBtn.disabled = false;
      }
    });
  }

  // --- Swear Word Chart ---
  const swearBtn = document.getElementById('generateSwearChartBtn');
  const swearCanvas = document.getElementById('swearWordChart');
  if (swearBtn && swearCanvas) {
    const swearCtx = swearCanvas.getContext('2d');
    let swearChart = null;

    const renderSwearChart = (chartData) => {
      if (swearChart) swearChart.destroy();
      if (!chartData || chartData.length === 0) {
        swearCanvas.style.display = 'none';
        const msg = document.createElement('p');
        msg.textContent = 'No data to display. Time to get tilted!';
        msg.style.color = 'var(--text-secondary)';
        swearCanvas.parentNode.insertBefore(msg, swearCanvas.nextSibling);
        return;
      }
      swearCanvas.style.display = 'block';
      swearChart = new Chart(swearCtx, {
        type: 'bar',
        data: {
          labels: chartData.map((d) => d.name),
          datasets: [
            {
              label: 'Usage Count',
              data: chartData.map((d) => d.count),
              backgroundColor: [
                'rgba(220, 53, 69, 0.7)',
                'rgba(245, 166, 35, 0.7)',
                'rgba(0, 112, 243, 0.7)',
                'rgba(25, 135, 84, 0.7)',
                'rgba(108, 117, 125, 0.7)',
              ],
              borderColor: [
                'rgba(220, 53, 69, 1)',
                'rgba(245, 166, 35, 1)',
                'rgba(0, 112, 243, 1)',
                'rgba(25, 135, 84, 1)',
                'rgba(108, 117, 125, 1)',
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.1)' },
              ticks: { color: '#888', precision: 0 },
            },
            y: { grid: { display: false }, ticks: { color: '#888' } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#000',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#333',
              borderWidth: 1,
            },
          },
        },
      });
    };

    swearBtn.addEventListener('click', async () => {
      swearBtn.disabled = true;
      swearBtn.textContent = 'Analyzing...';
      try {
        const res = await fetch('/account/analytics/swear-words');
        if (!res.ok) throw new Error(res.status);
        renderSwearChart(await res.json());
      } catch (err) {
        console.error('Swear chart fetch failed:', err);
        swearBtn.textContent = 'Failed. Try Again.';
      } finally {
        if (swearBtn.textContent.includes('Analyzing'))
          swearBtn.style.display = 'none';
        else swearBtn.disabled = false;
      }
    });
  }

  // --- Copy to Clipboard ---
  document.querySelectorAll('.btn-copy').forEach((button) => {
    button.addEventListener('click', () => {
      const code = button.dataset.code;
      navigator.clipboard
        .writeText(code)
        .then(() => {
          button.textContent = 'Copied!';
          setTimeout(() => (button.textContent = 'Copy'), 2000);
        })
        .catch(() => alert('Failed to copy code.'));
    });
  });
});
