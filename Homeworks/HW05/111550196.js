// Configuration settings for the chart (sizes, margins, colors, etc.)
const config = {
    margin: { top: 50, right: 200, bottom: 50, left: 300 },  // Margins around the chart
    barHeight: 17, // Height for each university bar
    get width() {
        return Math.min(1600, window.innerWidth) - this.margin.left - this.margin.right - 40;
    },
    get height() {
        return this.displayedData ? Math.max(this.displayedData.length * this.barHeight, 100) : 500;
    },
    transition: { duration: 750 },  // Transition duration for smooth updates
    colors: {
        teaching: "#FF6B6B",
        research: "#4ECDC4",
        citations: "#45B7D1",
        industry: "#96CEB4",
        international: "#FFEEAD"
    },
    friendlyNames: {  // Names to display in the legend and tooltips
        teaching: "Teaching Score",
        research: "Research Score",
        citations: "Citations Score",
        industry: "Industry Income",
        international: "International Outlook"
    }
};

// Function to process the CSV data
function processData(csvData) {
    console.log("Processing all universities...");
    
    const processed = csvData.map(row => ({
        name: row.name,
        rank: +row.rank || 0,  // Use 0 if rank is NaN
        scores: {
            teaching: +row.scores_teaching || null,  // Convert to number or null
            research: +row.scores_research || null,
            citations: +row.scores_citations || null,
            industry: +row.scores_industry_income || null,
            international: +row.scores_international_outlook || null
        },
        // If scores_overall contains a range (e.g., "22.8–28.2"), extract the first value
        total: row.scores_overall.includes('–') ? 
               +row.scores_overall.split('–')[0] : 
               +row.scores_overall || 0,  // Extract first value or convert to number
        location: row.location || 'Unknown'
    }))
    // Filter out universities where any important score is null
    .filter(d => d.name && Object.values(d.scores).every(score => score !== null));

    console.log("Total processed universities:", processed.length);
    return processed;
}



// Class to handle all the logic for the University Ranking Chart
class UniversityRankingChart {
    constructor(container) {
        this.container = container;
        this.data = [];
        this.displayCount = 500;  // Default number of universities to display
        this.activeKeys = ["teaching", "research", "citations", "industry", "international"]; // Default categories to show
        this.setup();
    }

    // Set up the basic elements of the chart (scales, axes, legend, tooltip)
    setup() {
        console.log("Setting up chart...");

        // Append SVG container for the chart
        this.svg = d3.select(this.container)
            .append("svg")
            .attr("width", config.width + config.margin.left + config.margin.right);

        // Append group element for the actual chart
        this.chartGroup = this.svg.append("g")
            .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

        this.setupScales();
        this.setupAxes();
        this.setupTooltip();
        this.setupLegend();
    }

    // Initialize the scales (x-axis: score, y-axis: universities)
    setupScales() {
        this.y = d3.scaleBand()
            .range([0, config.height])
            .padding(0.1);  // Space between bars

        this.x = d3.scaleLinear()
            .range([0, config.width]);  // Score values go from 0 to max score (e.g. 500)
    }

    // Initialize the x and y axes
    setupAxes() {
        this.xAxis = this.chartGroup.append("g")
            .attr("class", "x-axis");

        this.yAxis = this.chartGroup.append("g")
            .attr("class", "y-axis");

        // Add a label for the x-axis
        this.chartGroup.append("text")
            .attr("class", "x-axis-label")
            .attr("x", config.width / 2)
            .attr("y", -20)
            .style("text-anchor", "middle")
            .text("Score");
    }

    // Setup the tooltip to show detailed information on hover
    setupTooltip() {
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);  // Initially hidden
    }

    // Setup the legend to toggle visibility of different score categories
    setupLegend() {
        const legend = this.chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${config.width + 20}, 0)`);

        // Create legend items for each category (teaching, research, etc.)
        this.legendItems = legend.selectAll(".legend-item")
            .data(Object.keys(config.colors))
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0,${i * 25})`)
            .on("click", (event, d) => this.toggleCategory(d));

        this.legendItems.append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .attr("fill", d => config.colors[d]);

        this.legendItems.append("text")
            .attr("x", 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .text(d => config.friendlyNames[d]);
    }

    // Toggle the visibility of a score category (e.g. teaching, research)
    toggleCategory(category) {
        const index = this.activeKeys.indexOf(category);
        if (index === -1) {
            this.activeKeys.push(category);  // Add the category back if it's not active
        } else {
            this.activeKeys.splice(index, 1);  // Remove the category if it's active
        }

        // Update the legend's appearance to reflect active/inactive categories
        d3.selectAll(".legend-item")
            .classed("disabled", d => !this.activeKeys.includes(d));
            
        this.update();  // Redraw the chart with the updated categories
    }

    // Update the chart's data and redraw everything
    updateData(newData) {
        console.log("Updating data with total universities:", newData.length);
        this.data = newData;
        this.displayCount = newData.length;  // Show all initially
        document.getElementById("displayCount").value = this.data.length;
        this.update();
    }

    // Main update function to redraw the chart with new data and sorting
    update(sortKey = 'overall', ascending = false) {
        console.log("Updating chart...");

        // Get the displayed data based on sorting
        const displayedData = this.getDisplayedData(sortKey, ascending);
        config.displayedData = displayedData;

        // Adjust SVG height based on the number of displayed universities
        const newHeight = Math.max(displayedData.length * config.barHeight + 
                                    config.margin.top + config.margin.bottom, 100);
        console.log("New SVG height:", newHeight);
        
        this.svg.attr("height", newHeight);

        // Update scales based on the new data
        this.y.domain(displayedData.map(d => d.name))
            .range([0, displayedData.length * config.barHeight]);
        this.x.domain([0, 500]);

        this.updateAxes(displayedData);
        this.updateBars(displayedData);
    }

    // Get the data to be displayed based on the sorting option
    getDisplayedData(sortKey, ascending) {
        console.log("Getting displayed data, current displayCount:", this.displayCount);

        return [...this.data]
            .sort((a, b) => {
                const getValue = (d) => {
                    if (sortKey === 'overall') return d.total;  // Sort by overall score
                    return d.scores[sortKey];  // Sort by individual score (teaching, research, etc.)
                };
                return ascending ? 
                    getValue(a) - getValue(b) : 
                    getValue(b) - getValue(a);
            })
            .slice(0, this.displayCount);  // Limit to the number of universities to display
    }

    // Update the axes after sorting or filtering
    updateAxes(displayedData) {
        this.xAxis.transition()
            .duration(config.transition.duration)
            .call(d3.axisTop(this.x));  // Update the top x-axis

        this.yAxis.transition()
            .duration(config.transition.duration)
            .call(d3.axisLeft(this.y));  // Update the left y-axis
    }

    // Redraw the bars in the chart after data updates
    updateBars(displayedData) {
        const stack = d3.stack()
            .keys(this.activeKeys)  // Only include active categories
            .value((d, key) => d.scores[key] || 0);  // Ensure we handle missing values

        const stackedData = stack(displayedData);

        const layers = this.chartGroup.selectAll(".layer")
            .data(stackedData);

        const layersEnter = layers.enter()
            .append("g")
            .attr("class", "layer");

        layers.exit().remove();

        const allLayers = layers.merge(layersEnter)
            .style("fill", d => config.colors[d.key]);  // Set bar color based on category

        const bars = allLayers.selectAll("rect")
            .data(d => d);

        // Enter new bars and update existing ones
        bars.enter()
            .append("rect")
            .attr("class", "bar")
            .merge(bars)
            .transition()
            .duration(config.transition.duration)
            .attr("y", (d, i) => this.y(displayedData[i].name))
            .attr("x", d => this.x(d[0]))
            .attr("width", d => this.x(d[1]) - this.x(d[0]))
            .attr("height", this.y.bandwidth());

        bars.exit().remove();

        // Update tooltips for the bars
        allLayers.selectAll("rect")
            .on("mouseover", (event, d) => {
                const layer = d3.select(event.target.parentNode).datum();
                const category = layer.key;
                const value = d[1] - d[0];
                const university = d.data;
                
                this.tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                    
                this.tooltip.html(`
                    <h4>${university.name}</h4>
                    <p><strong>Rank:</strong> ${university.rank}</p>
                    <p><strong>${config.friendlyNames[category]}:</strong> ${value.toFixed(2)}</p>
                    <p><strong>Overall Score:</strong> ${university.total.toFixed(2)}</p>
                    <p><strong>Location:</strong> ${university.location}</p>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                this.tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);  // Hide tooltip on mouse out
            });
    }
}

// Create an instance of the chart class
const chart = new UniversityRankingChart("#chart");

// Load CSV data and initialize the chart
d3.csv("TIMES_WorldUniversityRankings_2024.csv")
    .then(function(data) {
        console.log("Raw data loaded:", data.length);
        const processedData = processData(data);
        console.log("Processed data:", processedData.length);
        console.log(data);
        chart.updateData(processedData);  // Load processed data into the chart
    })
    .catch(function(error) {
        console.error("Error loading the CSV file:", error);  // Log error if file can't be loaded
    });

// Event listener for sorting by different criteria
document.getElementById("sortBy").addEventListener("change", (e) => {
    const sortKey = e.target.value;
    const ascending = !document.getElementById("descending").classList.contains("active");
    chart.update(sortKey, ascending);  // Update chart when sort option changes
});

// Event listener for descending sort button
document.getElementById("descending").addEventListener("click", function() {
    this.classList.add("active");
    document.getElementById("ascending").classList.remove("active");
    const sortKey = document.getElementById("sortBy").value;
    chart.update(sortKey, false);  // Update chart to descending order
});

// Event listener for ascending sort button
document.getElementById("ascending").addEventListener("click", function() {
    this.classList.add("active");
    document.getElementById("descending").classList.remove("active");
    const sortKey = document.getElementById("sortBy").value;
    chart.update(sortKey, true);  // Update chart to ascending order
});

// Event listener for updating the number of displayed universities
document.getElementById("displayCount").addEventListener("change", (e) => {
    const newCount = parseInt(e.target.value);
    if (newCount >= 5) {
        chart.displayCount = Math.min(newCount, chart.data.length);
        const sortKey = document.getElementById("sortBy").value;
        const ascending = !document.getElementById("descending").classList.contains("active");
        chart.update(sortKey, ascending);  // Update chart with new display count
    }
});

// Event listener for resetting the view
document.getElementById("resetView").addEventListener("click", () => {
    chart.displayCount = chart.data.length;  // Show all universities
    document.getElementById("displayCount").value = chart.data.length;
    document.getElementById("sortBy").value = "overall";
    document.getElementById("descending").classList.add("active");
    document.getElementById("ascending").classList.remove("active");
    chart.activeKeys = ["teaching", "research", "citations", "industry", "international"];
    d3.selectAll(".legend-item").classed("disabled", false);
    chart.update("overall", false);  // Reset to default view
});

// Event listener for exporting data to CSV
document.getElementById("exportData").addEventListener("click", () => {
    const sortKey = document.getElementById("sortBy").value;
    const ascending = !document.getElementById("descending").classList.contains("active");
    const displayedData = chart.getDisplayedData(sortKey, ascending);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Name,Rank,Overall Score,Teaching,Research,Citations,Industry Income,International Outlook,Location\n"
        + displayedData.map(d => {
            return `${d.name},${d.rank},${d.total},${d.scores.teaching},${d.scores.research},`
                + `${d.scores.citations},${d.scores.industry},${d.scores.international},${d.location}`;
        }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "university_rankings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);  // Trigger CSV download
});

// Event listener for window resize, to adjust the chart size
window.addEventListener('resize', () => {
    const sortKey = document.getElementById("sortBy").value;
    const ascending = !document.getElementById("descending").classList.contains("active");
    chart.update(sortKey, ascending);  // Update chart on window resize
});
