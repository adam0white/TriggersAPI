// ===============================================
// Enhanced Metrics Charts Logic
// ===============================================

let chartsState = {
  timeRange: localStorage.getItem('metricsTimeRange') || 'last-hour',
  paused: false,
  interval: null,
  charts: {},
  previousData: {} // For calculating trends
};

/**
 * Set time range and fetch new data
 */
function setTimeRange(range) {
  chartsState.timeRange = range;
  localStorage.setItem('metricsTimeRange', range);

  // Update UI
  document.querySelectorAll('.time-range-btn').forEach(btn => {
    if (btn.dataset.range === range) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Fetch new data
  fetchMetricsHistory();
}

/**
 * Toggle charts pause/resume
 */
function toggleChartsPause() {
  chartsState.paused = !chartsState.paused;
  const pauseBtn = document.getElementById('chartsPauseBtn');

  if (chartsState.paused) {
    pauseBtn.textContent = 'Resume Auto-refresh';
    pauseBtn.classList.add('paused');
    stopChartsAutoRefresh();
  } else {
    pauseBtn.textContent = 'Pause Auto-refresh';
    pauseBtn.classList.remove('paused');
    startChartsAutoRefresh();
  }
}

/**
 * Fetch metrics history from API
 */
async function fetchMetricsHistory() {
  try {
    const res = await fetch(`/api/metrics/history?time_range=${chartsState.timeRange}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // Show charts if hidden
    document.getElementById('enhancedChartsContent').style.display = 'block';

    // Update all charts
    updateLatencyChart(data.historical);
    updateErrorRateChart(data.historical);
    updateThroughputChart(data.historical);
    updateErrorBreakdownChart(data.error_breakdown);
    updateQueueDepthChart(data.current);

    // Update metric cards with trends
    updateMetricCardsWithTrends(data.current);

    // Store current data for next trend calculation
    chartsState.previousData = data.current;

    // Update last update timestamp
    const now = new Date();
    document.getElementById('chartsLastUpdate').textContent =
      'Updated: ' + now.toLocaleTimeString();

  } catch (error) {
    console.error('Failed to fetch metrics history:', error);
  }
}

/**
 * Update latency percentiles line chart
 */
function updateLatencyChart(historical) {
  const ctx = document.getElementById('latencyChart').getContext('2d');

  // Prepare data
  const labels = historical.map(d => formatChartTime(d.timestamp));
  const p50Data = historical.map(d => d.latency_p50 || 0);
  const p95Data = historical.map(d => d.latency_p95 || 0);
  const p99Data = historical.map(d => d.latency_p99 || 0);

  // Destroy existing chart
  if (chartsState.charts.latency) {
    chartsState.charts.latency.destroy();
  }

  // Create new chart
  chartsState.charts.latency = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'P50',
          data: p50Data,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'P95',
          data: p95Data,
          borderColor: '#eab308',
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'P99',
          data: p99Data,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 5
        },
        {
          label: 'Target (100ms)',
          data: Array(labels.length).fill(100),
          borderColor: '#888',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + 'ms';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Latency (ms)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      }
    }
  });
}

/**
 * Update error rate area chart
 */
function updateErrorRateChart(historical) {
  const ctx = document.getElementById('errorRateChart').getContext('2d');

  // Prepare data
  const labels = historical.map(d => formatChartTime(d.timestamp));
  const errorRates = historical.map(d => d.error_rate || 0);

  // Destroy existing chart
  if (chartsState.charts.errorRate) {
    chartsState.charts.errorRate.destroy();
  }

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
  gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
  gradient.addColorStop(0.5, 'rgba(234, 179, 8, 0.4)');
  gradient.addColorStop(1, 'rgba(34, 197, 94, 0.4)');

  // Create new chart
  chartsState.charts.errorRate = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Error Rate',
          data: errorRates,
          borderColor: '#ef4444',
          backgroundColor: gradient,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Error Rate: ' + context.parsed.y.toFixed(2) + '%';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          title: {
            display: true,
            text: 'Error Rate (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      }
    }
  });
}

/**
 * Update throughput bar chart
 */
function updateThroughputChart(historical) {
  const ctx = document.getElementById('throughputChart').getContext('2d');

  // Prepare data
  const labels = historical.map(d => formatChartTime(d.timestamp));
  const throughputData = historical.map(d => d.throughput_rps || 0);

  // Destroy existing chart
  if (chartsState.charts.throughput) {
    chartsState.charts.throughput.destroy();
  }

  // Create new chart
  chartsState.charts.throughput = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Requests/sec',
          data: throughputData,
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Throughput: ' + context.parsed.y.toFixed(2) + ' req/s';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Requests per Second'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      }
    }
  });
}

/**
 * Update error breakdown donut chart
 */
function updateErrorBreakdownChart(errorBreakdown) {
  const ctx = document.getElementById('errorBreakdownChart').getContext('2d');

  // Prepare data
  const data = [
    errorBreakdown.validation || 0,
    errorBreakdown.auth || 0,
    errorBreakdown.not_found || 0,
    errorBreakdown.conflict || 0,
    errorBreakdown.server || 0
  ];

  const labels = ['Validation', 'Auth', 'Not Found', 'Conflict', 'Server'];
  const colors = ['#f97316', '#ff6b6b', '#4f46e5', '#fbbf24', '#ef4444'];

  // Destroy existing chart
  if (chartsState.charts.errorBreakdown) {
    chartsState.charts.errorBreakdown.destroy();
  }

  // Create new chart
  chartsState.charts.errorBreakdown = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return label + ': ' + value + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

/**
 * Update queue depth gauge chart
 */
function updateQueueDepthChart(currentMetrics) {
  const ctx = document.getElementById('queueDepthChart').getContext('2d');

  const queueDepth = currentMetrics.queue_depth || 0;
  const maxDepth = Math.max(queueDepth * 1.5, 200); // Auto-scale

  // Determine color based on thresholds
  let color = '#22c55e'; // Green
  if (queueDepth > 150) color = '#ef4444'; // Red
  else if (queueDepth > 50) color = '#eab308'; // Yellow

  // Destroy existing chart
  if (chartsState.charts.queueDepth) {
    chartsState.charts.queueDepth.destroy();
  }

  // Create new chart (using doughnut as gauge)
  chartsState.charts.queueDepth = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Current', 'Available'],
      datasets: [
        {
          data: [queueDepth, maxDepth - queueDepth],
          backgroundColor: [color, '#e5e7eb'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.dataIndex === 0) {
                return 'Queue Depth: ' + context.parsed;
              }
              return null;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'gaugeText',
      afterDraw: function(chart) {
        const ctx = chart.ctx;
        const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
        const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;

        ctx.save();
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(queueDepth, centerX, centerY + 20);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('events', centerX, centerY + 50);
        ctx.restore();
      }
    }]
  });
}

/**
 * Update metric cards with trend indicators
 */
function updateMetricCardsWithTrends(current) {
  // Get previous data for comparison
  const previous = chartsState.previousData;

  // Update success rate with trend
  const successRate = current.success_rate || 0;
  const prevSuccessRate = previous.success_rate || successRate;
  const successTrend = calculateTrend(successRate, prevSuccessRate, true);

  // Update latency with trend
  const latencyP95 = current.latency_p95 || 0;
  const prevLatencyP95 = previous.latency_p95 || latencyP95;
  const latencyTrend = calculateTrend(latencyP95, prevLatencyP95, false);

  // Update queue depth with trend
  const queueDepth = current.queue_depth || 0;
  const prevQueueDepth = previous.queue_depth || queueDepth;
  const queueTrend = calculateTrend(queueDepth, prevQueueDepth, false);

  // Add trend indicators to cards (if elements exist)
  addTrendToCard('metricTotalEvents', current.total_events || 0, null);
}

/**
 * Calculate trend (arrow and percentage)
 */
function calculateTrend(current, previous, higherIsBetter) {
  if (previous === 0 || previous === current) {
    return { arrow: '→', class: 'stable', percentage: '0%' };
  }

  const diff = current - previous;
  const percentage = Math.abs((diff / previous) * 100).toFixed(1);

  if (diff > 0) {
    return {
      arrow: '↑',
      class: higherIsBetter ? 'down' : 'up',
      percentage: '+' + percentage + '%'
    };
  } else {
    return {
      arrow: '↓',
      class: higherIsBetter ? 'up' : 'down',
      percentage: '-' + percentage + '%'
    };
  }
}

/**
 * Add trend indicator to metric card
 */
function addTrendToCard(cardId, value, trend) {
  const card = document.getElementById(cardId);
  if (!card) return;

  // Remove existing trend if present
  const existingTrend = card.parentElement.querySelector('.metric-trend');
  if (existingTrend) {
    existingTrend.remove();
  }

  // Add new trend if provided
  if (trend) {
    const trendDiv = document.createElement('div');
    trendDiv.className = 'metric-trend';
    trendDiv.innerHTML = `
      <span class="trend-arrow ${trend.class}">${trend.arrow}</span>
      <span class="trend-percentage">${trend.percentage}</span>
    `;
    card.parentElement.appendChild(trendDiv);
  }
}

/**
 * Format timestamp for chart labels
 */
function formatChartTime(isoString) {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Start auto-refresh for charts
 */
function startChartsAutoRefresh() {
  if (chartsState.interval) {
    clearInterval(chartsState.interval);
  }

  fetchMetricsHistory();
  chartsState.interval = setInterval(fetchMetricsHistory, 30000); // 30 seconds
}

/**
 * Stop auto-refresh for charts
 */
function stopChartsAutoRefresh() {
  if (chartsState.interval) {
    clearInterval(chartsState.interval);
    chartsState.interval = null;
  }
}

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', function() {
  // Set initial time range from localStorage
  const savedRange = localStorage.getItem('metricsTimeRange') || 'last-hour';
  setTimeRange(savedRange);

  // Start auto-refresh
  startChartsAutoRefresh();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
  stopChartsAutoRefresh();
});

// Pause/resume charts when page visibility changes
document.addEventListener('visibilitychange', function() {
  if (document.hidden && !chartsState.paused) {
    stopChartsAutoRefresh();
  } else if (!document.hidden && !chartsState.paused) {
    startChartsAutoRefresh();
  }
});
