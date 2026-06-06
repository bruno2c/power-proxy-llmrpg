// =============================================================================
// charts.js — SVG Analytics Chart Generation
// =============================================================================
// Renders cash/burn and prototype progress analytics as inline SVG.
// Shared axis/grid/tick logic is extracted into a private factory function
// to eliminate duplication between the two chart types.
// =============================================================================

// ---------------------------------------------------------------------------
// Private shared chart factory
// Builds the SVG string for a generic X/Y line chart.
//
// config shape:
//   history       — array of { week, ...values }
//   series        — array of { key, cssClass, dotClass, label, color }
//   yLabel        — function(val) => string (y-axis label formatter)
//   yPad          — { minFn, maxFn } — functions to compute padded y range
//   legendItems   — array of { color, dashed, label }
// ---------------------------------------------------------------------------
function _buildChartSvg(config) {
    const { history, series, yLabel, yPad, legendItems } = config;

    // --- X axis ---
    const weeks = history.map(h => h.week);
    const minWeek = Math.min(...weeks, 1);
    const maxWeek = Math.max(...weeks, minWeek + 1);

    let xTicks = [];
    const weekRange = maxWeek - minWeek;
    if (weekRange <= 10) {
        for (let w = minWeek; w <= maxWeek; w++) xTicks.push(w);
    } else {
        let step = Math.ceil(weekRange / 8);
        if (step > 2 && step < 5) step = 5;
        else if (step > 5 && step < 10) step = 10;
        for (let w = minWeek; w <= maxWeek; w += step) xTicks.push(w);
        if (xTicks[xTicks.length - 1] !== maxWeek) xTicks.push(maxWeek);
    }

    // --- Y axis ---
    const allValues = series.flatMap(s => history.map(h => h[s.key] || 0));
    const minY = yPad.minFn(allValues);
    const maxY = yPad.maxFn(allValues);
    const ySteps = series.length > 1 ? 4 : 5;

    let yTicks = [];
    for (let i = 0; i <= ySteps; i++) {
        yTicks.push(minY + (i / ySteps) * (maxY - minY));
    }

    // --- Grid lines ---
    let yGridLines = "", yLabels = "";
    yTicks.forEach(tickVal => {
        const y = 210 - ((tickVal - minY) / (maxY - minY || 1)) * 190;
        yGridLines += `<line x1="65" y1="${y}" x2="480" y2="${y}" class="chart-grid-line" />`;
        yLabels += `<text x="55" y="${y + 4}" text-anchor="end" class="chart-axis-text">${yLabel(tickVal)}</text>`;
    });

    let xGridLines = "", xLabels = "";
    xTicks.forEach(w => {
        const x = 65 + (maxWeek === minWeek ? 0.5 : (w - minWeek) / (maxWeek - minWeek)) * 415;
        xGridLines += `<line x1="${x}" y1="20" x2="${x}" y2="210" class="chart-grid-line" />`;
        xLabels += `<text x="${x}" y="225" text-anchor="middle" class="chart-axis-text">W${w}</text>`;
    });

    // --- Data paths & dots ---
    let paths = "", dots = "";
    series.forEach(s => {
        if (history.length > 1) {
            const points = history.map(h => {
                const x = 65 + (h.week - minWeek) / (maxWeek - minWeek) * 415;
                const y = 210 - (((h[s.key] || 0) - minY) / (maxY - minY || 1)) * 190;
                return `${x},${y}`;
            });
            paths += `<path d="M ${points.join(' L ')}" class="${s.cssClass}" />`;
        }

        history.forEach(h => {
            const x = 65 + (maxWeek === minWeek ? 0.5 : (h.week - minWeek) / (maxWeek - minWeek)) * 415;
            const y = 210 - (((h[s.key] || 0) - minY) / (maxY - minY || 1)) * 190;
            dots += `
                <circle cx="${x}" cy="${y}" r="${s.dotRadius || 4}" class="${s.dotClass}">
                    <title>${s.tooltip(h)}</title>
                </circle>`;
        });
    });

    // --- Legend ---
    const legendHtml = legendItems.map(item => {
        const boxStyle = item.dashed
            ? `background-color: transparent; border: none; border-bottom: 2px dashed ${item.color}; height: 0; width: 14px; margin-top: 4px;`
            : `background-color: ${item.color};`;
        return `
            <div class="legend-item">
                <div class="legend-color-box" style="${boxStyle}"></div>
                <span>${item.label}</span>
            </div>`;
    }).join("");

    return `
        <svg viewBox="0 0 500 250" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            ${yGridLines}
            ${xGridLines}
            <line x1="65" y1="210" x2="480" y2="210" class="chart-axis-line" />
            <line x1="65" y1="20" x2="65" y2="210" class="chart-axis-line" />
            ${yLabels}
            ${xLabels}
            ${paths}
            ${dots}
        </svg>
        <div class="chart-legend">${legendHtml}</div>
    `;
}

// ---------------------------------------------------------------------------
// Public: render analytics tab
// ---------------------------------------------------------------------------
window.renderAnalyticsView = function() {
    const cashContainer = document.getElementById("cash-chart-container");
    const burnContainer = document.getElementById("burn-chart-container");
    if (!cashContainer || !burnContainer) return;

    const history = window.state ? (window.state.history || []) : [];
    if (history.length === 0) {
        cashContainer.innerHTML = `<div class="chart-fallback">Record weekly updates to plot analytics.</div>`;
        burnContainer.innerHTML = `<div class="chart-fallback">Record weekly updates to plot analytics.</div>`;
        return;
    }

    cashContainer.innerHTML = window.generateCashChartSvg(history);
    burnContainer.innerHTML = window.generateBurnChartSvg(history);
};

// ---------------------------------------------------------------------------
// Capital Trend chart
// ---------------------------------------------------------------------------
window.generateCashChartSvg = function(history) {
    function formatCashLabel(val) {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        if (val <= -1000000) return `-$${(Math.abs(val) / 1000000).toFixed(1)}M`;
        if (val <= -1000) return `-$${(Math.abs(val) / 1000).toFixed(0)}k`;
        return `$${val}`;
    }

    return _buildChartSvg({
        history,
        series: [
            {
                key: "cash",
                cssClass: "chart-path-cash",
                dotClass: "chart-dot-cash",
                dotRadius: 4,
                tooltip: h => `Week ${h.week}: Capital $${(h.cash || 0).toLocaleString()}`
            }
        ],
        yLabel: formatCashLabel,
        yPad: {
            minFn: vals => {
                const m = Math.min(...vals, 0);
                return m < 0 ? Math.floor(m * 1.1 / 10000) * 10000 : 0;
            },
            maxFn: vals => Math.ceil(Math.max(...vals, 10000) * 1.1 / 10000) * 10000
        },
        legendItems: [
            { color: "var(--comic-amber)", label: "Capital" }
        ]
    });
};

// ---------------------------------------------------------------------------
// Burn Rate Trend chart
// ---------------------------------------------------------------------------
window.generateBurnChartSvg = function(history) {
    function formatBurnLabel(val) {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    }

    return _buildChartSvg({
        history,
        series: [
            {
                key: "burn",
                cssClass: "chart-path-burn",
                dotClass: "chart-dot-burn",
                dotRadius: 4,
                tooltip: h => `Week ${h.week}: Burn Rate $${(h.burn || 0).toLocaleString()}`
            }
        ],
        yLabel: formatBurnLabel,
        yPad: {
            minFn: () => 0,
            maxFn: vals => Math.ceil(Math.max(...vals, 4000) * 1.1 / 2000) * 2000
        },
        legendItems: [
            { color: "var(--comic-red)", label: "Burn Rate", dashed: true }
        ]
    });
};
