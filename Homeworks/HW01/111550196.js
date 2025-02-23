// Load the CSV file using D3.js
d3.csv("iris.csv").then(function(data) {
    // Filter the data to remove entries where the 'class' field is an empty string
    let validData = data.filter(d => {
        // Convert each attribute to a number; if conversion fails, it defaults to NaN which is filtered out by the class check
        d["sepal length"] = +d["sepal length"];
        d["sepal width"] = +d["sepal width"];
        d["petal length"] = +d["petal length"];
        d["petal width"] = +d["petal width"];
        return d.class.trim() !== ""; // Ensure class is not an empty string
    });

    // Log the filtered dataset to the console for verification
    console.log("Data loaded and parsed:", validData);

    // Initialize the scatter plot with the valid data
    initScatterPlot(validData);
}).catch(function(error) {
    // Log any errors encountered during loading of the data
    console.error('Error loading the dataset: ', error);
});

function initScatterPlot(data) {
    // Define the margins and dimensions for the scatter plot
    const margin = {top: 30, right: 30, bottom: 30, left: 30},
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    // Append SVG to the target div and set its dimensions
    const svg = d3.select("#scatterplot")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Define linear scales for both the X and Y axes
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d["sepal length"])) // Set the domain of xScale from the min to max of sepal length
        .range([0, width]);
    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d["sepal width"])) // Set the domain of yScale from the min to max of sepal width
        .range([height, 0]);

    // Append X and Y axes to the SVG
    const xAxis = svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale)); // Create X-axis with the bottom orientation
    const yAxis = svg.append("g")
        .call(d3.axisLeft(yScale)); // Create Y-axis with the left orientation

    // Append data points as circles to the scatter plot
    svg.append('g')
      .selectAll("dot")
      .data(data)
      .enter()
      .append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d["sepal length"])) // Position circles based on data
        .attr("cy", d => yScale(d["sepal width"]))
        .attr("r", 5) // Radius of circles
        .style("fill", function (d) { // Conditional coloring based on the class
            return d.class === "Iris-setosa" ? "blue" : d.class === "Iris-versicolor" ? "red" : "green";
        });

    // Define the updateChart function, which updates the scatter plot based on new attribute selections
    function updateChart() {
        const selectedX = d3.select('#x-axis').property('value');
        const selectedY = d3.select('#y-axis').property('value');

        // Update the scales based on new data selection
        xScale.domain(d3.extent(data, d => d[selectedX]));
        yScale.domain(d3.extent(data, d => d[selectedY]));

        // Apply transition to axes to show smooth changes
        xAxis.transition().duration(1000).call(d3.axisBottom(xScale));
        yAxis.transition().duration(1000).call(d3.axisLeft(yScale));

        // Transition circles to new positions based on the new scales
        svg.selectAll('circle')
           .transition().duration(1000)
           .attr('cx', d => xScale(d[selectedX]))
           .attr('cy', d => yScale(d[selectedY]));
    }

    // Attach event listeners to dropdown menus for interactive updates
    d3.select('#x-axis').on('change', updateChart);
    d3.select('#y-axis').on('change', updateChart);
}
