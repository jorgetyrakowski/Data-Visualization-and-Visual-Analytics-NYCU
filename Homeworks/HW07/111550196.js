// Data source path
const data_path = "air-pollution.csv";

// Color schemes for each pollutant (4 intensity levels)
const colorSchemes = {
    'SO2':   ['#fff5f0', '#fdcab5', '#fc8d59', '#b30000'],  // Red scale
    'NO2':   ['#f7fbff', '#c8ddf0', '#73b3d8', '#08306b'],  // Blue scale
    'O3':    ['#f7fcf5', '#c7e9c0', '#74c476', '#006d2c'],  // Green scale
    'CO':    ['#fff5eb', '#fdd0a2', '#fdae6b', '#a63603'],  // Orange scale
    'PM10':  ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#54278f'],  // Purple scale
    'PM2.5': ['#ffffff', '#d9d9d9', '#969696', '#252525']   // Gray scale
};

// Standard ranges for each pollutant
const pollutantRanges = {
    'SO2':   0.012,  // ppm
    'NO2':   0.06,   // ppm
    'O3':    0.07,   // ppm
    'CO':    1.5,    // ppm
    'PM10':  200,    // μg/m³
    'PM2.5': 80      // μg/m³
};

// Units for display in tooltips
const pollutantUnits = {
    'SO2':   'ppm',
    'NO2':   'ppm',
    'O3':    'ppm',
    'CO':    'ppm',
    'PM10':  'μg/m³',
    'PM2.5': 'μg/m³'
};

// Chart configuration
const chartConfig = {
    bands: 4,        // Number of color bands
    size: 40,        // Height of each horizon chart
    padding: 1       // Padding between bands
};

// Main data processing and visualization
d3.csv(data_path).then(function(data) {
    /**
     * Aggregates hourly data into daily summaries
     * @param {Array} data - Raw data array
     * @param {string} type - Pollutant type
     * @param {number} selectedYear - Year to filter
     * @param {boolean} useMedian - Whether to use median instead of mean
     * @returns {Map} Daily aggregated data by station
     */
    function aggregate(data, type, selectedYear, useMedian = false) {
        // Filter data for selected year
        const filteredData = data.filter(d => {
            const date = new Date(d["Measurement date"]);
            return date.getFullYear() === selectedYear;
        });

        // Group data by day and station
        const groupedByDay = d3.group(filteredData, 
            d => d["Measurement date"].split(" ")[0],
            d => d["Station code"]
        );

        const dailyData = new Map();

        // Process each day's data
        for (const [day, stations] of groupedByDay) {
            for (const [station, measurements] of stations) {
                const values = measurements
                    .map(m => +m[type])
                    .filter(v => !isNaN(v) && v !== null);

                if (values.length > 0) {
                    if (!dailyData.has(station)) {
                        dailyData.set(station, []);
                    }

                    // Calculate statistics
                    const value = useMedian ? d3.median(values) : d3.mean(values);
                    const count = values.length;
                    const max = d3.max(values);
                    const min = d3.min(values);
                    const validDataPercentage = (count / 24) * 100;

                    dailyData.get(station).push({
                        date: new Date(day),
                        value: value,
                        count: count,
                        max: max,
                        min: min,
                        dataCompleteness: validDataPercentage
                    });
                }
            }
        }

        // Sort data by date for each station
        for (const [station, values] of dailyData) {
            dailyData.set(station, values.sort((a, b) => a.date - b.date));
        }

        return dailyData;
    }

    /**
     * Creates tooltip content
     * @param {Object} d - Data point
     * @param {string} type - Pollutant type
     * @returns {string} HTML content for tooltip
     */
    // Create tooltip content
    function createTooltipContent(d, type) {
        const date = d.date.toLocaleDateString();
        const value = d.value.toFixed(3);
        const unit = pollutantUnits[type];
        const count = d.count;
        const max = d.max.toFixed(3);
        const min = d.min.toFixed(3);

        return `
            <div class="tooltip-content">
                <div><strong>Date:</strong> ${date}</div>
                <div><strong>Value:</strong> ${value} ${unit}</div>
                <div><strong>Range:</strong> ${min} - ${max} ${unit}</div>
                <div><strong>Measurements:</strong> ${count}</div>
            </div>
        `;
    }
    /**
     * Creates the horizon chart visualization
     * @param {Map} data - Processed data
     * @param {string} type - Pollutant type
     * @param {string} container - Container element ID
     */
    function createHorizonChart(data, type, container) {
        const margin = {top: 30, right: 20, bottom: 50, left: 40};
        const width = window.innerWidth - 80;
        const size = chartConfig.size;
        const height = data.size * size + margin.top + margin.bottom + 40;
        const numBands = chartConfig.bands;
        const padding = chartConfig.padding;

        // Clear container
        d3.select(container).html("");

        // Create SVG
        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);

        // Create scales
        const x = d3.scaleTime()
            .domain(d3.extent([...data.values()].flat(), d => d.date))
            .range([margin.left, width - margin.right]);

        // Y scale based on pollutant type
        const y = d3.scaleLinear()
            .domain([0, pollutantRanges[type]])
            .range([size, size - numBands * (size - padding)]);

        // Create area generator
        const area = d3.area()
            .defined(d => !isNaN(d.value))
            .x(d => x(d.date))
            .y0(size)
            .y1(d => y(d.value));

        // Generate unique ID for clip paths
        const uid = `O-${Math.random().toString(16).slice(2)}`;

        // Create groups for each station
        const g = svg.append("g")
            .selectAll("g")
            .data([...data])
            .join("g")
            .attr("transform", (d, i) => `translate(0,${i * size + margin.top})`);

        // Create definitions and clip paths
        const defs = g.append("defs");

        defs.append("clipPath")
            .attr("id", (d, i) => `${uid}-clip-${i}`)
            .append("rect")
            .attr("y", padding)
            .attr("width", width)
            .attr("height", size - padding);

        defs.append("path")
            .attr("id", (d, i) => `${uid}-path-${i}`)
            .attr("d", ([_, values]) => area(values));

        // Create color bands
        const bandGroups = g.append("g")
            .attr("clip-path", (_, i) => `url(#${uid}-clip-${i})`)
            .selectAll("use")
            .data((_, i) => new Array(numBands).fill(i))
            .join("use")
            .attr("xlink:href", (i) => `#${uid}-path-${i}`)
            .attr("fill", (_, i) => colorSchemes[type][i])
            .attr("transform", (_, i) => `translate(0,${i * size})`);

        // Create tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Add interactive area for tooltip
        g.append("rect")
            .attr("class", "overlay")
            .attr("width", width - margin.left - margin.right)
            .attr("height", size)
            .attr("transform", `translate(${margin.left},0)`)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", function() {
                tooltip.style("opacity", 1);
            })
            .on("mousemove", function(event, [station, values]) {
                const [xPos] = d3.pointer(event, this);
                const x0 = x.invert(xPos + margin.left);
                const bisect = d3.bisector(d => d.date).left;
                const i = bisect(values, x0, 1);
                const d0 = values[i - 1];
                const d1 = values[i];
                const d = x0 - d0.date > d1.date - x0 ? d1 : d0;

                tooltip
                    .html(createTooltipContent(d, type))
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });

        // Add station labels
        g.append("text")
            .attr("x", margin.left - 10)
            .attr("y", (size + padding) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("class", "station-label")
            .text(([station]) => station);

        // Add X axis
        svg.append("g")
            .attr("transform", `translate(0,${margin.top})`)
            .call(d3.axisTop(x)
                .ticks(width / 100)
                .tickFormat(d3.timeFormat("%b %Y")))
            .call(g => g.select(".domain").remove());

        // Add legend
        const legendWidth = 400;
        const legendHeight = 30;
        const legendY = height - legendHeight - 10;

        const legend = svg.append("g")
            .attr("transform", `translate(${(width - legendWidth) / 2},${legendY})`);

        // Add legend color boxes
        legend.selectAll("rect")
            .data(colorSchemes[type])
            .enter()
            .append("rect")
            .attr("x", (d, i) => (i * (legendWidth / numBands)))
            .attr("width", legendWidth / numBands)
            .attr("height", 15)
            .attr("fill", d => d);

        // Add legend text
        legend.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("class", "legend-label")
            .text(`${type} Intensity Levels`);
    }

    /**
     * Sets up control elements and their event listeners
     */
    function setupControls() {
        // Create year selector
        const yearSelector = d3.select('#year-selector')
            .append('select')
            .attr('class', 'form-select d-inline-block')
            .style('width', '120px')
            .on('change', updateVisualization);

        yearSelector.selectAll('option')
            .data([2017, 2018, 2019])
            .enter()
            .append('option')
            .text(d => d);

        // Add event listeners
        d3.selectAll('input[name="type"]').on('change', updateVisualization);
        d3.select('#aggregation-method').on('change', updateVisualization);
    }

    /**
     * Updates the visualization based on current selections
     */
    function updateVisualization() {
        const selectedYear = +d3.select('#year-selector select').property('value');
        const selectedType = d3.select('input[name="type"]:checked').property('value');
        const useMedian = d3.select('#aggregation-method').property('value') === 'median';

        const processedData = aggregate(data, selectedType, selectedYear, useMedian);
        createHorizonChart(processedData, selectedType, '#horizon-chart');
    }

    // Initialize visualization
    setupControls();
    updateVisualization();
});