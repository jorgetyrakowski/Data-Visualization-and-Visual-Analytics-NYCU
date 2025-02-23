// Wait until the document is fully loaded before executing the script
document.addEventListener('DOMContentLoaded', function () {

    // Load the abalone data using d3.text(), since it's in plain text format
    d3.text("abalone.data").then(function(rawData) {

        // Process the raw data into an array of objects
        let data = rawData.trim().split("\n").map(function(row) {
            // Each row is split by commas to extract individual values
            let columns = row.split(",");
            return {
                // Map the columns to attributes for each abalone
                Sex: columns[0].trim(),  // First column: Sex (M, F, or I)
                Length: +columns[1],     // Length attribute, converted to a number
                Diameter: +columns[2],   // Diameter attribute, converted to a number
                Height: +columns[3],     // Height attribute, converted to a number
                "Whole weight": +columns[4], // Whole weight, converted to a number
                "Shucked weight": +columns[5], // Shucked weight, converted to a number
                "Viscera weight": +columns[6], // Viscera weight, converted to a number
                "Shell weight": +columns[7],  // Shell weight, converted to a number
                Rings: +columns[8]       // Number of rings, converted to a number
            };
        });

        // Split the data into three subsets: Male, Female, and Infant
        let maleData = data.filter(d => d.Sex === "M");  // Filter males
        let femaleData = data.filter(d => d.Sex === "F");  // Filter females
        let infantData = data.filter(d => d.Sex === "I");  // Filter infants

        // List of attributes we are interested in for correlation
        let attributes = ["Length", "Diameter", "Height", "Whole weight", "Shucked weight", "Viscera weight", "Shell weight", "Rings"];

        // Draw correlation matrices for each group
        drawCorrelationMatrix(maleData, attributes, "#maleMatrix", "Male");
        drawCorrelationMatrix(femaleData, attributes, "#femaleMatrix", "Female");
        drawCorrelationMatrix(infantData, attributes, "#infantMatrix", "Infant");

    }).catch(function(error) {
        // Log any errors encountered during data loading
        console.error("Error loading the dataset:", error);
    });

    /**
     * Function to compute and draw a correlation matrix
     * @param {Array} data - Array of objects representing the data subset
     * @param {Array} attributes - Array of attribute names to include in the correlation
     * @param {String} containerId - The ID of the HTML container to draw the matrix in
     * @param {String} title - Title for this correlation matrix (e.g., Male, Female, Infant)
     */
    function drawCorrelationMatrix(data, attributes, containerId, title) {
        // Extract the numerical values for each attribute from the data
        let values = attributes.map(attr => data.map(d => +d[attr]));

        // Calculate the correlation matrix (2D array)
        let matrix = [];
        for (let i = 0; i < attributes.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < attributes.length; j++) {
                matrix[i][j] = calculateCorrelation(values[i], values[j]);
            }
        }

        // Define a color scale with increased contrast for better visibility
        let colorScale = d3.scaleLinear()
            .domain([0, 0.5, 1])  // Correlation ranges from 0 to 1
            .range(["#f0f0f0", "#76C7C0", "#1f77b4"]);  // White -> Turquoise -> Dark Blue

        // Set the size of the correlation matrix and cells
        let size = 550;  // Total size of the matrix
        let cellSize = size / attributes.length;  // Size of each cell

        // Create an SVG element and set up margins for labels and content
        let svg = d3.select(containerId).append("svg")
            .attr("width", size + 300)  // SVG width with extra space for labels
            .attr("height", size + 170)  // SVG height with extra space for labels
            .append("g")
            .attr("transform", "translate(170,50)");  // Translate group to add margins

        // Add the title above each matrix
        d3.select(containerId)
            .insert("h3", "svg")
            .text(title)  // Set the title for the matrix
            .style("text-align", "center");  // Center align the title

        // Create a tooltip for displaying correlation values on hover
        let tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("visibility", "hidden");  // Initially hidden

        // Draw each rectangle (cell) of the correlation matrix
        svg.selectAll("rect")
            .data(matrix.flat())  // Flatten the 2D matrix into a single array
            .enter()
            .append("rect")
            .attr("x", (d, i) => (i % attributes.length) * cellSize)  // X position of the cell
            .attr("y", (d, i) => Math.floor(i / attributes.length) * cellSize)  // Y position of the cell
            .attr("width", cellSize)  // Width of each cell
            .attr("height", cellSize)  // Height of each cell
            .attr("fill", function(d, i) {
                // Highlight diagonal cells (correlation with itself) in gold
                let row = Math.floor(i / attributes.length);
                let col = i % attributes.length;
                if (row === col) return "#FFD700";  // Diagonal is gold
                return colorScale(d);  // Use the color scale for other cells
            })
            .style("stroke", "#888")  // Border around each cell
            .style("stroke-width", 1.5)
            // Event listener for mouseover (show tooltip)
            .on("mouseover", function(event, d) {
                tooltip.style("visibility", "visible")
                    .text("Correlación: " + d.toFixed(2))  // Display the correlation value
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
                d3.select(this).style("stroke", "#000");  // Highlight the hovered cell
            })
            // Move the tooltip as the mouse moves
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            // Hide the tooltip when mouse leaves the cell
            .on("mouseout", function() {
                tooltip.style("visibility", "hidden");
                d3.select(this).style("stroke", "#888");  // Reset the border color
            });

        // Add text inside each cell to display the correlation value
        svg.selectAll(".cell-text")
            .data(matrix.flat())  // Again, using the flattened matrix array
            .enter()
            .append("text")
            .attr("x", (d, i) => (i % attributes.length) * cellSize + cellSize / 2)  // Center text horizontally
            .attr("y", (d, i) => Math.floor(i / attributes.length) * cellSize + cellSize / 2)  // Center text vertically
            .attr("text-anchor", "middle")  // Center the text
            .attr("class", "cell-text")  // Apply the text style class
            .text(d => d.toFixed(2))  // Format the correlation value with two decimal places
            .style("fill", "black")  // Text color
            .style("font-size", "12px")  // Font size for the text
            .style("font-weight", "bold");  // Make the text bold for emphasis

        // Add X-axis labels (rotated 90 degrees)
        svg.selectAll(".xLabels")
            .data(attributes)
            .enter()
            .append("text")
            .attr("x", (d, i) => i * cellSize + cellSize / 2)  // Position each label in the center of a column
            .attr("y", size + 10)  // Position below the matrix
            .attr("text-anchor", "start")  // Anchor text to the start
            .attr("transform", "rotate(90)")  // Rotate labels 90 degrees
            .style("transform-origin", (d, i) => `${i * cellSize + cellSize / 2}px ${size + 10}px`)  // Keep the rotation around its center
            .text(d => d)  // Set the label text
            .attr("class", "xLabels")  // Add class for styling
            .style("font-size", "14px");  // Font size for the labels

        // Add Y-axis labels
        svg.selectAll(".yLabels")
            .data(attributes)
            .enter()
            .append("text")
            .attr("x", -10)  // Position just outside the left side of the matrix
            .attr("y", (d, i) => i * cellSize + cellSize / 2)  // Center each label vertically
            .attr("text-anchor", "end")  // Align text to the end (right side of the label)
            .text(d => d)  // Set the label text
            .attr("class", "yLabels")  // Add class for styling
            .style("font-size", "14px");  // Font size for the labels

        // Color bar to the right of the matrix
        let colorBarHeight = size;  // Height matches the matrix size
        let colorBarWidth = 20;  // Fixed width for the color bar

        // Scale for the color bar
        let colorBarScale = d3.scaleLinear()
            .domain([0, 1])  // Correlation values between 0 and 1
            .range([colorBarHeight, 0]);  // Map domain to bar height

        // Axis for the color bar
        let colorBarAxis = d3.axisRight(colorBarScale)
            .ticks(5)  // Set tick intervals
            .tickFormat(d3.format(".1f"));  // Format ticks with 1 decimal

        // Create gradient for the color bar
        let defs = svg.append("defs");
        let gradient = defs.append("linearGradient")
            .attr("id", "color-gradient")
            .attr("x1", "0%")
            .attr("y1", "100%")
            .attr("x2", "0%")
            .attr("y2", "0%");

        // Define the colors for the gradient (white to blue, with gold for perfect correlation)
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#f0f0f0");
        gradient.append("stop").attr("offset", "50%").attr("stop-color", "#76C7C0");
        gradient.append("stop").attr("offset", "90%").attr("stop-color", "#1f77b4");
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#FFD700");

        // Append the color bar next to the matrix
        svg.append("rect")
            .attr("x", size + 60)  // Position the bar on the right
            .attr("y", 0)  // Start from the top
            .attr("width", colorBarWidth)  // Set the width
            .attr("height", colorBarHeight)  // Set the height
            .style("fill", "url(#color-gradient)");  // Use the gradient for the fill

        // Add the color bar axis
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(${size + 80}, 0)`)  // Position the axis next to the bar
            .call(colorBarAxis);  // Add the axis

        // Add a label for the color bar
        svg.append("text")
            .attr("x", size + 85)  // Position the label at the top of the color bar
            .attr("y", -10)  // Slightly above the top of the bar
            .text("Correlación")  // Label text (Correlation)
            .style("text-anchor", "middle")  // Center the text horizontally
            .style("font-size", "12px")  // Font size
            .style("font-weight", "bold");  // Make the label bold
    }

    /**
     * Function to calculate the Pearson correlation coefficient between two arrays of numbers
     * @param {Array} x - First array of numbers
     * @param {Array} y - Second array of numbers
     * @returns {Number} - Correlation coefficient between x and y
     */
    function calculateCorrelation(x, y) {
        let n = x.length;  // Number of elements
        let sum_x = d3.sum(x);  // Sum of x
        let sum_y = d3.sum(y);  // Sum of y
        let sum_x_sq = d3.sum(x.map(d => d * d));  // Sum of x squared
        let sum_y_sq = d3.sum(y.map(d => d * d));  // Sum of y squared
        let sum_xy = d3.sum(x.map((d, i) => d * y[i]));  // Sum of x * y

        // Calculate the numerator and denominator of the Pearson correlation formula
        let numerator = (n * sum_xy) - (sum_x * sum_y);
        let denominator = Math.sqrt((n * sum_x_sq - sum_x * sum_x) * (n * sum_y_sq - sum_y * sum_y));

        // If the denominator is zero (no correlation), return 0, otherwise return the correlation coefficient
        return denominator === 0 ? 0 : numerator / denominator;
    }
});
