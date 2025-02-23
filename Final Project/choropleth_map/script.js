// Configuration
const width = 960;
const height = 600;
const margin = {top: 10, right: 10, bottom: 10, left: 10};

// Create SVG with proper viewBox
const svg = d3.select("#map")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", "100%")
    .attr("height", "100%")
    .style("background-color", "white");

// Create base map group
const mapGroup = svg.append("g");

// Create legend group
const legendGroup = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 320}, ${height - 50})`);

// Create tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Configure map projection
const projection = d3.geoEquirectangular()
    .fitSize([width, height], {type: "Sphere"});

const path = d3.geoPath(projection);

// Color scale for CO2 per GDP values
const colorScale = d3.scaleThreshold()
    .domain([0.2, 0.4, 0.6, 0.8, 1.0, 1.2])
    .range(d3.schemeReds[7]);

// Country name mapping for inconsistencies
const countryNameMapping = {
    "United States of America": "United States",
    "Russia": "Russia",
    "Dem. Rep. Congo": "Democratic Republic of Congo",
    "Dominican Rep.": "Dominican Republic",
    "W. Sahara": "Western Sahara",
    "Czechia": "Czech Republic",
    "Korea": "South Korea",
    "Macedonia": "North Macedonia",
    "Slovak Republic": "Slovakia",
    "Burma": "Myanmar",
    "Congo": "Republic of Congo",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "Guinea-Bissau": "Guinea-Bissau",
    "United Arab Emirates": "United Arab Emirates",
    "Eq. Guinea": "Equatorial Guinea",
    "S. Sudan": "South Sudan",
    "Central African Rep.": "Central African Republic",
    "eSwatini": "Eswatini"
};

let currentYear = 1820;
let isPlaying = false;
let interval;

// Load data
Promise.all([
    d3.json("../data/countries-110m.json"),
    d3.csv("../data/relevant_columns_with_co2_per_gdp.csv")
]).then(([world, data]) => {
    const countries = topojson.feature(world, world.objects.countries);
    const co2Data = data;

    // Draw base map
    mapGroup.selectAll("path")
        .data(countries.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    // Configure zoom
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Setup slider
    const yearSlider = document.getElementById('year-slider');
    yearSlider.addEventListener('input', (event) => {
        currentYear = +event.target.value;
        updateMap(currentYear);
    });

    // Setup play button
    const playButton = document.getElementById('play-button');
    playButton.addEventListener('click', () => {
        if (isPlaying) {
            clearInterval(interval);
            playButton.textContent = 'Play';
        } else {
            interval = setInterval(() => {
                currentYear = currentYear < 2023 ? currentYear + 1 : 1800;
                yearSlider.value = currentYear;
                updateMap(currentYear);
            }, 300);
            playButton.textContent = 'Pause';
        }
        isPlaying = !isPlaying;
    });

    // Reset zoom button
    document.getElementById('reset-zoom').addEventListener('click', () => {
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
    });

    function updateMap(year) {
        d3.select("#year-display").text(`Year: ${year}`);

        const yearData = co2Data.filter(d => +d.year === year && d.co2_per_gdp !== null);
        const dataByCountry = new Map();
        yearData.forEach(d => {
            dataByCountry.set(d.country, +d.co2_per_gdp);
            const topoJSONName = Object.entries(countryNameMapping)
                .find(([k, v]) => v === d.country)?.[0];
            if (topoJSONName) {
                dataByCountry.set(topoJSONName, +d.co2_per_gdp);
            }
        });

        const maxValue = d3.max(yearData, d => +d.co2_per_gdp);
        console.log(`Year ${year}: ${yearData.length} countries with data, max value: ${maxValue}`);

        if (maxValue > 0) {
            mapGroup.selectAll(".country")
                .transition()
                .duration(200)
                .attr("fill", d => {
                    const val = dataByCountry.get(d.properties.name);
                    return val ? colorScale(val) : "#ccc";
                });

            updateLegend(maxValue);
        }
    }

    function updateLegend(maxValue) {
        legendGroup.selectAll("*").remove();

        const legendWidth = 300;
        const legendHeight = 20;

        const defs = legendGroup.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "color-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%");

        const stops = d3.range(0, 1.1, 0.1);
        stops.forEach(stop => {
            gradient.append("stop")
                .attr("offset", `${stop * 100}%`)
                .attr("stop-color", colorScale(stop * maxValue));
        });

        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#color-gradient)")
            .style("stroke", "black")
            .style("stroke-width", 0.5);

        const scale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([0, legendWidth]);

        const axis = d3.axisBottom(scale)
            .ticks(5)
            .tickFormat(d3.format(".3f"));

        legendGroup.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(axis);

        legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", legendWidth / 2)
            .attr("y", -5)
            .style("text-anchor", "middle")
            .text("CO₂ per GDP");
    }

    function showTooltip(event, d) {
        const countryName = d.properties.name;
        const mappedName = countryNameMapping[countryName] || countryName;
        
        const countryData = co2Data.find(item => 
            item.country === mappedName && +item.year === currentYear
        );

        if (countryData && countryData.co2_per_gdp) {
            tooltip.style("opacity", 0.9)
                .html(`
                    <strong>${mappedName}</strong><br/>
                    CO₂ per GDP: ${(+countryData.co2_per_gdp).toFixed(3)}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        } else {
            tooltip.style("opacity", 0.9)
                .html(`
                    <strong>${mappedName}</strong><br/>
                    No data available for this year
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        }
    }

    function moveTooltip(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip() {
        tooltip.style("opacity", 0);
    }

    // Initial update
    updateMap(currentYear);
});