// Set up dimensions and margins for the chart
// These values define the size and layout of the chart
const margin = {top: 40, right: 20, bottom: 50, left: 60};
let width = 800 - margin.left - margin.right;
let height = 500 - margin.top - margin.bottom;

// Create the main SVG element for the chart
// This SVG will contain all the visual elements of our chart
const svg = d3.select("#themeriver-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    // The viewBox attribute makes the SVG responsive
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append("g")
    // This transformation creates space for the axes
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Set up a color scale for different property types
// This will assign a unique color to each type of property
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// Load and process the data from the CSV file
d3.csv("http://vis.lab.djosix.com:2024/data/ma_lga_12345.csv").then(data => {
    // Parse dates and convert prices to numbers
    // This ensures our data is in the correct format for visualization
    const parseDate = d3.timeParse("%d/%m/%Y");
    data.forEach(d => {
        d.saledate = parseDate(d.saledate);
        d.MA = +d.MA; // Convert string to number
    });

    // Group and aggregate data by property type, bedroom count, and date
    // This creates a nested structure of our data
    const nestedData = d3.group(data, d => d.type, d => d.bedrooms, d => d.saledate);

    // Create an array of all unique dates
    // This will be used for our x-axis
    const allDates = Array.from(new Set(data.map(d => d.saledate))).sort(d3.ascending);

    // Create the final dataset for the themeriver
    // This flattens our nested data into a format suitable for D3's stack layout
    const themeriverData = Array.from(nestedData, ([type, bedroomMap]) => {
        return Array.from(bedroomMap, ([bedrooms, dateMap]) => {
            const values = allDates.map(date => {
                const match = dateMap.get(date);
                return {
                    date: date,
                    value: match ? match[0].MA : 0,
                    type: type,
                    bedrooms: bedrooms
                };
            });
            return {
                key: `${type}-${bedrooms}`,
                values: values
            };
        });
    }).flat();

    // Sort themeriverData to match the desired order in the legend and chart
    // This ensures consistency between the chart and the legend
    themeriverData.sort((a, b) => {
        const order = ['house-3', 'house-4', 'house-5', 'unit-1', 'unit-3', 'unit-2', 'house-2'];
        return order.indexOf(a.key) - order.indexOf(b.key);
    });

    // Set up scales for x and y axes
    // These map our data values to pixel values
    const x = d3.scaleTime()
        .domain(d3.extent(allDates))
        .range([0, width]);

    const y = d3.scaleLinear()
        .range([height, 0]);

    // Prepare base data for stacking
    // This creates an object for each date with properties for each property type
    const baseData = allDates.map(date => {
        const obj = {date: date};
        themeriverData.forEach(series => {
            const match = series.values.find(d => d.date.getTime() === date.getTime());
            obj[series.key] = match ? match.value : 0;
        });
        return obj;
    });

    // Set up stack layout
    // This creates our stacked data structure
    const stack = d3.stack()
        .keys(themeriverData.map(d => d.key))
        .offset(d3.stackOffsetWiggle) // This creates the "river" effect
        .order(d3.stackOrderNone);

    // Create initial stacked data
    let stackedData = stack(baseData);

    // Update y scale domain
    // This sets the range of our y-axis based on the stacked data
    y.domain([
        d3.min(stackedData, layer => d3.min(layer, d => d[0])),
        d3.max(stackedData, layer => d3.max(layer, d => d[1]))
    ]);

    // Create area generator for the streams
    // This function will create the paths for our stream areas
    const area = d3.area()
        .x(d => x(d.data.date))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis); // This creates smooth curves

    // Draw the streams
    // This creates the actual visual elements of our chart
    const streams = svg.selectAll(".stream")
        .data(stackedData)
        .enter().append("path")
        .attr("class", "stream")
        .attr("d", area)
        .style("fill", d => colorScale(d.key));

    // Add x-axis
    // This creates the bottom axis of our chart
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

    // Add y-axis
    // This creates the left axis of our chart
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y));

    // Add x-axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .style("text-anchor", "middle")
        .text("Year");

    // Add y-axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .style("text-anchor", "middle")
        .text("Median Price ($)");

    // Add chart title
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .text("Property Sales Themeriver");

    // Add legend
    // This creates the interactive legend for our chart
    const legend = d3.select("#legend-container")
        .append("div")
        .attr("id", "sortable-legend")
        .selectAll(".legend-item")
        .data(themeriverData.slice().reverse())
        .enter().append("div")
        .attr("class", "legend-item")
        .attr("data-id", d => d.key);

    legend.append("span")
        .attr("class", "legend-color")
        .style("background-color", d => colorScale(d.key));

    legend.append("span")
        .text(d => `${d.key.split('-')[0]} (${d.key.split('-')[1]} bed)`);

    // Initialize Sortable for drag-and-drop functionality
    // This allows users to reorder the legend items
    new Sortable(document.getElementById('sortable-legend'), {
        animation: 150,
        ghostClass: 'blue-background-class',
        onEnd: function (evt) {
            const newOrder = Array.from(evt.to.children).map(el => el.getAttribute('data-id')).reverse();
            updateOrder(newOrder);
        },
    });

    // Add tooltip
    // This creates a div for displaying information on hover
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Add interactivity to streams
    // This handles mouse events on the stream areas
    streams.on("mouseover", function(event, d) {
        d3.select(this).style("opacity", 1);
        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
    })
    .on("mousemove", function(event, d) {
        const [mouseX, mouseY] = d3.pointer(event);
        const date = x.invert(mouseX);
        const bisect = d3.bisector(d => d.data.date).left;
        const index = bisect(d, date);
        const selectedData = d[index];
        
        tooltip.html(`
            <strong>Date:</strong> ${d3.timeFormat("%B %Y")(selectedData.data.date)}<br/>
            <strong>Type:</strong> ${d.key.split('-')[0]}<br/>
            <strong>Bedrooms:</strong> ${d.key.split('-')[1]}<br/>
            <strong>Median Price:</strong> $${d3.format(",")(Math.round(selectedData[1] - selectedData[0]))}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
        d3.select(this).style("opacity", 0.8);
        tooltip.transition()
            .duration(500)
            .style("opacity", 0);
    });

    // Function to update the order of streams
    // This is called when the legend items are reordered
    function updateOrder(newOrder) {
        // Update themeriverData order
        themeriverData.sort((a, b) => newOrder.indexOf(a.key) - newOrder.indexOf(b.key));
        
        // Create a new stack with the new order
        const newStack = d3.stack()
            .keys(newOrder)
            .offset(d3.stackOffsetWiggle)
            .order(d3.stackOrderNone);

        // Apply the new stack to the base data
        const newStackedData = newStack(baseData);

        // Update the y scale domain
        y.domain([
            d3.min(newStackedData, layer => d3.min(layer, d => d[0])),
            d3.max(newStackedData, layer => d3.max(layer, d => d[1]))
        ]);

        // Update the streams
        // This transitions the streams to their new positions
        svg.selectAll(".stream")
            .data(newStackedData)
            .transition()
            .duration(1000)
            .attr("d", area)
            .style("fill", d => colorScale(d.key));

        // Update the stack object and stackedData
        stack.keys(newOrder);
        stackedData = newStackedData;

        // Update the legend order
        d3.select("#sortable-legend")
            .selectAll(".legend-item")
            .data(themeriverData.slice().reverse(), d => d.key)
            .order();
    }

    // Responsive function to handle window resizing
    function responsive() {
        const container = d3.select("#themeriver-container");
        const containerWidth = container.node().getBoundingClientRect().width;
        const containerHeight = container.node().getBoundingClientRect().height;

        // Ensure the chart doesn't exceed maximum size or become too small
        const newWidth = Math.max(500, Math.min(containerWidth, 800)) - margin.left - margin.right;
        const newHeight = Math.max(400, Math.min(containerHeight, 500)) - margin.top - margin.bottom;

        // Update SVG size and viewBox
        svg.attr("viewBox", `0 0 ${newWidth + margin.left + margin.right} ${newHeight + margin.top + margin.bottom}`)
            .attr("width", containerWidth)
            .attr("height", containerHeight);

        // Update scales
        x.range([0, newWidth]);
        y.range([newHeight, 0]);

        // Update axes
        svg.select(".x-axis")
        .attr("transform", `translate(0,${newHeight})`)
        .call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));

        svg.select(".y-axis")
        .call(d3.axisLeft(y));

        // Update streams
        svg.selectAll(".stream")
        .attr("d", area);

        // Update labels
        svg.select(".axis-label.x")
        .attr("x", newWidth / 2)
        .attr("y", newHeight + margin.bottom - 10);

        svg.select(".axis-label.y")
        .attr("x", -newHeight / 2);

        svg.select(".chart-title")
        .attr("x", newWidth / 2)
        .attr("y", -margin.top / 2);
    }

    // Call responsive function on window resize
    window.addEventListener("resize", responsive);
});