// Define margins and dimensions for the SVG container
var margin = { top: 50, right: 100, bottom: 30, left: 50 },
    width = 950 - margin.left - margin.right,  // Width of the chart
    height = 500 - margin.top - margin.bottom;  // Height of the chart

// Create the main SVG container and set its dimensions and position
var svg = d3.select("#parallel-coordinates")
    .append("svg")
    .attr("width", width + margin.left + margin.right)  // Set SVG width
    .attr("height", height + margin.top + margin.bottom)  // Set SVG height
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");  // Translate the SVG group

// Load the dataset from the given URL
d3.csv("iris.csv").then(function (data) {
    // Filter the dataset to ensure that only rows with a valid "class" are included
    data = data.filter(d => d["class"]);

    // Define a color scale for the species (using more intense colors)
    var color = d3.scaleOrdinal()
        .domain(["Iris-setosa", "Iris-versicolor", "Iris-virginica"])  // Define the classes
        .range(["#1a1aff", "#ff1a1a", "#33cc33"]);  // Set the color for each class

    // Define the dimensions (attributes) of the dataset that will be plotted
    var dimensions = ["sepal length", "sepal width", "petal length", "petal width"];

    // Create a 'y' scale for each attribute in the dataset
    var y = {};
    dimensions.forEach(function (dim) {
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, function (d) { return +d[dim]; }))  // Set the scale based on the data extent
            .range([height, 0]);  // Map the values to the height of the chart
    });

    // Create an 'x' scale to position the axes horizontally
    var x = {};
    var tmpx = d3.scalePoint()
        .range([0, width])  // Define the range for the axes' x-position
        .domain(dimensions)  // Set the domain as the attribute names
        .padding(1);  // Add padding between axes

    // Assign the initial x-positions for the axes
    dimensions.forEach(function (dim) {
        x[dim] = tmpx(dim);  // Set the x-position for each dimension
    });

    // Function to create the paths for each data point (i.e., the lines connecting the axes)
    function path(d) {
        return d3.line()(dimensions.map(function (dim) {
            return [x[dim], y[dim](d[dim])];  // Coordinate the position of each axis
        }));
    }

    // Draw the lines for each data point (flower) in the dataset
    var lines = svg.selectAll("myPath")
        .data(data)  // Bind the data to the lines
        .enter().append("path")  // Create a path for each data point
        .attr("class", function (d) { return "line " + d["class"]; })  // Add a class for each species
        .attr("d", path)  // Define the path using the 'path' function
        .style("fill", "none")  // Remove the fill
        .style("stroke", function (d) { return color(d["class"]); })  // Set the stroke color based on the species
        .style("opacity", 0.5);  // Set the initial opacity

    // Create a tooltip for displaying species information on hover
    var tooltip = d3.select("body")
        .append("div")  // Create a div for the tooltip
        .style("position", "absolute")  // Set the tooltip's position
        .style("background", "white")  // Set the background color
        .style("border", "1px solid #999")  // Add a border to the tooltip
        .style("padding", "5px")  // Add padding inside the tooltip
        .style("display", "none")  // Hide the tooltip initially
        .style("border-radius", "5px");  // Round the corners of the tooltip

    // Add event listeners for mouseover and mouseout on the lines
    lines.on("mouseover", function (event, d) {
        // Show and position the tooltip when hovering over a line
        tooltip.style("display", "inline-block")
            .html(`<strong>Species:</strong> ${d["class"]}`)  // Display the species name
            .style("left", (event.pageX + 10) + "px")  // Position the tooltip near the mouse cursor
            .style("top", (event.pageY - 20) + "px");

        // Highlight the hovered line by increasing the stroke width and opacity
        d3.select(this).style("stroke-width", 3).style("opacity", 1);
    })
        .on("mouseout", function () {
            // Hide the tooltip when the mouse leaves the line
            tooltip.style("display", "none");

            // Restore the original stroke width and opacity
            d3.select(this).style("stroke-width", 1.5).style("opacity", 0.5);
        });

    // Draw the axes for each dimension and make them draggable
    var gAxis = svg.selectAll(".dimension")
        .data(dimensions)  // Bind the dimensions to the axes
        .enter().append("g")  // Create a group element for each axis
        .attr("class", "axis")  // Add a class for styling
        .attr("transform", function (d) { return "translate(" + x[d] + ")"; });  // Position each axis

    // Add a larger clickable area behind each axis to make dragging easier
    gAxis.append("rect")
        .attr("x", -10)  // Expand the clickable area to the left
        .attr("y", -margin.top)  // Expand upwards
        .attr("width", 20)  // Set a wider clickable area
        .attr("height", height + margin.top + margin.bottom)  // Cover the entire height of the axis
        .style("fill", "transparent")  // Make the area invisible but clickable
        .style("cursor", "pointer");  // Change the cursor to indicate dragging

    // Add the actual axis with ticks and labels
    gAxis.each(function (d) { d3.select(this).call(d3.axisLeft().scale(y[d])); });

    // Make the axes draggable to reorder them
    gAxis.call(d3.drag()
        .on("start", function (event, d) {
            d3.select(this).raise();  // Bring the dragged axis to the front
        })
        .on("drag", function (event, d) {
            // Update the x-position of the dragged axis in real-time
            x[d] = Math.min(width, Math.max(0, event.x));  // Ensure the axis stays within bounds
            d3.select(this).attr("transform", "translate(" + x[d] + ")");  // Move the axis

            // Reorder the axes if one passes another
            for (var i = 0; i < dimensions.length; i++) {
                for (var j = i + 1; j < dimensions.length; j++) {
                    if (x[dimensions[i]] > x[dimensions[j]]) {
                        // Swap the x-positions and dimensions
                        var temp = x[dimensions[i]];
                        x[dimensions[i]] = x[dimensions[j]];
                        x[dimensions[j]] = temp;

                        var tmpDim = dimensions[i];
                        dimensions[i] = dimensions[j];
                        dimensions[j] = tmpDim;

                        // Move the swapped axes to their new positions
                        svg.selectAll(".axis")
                            .filter(function (axisDim) { return axisDim === dimensions[i]; })
                            .attr("transform", "translate(" + x[dimensions[i]] + ")");

                        svg.selectAll(".axis")
                            .filter(function (axisDim) { return axisDim === dimensions[j]; })
                            .attr("transform", "translate(" + x[dimensions[j]] + ")");
                    }
                }
            }

            // Redraw the lines to reflect the new axis order
            lines.attr("d", path);
        })
    );

    // Add titles for the axes with enhanced styling
    gAxis.append("text")
        .style("text-anchor", "middle")  // Center the text
        .style("font-weight", "bold")  // Make the axis titles bold
        .style("fill", "#333")  // Use a darker text color for visibility
        .style("font-size", "14px")  // Increase the font size
        .attr("y", -9)  // Position the titles above the axes
        .text(function (d) { return d; });  // Display the attribute name

    // **Simple legend** for the species with intense colors
    svg.append("text")
        .attr("x", width + 10)  // Position the legend to the right of the chart
        .attr("y", height - 60)  // Position for the "Iris-setosa" label
        .text("Iris-setosa")  // Label for Iris-setosa
        .style("fill", "#1a1aff");  // Color matching Iris-setosa

    svg.append("text")
        .attr("x", width + 10)  // Position the legend to the right of the chart
        .attr("y", height - 40)  // Position for the "Iris-versicolor" label
        .text("Iris-versicolor")  // Label for Iris-versicolor
        .style("fill", "#ff1a1a");  // Color matching Iris-versicolor

    svg.append("text")
        .attr("x", width + 10)  // Position the legend to the right of the chart
        .attr("y", height - 20)  // Position for the "Iris-virginica" label
        .text("Iris-virginica")  // Label for Iris-virginica
        .style("fill", "#33cc33");  // Color matching Iris-virginica
});

