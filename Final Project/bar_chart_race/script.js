// Chart dimensions
const width = 1250;
const height = 800;
const margin = {top: 140, right: 110, bottom: 40, left: 125};
const barSize = 48;
const duration = 250;
const n = 12; // number of bars to show

// Color scale for countries
const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD",
    "#D4A5A5", "#9B59B6", "#3498DB", "#F1C40F", "#2ECC71",
    "#E74C3C", "#1ABC9C"
];

const colorScale = d3.scaleOrdinal().range(colors);

// Create SVG
const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

// Add title
const chartTitle = svg.append("text")
    .attr("class", "title")
    .attr("x", margin.left)
    .attr("y", margin.top - 30);

// Add year label
const yearLabel = svg.append("text")
    .attr("class", "year-label")
    .attr("x", width - margin.right)
    .attr("y", height - 100 - margin.bottom)
    .attr("text-anchor", "end");

// Format number functions
const formatTotalNumber = d3.format(",.0f");
const formatPerCapitaNumber = d3.format(",.2f");

let currentYearIndex = 0;
let interval;
let currentData;
let years;

// Create scales
const x = d3.scaleLinear()
    .range([margin.left, width - margin.right]);

const y = d3.scaleBand()
    .range([margin.top, margin.top + barSize * n])
    .padding(0.2);

// Create axis
const xAxis = d3.axisBottom(x);
const yAxis = d3.axisLeft(y);

// Add axes groups
const xAxisG = svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top + barSize * n + 5})`);

const yAxisG = svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`);

function updateProgress() {
    const progress = (currentYearIndex / (years.length - 1)) * 100;
    d3.select(".progress-bar")
        .style("width", `${progress}%`)
        .attr("aria-valuenow", progress);
}

function update() {
    const yearDatum = currentData[currentYearIndex];
    yearLabel.text(yearDatum.year);
    updateProgress();

    // Update scales
    x.domain([0, d3.max(yearDatum.values, d => d.value)]);
    y.domain(d3.range(n));

    // Update axes
    xAxisG.transition()
        .duration(duration)
        .call(xAxis);

    yAxisG.transition()
        .duration(duration)
        .call(yAxis.tickFormat((d, i) => yearDatum.values[i]?.country || ''));

    // Update bars
    const bars = svg.selectAll(".bar")
        .data(yearDatum.values, d => d.country);

    // Enter bars
    bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", margin.left)
        .attr("y", (d, i) => y(i))
        .attr("width", d => x(d.value) - margin.left)
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("fill", d => colorScale(d.country));

    // Update bars
    bars.transition()
        .duration(duration)
        .attr("y", (d, i) => y(i))
        .attr("width", d => x(d.value) - margin.left)
        .attr("fill", d => colorScale(d.country));

    // Exit bars
    bars.exit()
        .transition()
        .duration(duration)
        .attr("width", 0)
        .remove();

    // Update value labels
    const valueLabels = svg.selectAll(".value-label")
        .data(yearDatum.values, d => d.country);

    const formatNumber = document.querySelector('input[name="viewType"]:checked').value === 'total' 
        ? formatTotalNumber 
        : formatPerCapitaNumber;

    // Enter value labels
    valueLabels.enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x(d.value) + 5)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .text(d => formatNumber(d.value));

    // Update value labels
    valueLabels.transition()
        .duration(duration)
        .attr("x", d => x(d.value) + 5)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .text(d => formatNumber(d.value));

    // Exit value labels
    valueLabels.exit().remove();
}

function processData(data) {
    years = Object.keys(data[0]).filter(d => !isNaN(d));
    const countries = data.map(d => d.Country);
    colorScale.domain(countries);
    
    return years.map(year => {
        return {
            year: year,
            values: data.map(d => ({
                country: d.Country,
                value: +d[year] || 0
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, n)
        };
    });
}

function updateView(viewType) {
    // Stop any ongoing animation
    if (interval) {
        clearInterval(interval);
        interval = null;
        document.getElementById("play-button").textContent = "Play";
    }

    // Update chart title
    const titleText = viewType === 'total' 
        ? "CO2 Emissions by Country (Million Tonnes)"
        : "Per Capita CO2 Emissions by Country (Tonnes per Person)";
    chartTitle.text(titleText);

    // Update number format for x-axis
    xAxis.tickFormat(viewType === 'total' ? formatTotalNumber : formatPerCapitaNumber);

    // Load appropriate dataset
    const dataFile = viewType === 'total' 
        ? "../data/Filtered_Annual_CO2_Emissions_From_1800.csv"
        : "../data/Filtered_CO2_Emissions_Per_Capita.csv";

    d3.csv(dataFile).then(data => {
        currentYearIndex = 0;
        currentData = processData(data);
        update();
    });
}

// Initialize animation controls
d3.select("#play-button").on("click", function() {
    if (interval) {
        clearInterval(interval);
        interval = null;
        this.textContent = "Play";
    } else {
        interval = setInterval(() => {
            currentYearIndex = (currentYearIndex + 1) % years.length;
            update();
        }, duration);
        this.textContent = "Pause";
    }
});

d3.select("#reset-button").on("click", function() {
    currentYearIndex = 0;
    update();
    if (interval) {
        clearInterval(interval);
        interval = null;
        d3.select("#play-button").text("Play");
    }
});

// Add view type change handler
document.querySelectorAll('input[name="viewType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        updateView(e.target.value);
    });
});

// Initial render with total emissions
updateView('total');