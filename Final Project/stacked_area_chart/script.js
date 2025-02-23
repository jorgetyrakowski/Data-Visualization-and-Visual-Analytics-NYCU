d3.csv("../data/co2-by-source.csv").then(function(data) {
    const yearlyData = {};
    
    data.forEach(row => {
        const year = +row.Year;
        if (year && !isNaN(year)) {
            if (!yearlyData[year]) {
                yearlyData[year] = {
                    year: year,
                    "Coal": 0,
                    "Oil": 0,
                    "Gas": 0,
                    "Cement": 0,
                    "Flaring": 0,
                    "Other Industry": 0
                };
            }
            
            yearlyData[year]["Coal"] += parseFloat(row["Annual CO₂ emissions from coal"]) || 0;
            yearlyData[year]["Oil"] += parseFloat(row["Annual CO₂ emissions from oil"]) || 0;
            yearlyData[year]["Gas"] += parseFloat(row["Annual CO₂ emissions from gas"]) || 0;
            yearlyData[year]["Cement"] += parseFloat(row["Annual CO₂ emissions from cement"]) || 0;
            yearlyData[year]["Flaring"] += parseFloat(row["Annual CO₂ emissions from flaring"]) || 0;
            yearlyData[year]["Other Industry"] += parseFloat(row["Annual CO₂ emissions from other industry"]) || 0;
        }
    });

    const processedData = Object.values(yearlyData).sort((a, b) => a.year - b.year);
    
    const margin = {top: 40, right: 150, bottom: 50, left: 80};
    const width = 1000;
    const height = 500;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const colors = {
        "Coal": "#463F3A",
        "Oil": "#8A817C",
        "Gas": "#BCB8B1",
        "Cement": "#F4F3EE",
        "Flaring": "#E0AFA0",
        "Other Industry": "#BE8A7D"
    };

    const x = d3.scaleTime()
        .range([0, width]);

    const y = d3.scaleLinear()
        .range([height, 0]);

    const sources = Object.keys(colors);
    const stack = d3.stack()
        .keys(sources)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    const area = d3.area()
        .x(d => x(new Date(d.data.year, 0, 1)))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y)
        .tickFormat(d => d3.format(".1s")(d) + " t");

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    svg.append("g")
        .attr("class", "y-axis");

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    function updateChart(startYear, endYear) {
        const filteredData = processedData.filter(d => d.year >= startYear && d.year <= endYear);
        
        x.domain([new Date(startYear, 0, 1), new Date(endYear, 0, 1)]);
        const series = stack(filteredData);
        y.domain([0, d3.max(series, d => d3.max(d, d => d[1]))]);

        const paths = svg.selectAll(".area")
            .data(series);

        paths.enter()
            .append("path")
            .attr("class", "area")
            .style("fill", ({key}) => colors[key])
            .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 1);
                
                const [xPos, yPos] = d3.pointer(event);
                const date = x.invert(xPos);
                const year = date.getFullYear();
                const data = filteredData.find(data => data.year === year);
                
                if (data) {
                    const value = data[d.key];
                    const totalEmissions = sources.reduce((sum, source) => sum + data[source], 0);
                    const percentage = (value / totalEmissions * 100).toFixed(1);
                    
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .98);
                    
                    tooltip.html(`
                        <div class="tooltip-content">
                            <div class="tooltip-title">${d.key}</div>
                            <strong>Year:</strong> ${year}<br>
                            <strong>Emissions:</strong> ${d3.format(",.0f")(value)} tonnes<br>
                            <strong>Share of total:</strong> ${percentage}%<br>
                            <small>Click and drag the slider handles to change time range</small>
                        </div>
                    `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
                    
                    svg.selectAll(".area")
                        .style("opacity", 0.3);
                    d3.select(this)
                        .style("opacity", 1);
                }
            })
            .on("mouseout", function() {
                svg.selectAll(".area")
                    .style("opacity", 0.85);
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .attr("d", area);

        paths.transition()
            .duration(300)
            .style("fill", ({key}) => colors[key])
            .attr("d", area);

        paths.exit().remove();

        svg.select(".x-axis")
            .transition()
            .duration(300)
            .call(xAxis);

        svg.select(".y-axis")
            .transition()
            .duration(300)
            .call(yAxis);

        d3.select("#year-display").text(`Year range: ${startYear} - ${endYear}`);
    }

    const legend = svg.append("g")
        .attr("transform", `translate(${width + 10},0)`);

    sources.forEach((source, i) => {
        const legendItem = legend.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0,${i * 25})`);

        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .style("fill", colors[source]);

        legendItem.append("text")
            .attr("x", 24)
            .attr("y", 12)
            .style("font-size", "14px")
            .text(source);

        legendItem
            .on("mouseover", function() {
                const areas = svg.selectAll(".area");
                areas.style("opacity", 0.3);
                areas.filter(d => d.key === source)
                    .style("opacity", 1);
            })
            .on("mouseout", function() {
                svg.selectAll(".area")
                    .style("opacity", 0.85);
            });
    });

    const sliderRange = document.getElementById('slider-range');
    noUiSlider.create(sliderRange, {
        start: [1750, 2023],
        connect: true,
        step: 1,
        range: {
            'min': 1750,
            'max': 2023
        },
        format: {
            to: value => Math.round(value),
            from: value => Math.round(value)
        }
    });

    sliderRange.noUiSlider.on('update', function (values) {
        updateChart(parseInt(values[0]), parseInt(values[1]));
    });

    const playButton = document.getElementById("play-button");
    let isPlaying = false;
    let interval;

    playButton.addEventListener("click", function() {
        if (isPlaying) {
            clearInterval(interval);
            this.textContent = "Play";
        } else {
            const startYear = parseInt(sliderRange.noUiSlider.get()[0]);
            let currentEndYear = parseInt(sliderRange.noUiSlider.get()[1]);
            const maxYear = 2023;
            
            const updateWithSpeed = () => {
                if (currentEndYear < maxYear) {
                    const increment = currentEndYear < 1900 ? 5 : 1; 
                    currentEndYear = Math.min(currentEndYear + increment, maxYear);
                    sliderRange.noUiSlider.set([startYear, currentEndYear]);
                    
                    const speed = currentEndYear < 1900 ? 100 : 300;
                    clearInterval(interval);
                    interval = setInterval(updateWithSpeed, speed);
                } else {
                    clearInterval(interval);
                    isPlaying = false;
                    playButton.textContent = "Play";
                }
            };
            
            interval = setInterval(updateWithSpeed, currentEndYear < 1900 ? 100 : 300);
            this.textContent = "Pause";
        }
        isPlaying = !isPlaying;
    });

    updateChart(1750, 2023);
});