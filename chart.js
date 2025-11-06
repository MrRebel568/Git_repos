// charts.js
export function randomPalette(count) {
  const base = ['#007bff','#28a745','#ffc107','#dc3545','#6610f2','#20c997','#6f42c1','#fd7e14','#6c757d'];
  if (count <= base.length) return base.slice(0,count);
  // generate extras
  const arr = [...base];
  while (arr.length < count) {
    arr.push('#' + Math.floor(Math.random()*16777215).toString(16));
  }
  return arr;
}

export function renderDoughnut(canvas, dataObj, opts = {}) {
  const labels = Object.keys(dataObj);
  const data = Object.values(dataObj);
  const colors = randomPalette(labels.length);
  if (!canvas) return;
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' }, title: { display: !!opts.title, text: opts.title || '' } }
    }
  });
}

export function renderLine(canvas, labels, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: opts.label || 'Count',
        data,
        fill: true,
        tension: 0.25,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { display: false },
        y: { beginAtZero: true }
      },
      plugins: {
        title: { display: !!opts.title, text: opts.title || '' },
        legend: { display: false }
      }
    }
  });
}
