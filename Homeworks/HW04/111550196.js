// Set up dimensions and margins for the scatterplot matrix
const size = 250;
const padding = 80;
const attributes = ["sepal length", "sepal width", "petal length", "petal width"];
const width = size * attributes.length + padding;
const height = size * attributes.length + padding;

// Create SVG container for the scatterplot matrix
const svg = d3.select("#scatterplot-matrix")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${padding / 2}, ${padding / 2})`);

// Set up color scale for the species
const color = d3.scaleOrdinal()
    .domain(["Iris-setosa", "Iris-versicolor", "Iris-virginica"])
    .range(["#FF6B6B", "#FFFF00", "#00FFFF"]);

// Load the Iris dataset and initialize the matrix
d3.csv("iris.csv").then(data => {
    let validData = data.filter(d => {
        // Convert string values to numbers
        d["sepal length"] = +d["sepal length"];
        d["sepal width"] = +d["sepal width"];
        d["petal length"] = +d["petal length"];
        d["petal width"] = +d["petal width"];
        return d.class.trim() !== ""; // Filter out any rows without a class
    });

    // Define domain for each attribute
    const domainByAttribute = {};
    attributes.forEach(attr => {
        domainByAttribute[attr] = d3.extent(validData, d => d[attr]);
    });

    // Set up scales for axes
    const x = d3.scaleLinear().range([padding / 2, size - padding / 2]);
    const y = d3.scaleLinear().range([size - padding / 2, padding / 2]);

    const xAxis = d3.axisBottom().ticks(6);
    const yAxis = d3.axisLeft().ticks(6);

    // Create the matrix grid for each pair of attributes
    const cell = svg.selectAll(".cell")
        .data(cross(attributes, attributes))
        .enter().append("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${(attributes.length - d.i - 1) * size},${d.j * size})`)
        .each(plotCell);

    // Brushing setup for scatterplots
    const brush = d3.brush()
        .extent([[padding / 2, padding / 2], [size - padding / 2, size - padding / 2]])
        .on("start", brushstart)
        .on("brush", brushmove)
        .on("end", brushend);

    cell.call(brush);

    let brushCell; // Variable to track the active brush

    // Function to plot each cell in the matrix (scatterplots or histograms)
    function plotCell(p) {
        const cell = d3.select(this);
        x.domain(domainByAttribute[p.x]);
        y.domain(domainByAttribute[p.y]);

        // Diagonal cells (histograms)
        if (p.x === p.y) {
            const histogram = d3.histogram()
                .domain(x.domain())
                .thresholds(x.ticks(12))
                .value(d => d[p.x]);

            const bins = histogram(validData);

            const yHist = d3.scaleLinear()
                .domain([0, d3.max(bins, d => d3.sum(color.domain(), species =>
                    d3.sum(d, b => b.class === species ? 1 : 0)))])
                .range([size - padding / 2, padding / 2]);

            // Group the data by species
            const binsBySpecies = {};
            color.domain().forEach(species => {
                binsBySpecies[species] = bins.map(d => {
                    return {
                        x0: d.x0,
                        x1: d.x1,
                        speciesCount: d.filter(b => b.class === species).length,
                        totalCount: d.length
                    };
                });
            });

            // Stack bars for each species (cumulative height)
            let cumulativeHeight = new Array(bins.length).fill(0);

            color.domain().forEach(species => {
                cell.selectAll(`.hist-bar-${species}`)
                    .data(binsBySpecies[species])
                    .enter().append("rect")
                    .attr("class", `hist-bar-${species}`)
                    .attr("x", d => x(d.x0) + 1)
                    .attr("y", (d, i) => {
                        const yPos = yHist(cumulativeHeight[i] + d.speciesCount);
                        cumulativeHeight[i] += d.speciesCount;
                        return yPos;
                    })
                    .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
                    .attr("height", d => size - padding / 2 - yHist(d.speciesCount))
                    .attr("fill", color(species))
                    .attr("opacity", 0.7);
            });

            // Add axis and labels for histograms
            cell.append("g")
                .attr("class", "x axis clean-axis")
                .attr("transform", `translate(0, ${size - padding / 2})`)
                .call(xAxis.scale(x));

            cell.append("g")
                .attr("class", "y axis clean-axis")
                .attr("transform", `translate(${padding / 2}, 0)`)
                .call(d3.axisLeft(yHist));

            cell.append("text")
                .attr("class", "histogram-label")
                .attr("x", size / 2)
                .attr("y", padding / 4)
                .text(p.x)
                .style("font-weight", "bold");

        // Off-diagonal cells (scatterplots)
        } else {
            cell.selectAll(".scatter-point")
                .data(validData)
                .enter().append("circle")
                .attr("class", "scatter-point")
                .attr("cx", d => x(d[p.x]))
                .attr("cy", d => y(d[p.y]))
                .attr("r", 4)
                .attr("fill", d => color(d.class));

            // Add x and y axes to scatterplots
            cell.append("g")
                .attr("class", "x axis clean-axis")
                .attr("transform", `translate(0,${size - padding / 2})`)
                .call(xAxis.scale(x));

            cell.append("g")
                .attr("class", "y axis clean-axis")
                .attr("transform", `translate(${padding / 2}, 0)`)
                .call(yAxis.scale(y));
        }
    }

    // Brushing functions for scatterplot interactivity
    function brushmove(event, p) {
        const selection = event.selection;
        if (!selection) return;

        svg.selectAll(".scatter-point")
            .classed("selected-point", function(d) {
                return isBrushed(selection, x(d[p.x]), y(d[p.y]));
            })
            .classed("hidden", function(d) {
                return !isBrushed(selection, x(d[p.x]), y(d[p.y]));
            });
    }

    function isBrushed(brush_coords, cx, cy) {
        const x0 = brush_coords[0][0],
              x1 = brush_coords[1][0],
              y0 = brush_coords[0][1],
              y1 = brush_coords[1][1];
        return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
    }

    function brushstart(event, p) {
        if (brushCell !== this) {
            d3.select(brushCell).call(brush.move, null);
            brushCell = this;
            x.domain(domainByAttribute[p.x]);
            y.domain(domainByAttribute[p.y]);
        }
    }

    function brushend(event) {
        if (!event.selection) {
            svg.selectAll(".scatter-point")
                .classed("hidden", false)
                .classed("selected-point", false);
        }
    }

    // Add the legend to the visualization
    const legend = d3.select("#legend").append("svg")
        .attr("width", 600)
        .attr("height", 50)
        .append("g")
        .attr("class", "legend")
        .attr("transform", "translate(10,10)");

    const species = color.domain();
    species.forEach((sp, i) => {
        legend.append("rect")
            .attr("x", 70 + i * 160)
            .attr("y", 0)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(sp));

        legend.append("text")
            .attr("x", 90 + i * 160)
            .attr("y", 10)
            .text(sp)
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .attr("alignment-baseline", "middle");
    });

    // Helper function to create attribute pairs for the matrix
    function cross(a, b) {
        const c = [];
        const n = a.length;
        const m = b.length;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                c.push({ x: a[i], i: i, y: b[j], j: j });
            }
        }
        return c;
    }

    // Tooltip for histogram interaction
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip");

    // Add interaction to the histogram bars
    cell.selectAll(".hist-bar")
        .on("mouseover", function(event, d) {
            tooltip.style("visibility", "visible")
                .html(`Bin: [${d.x0.toFixed(2)}, ${d.x1.toFixed(2)}]<br>Count: ${d.length}`)
                .style("top", (event.pageY - 20) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 20) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });
});
