// --- GLOBAL VARIABLES AND CONFIGURATIONS ---
let sankeyData;

// Set basic dimensions for the visualization
const width = Math.min(window.innerWidth - 40, 2400);    // Responsive width with max limit
const height = Math.min(window.innerHeight - 100, 1200); // Responsive height with max limit
const margin = {top: 20, right: 100, bottom: 20, left: 100};
const innerWidth = width - margin.right - margin.left;
const innerHeight = height - margin.top - margin.bottom;

// Define all column names and their display labels
const COLUMNS = ['buying', 'maint', 'doors', 'persons', 'lug_boot', 'safety', 'evaluation'];
const COLUMN_LABELS = {
   'buying': 'Buying Price',
   'maint': 'Maintenance',
   'doors': 'Doors',
   'persons': 'Capacity',
   'lug_boot': 'Luggage Boot',
   'safety': 'Safety',
   'evaluation': 'Evaluation'
};

// Set up color scheme for different categories
const colorScale = d3.scaleOrdinal()
   .domain(COLUMNS)
   .range([
       '#3498db', // blue for buying
       '#2ecc71', // green for maintenance
       '#9b59b6', // purple for doors
       '#e74c3c', // red for persons
       '#f1c40f', // yellow for luggage boot
       '#1abc9c', // turquoise for safety
       '#34495e'  // dark gray for evaluation
   ]);

// Set number format for values
const formatNumber = d3.format(",.0f"); // Format numbers with commas and no decimals

// --- SVG SETUP ---
// Create main SVG container
const svg = d3.select("#sankey-diagram")
   .append("svg")
   .attr("viewBox", `0 0 ${width} ${height}`)
   .attr("preserveAspectRatio", "xMidYMid meet");

// Create group for plotting with margins
const plotG = svg.append("g")
   .attr("transform", `translate(${margin.left}, ${margin.top})`);

// --- SANKEY DIAGRAM CONFIGURATION ---
const sankey = d3.sankey()
   .nodeWidth(40)        // Width of each node
   .nodePadding(50)      // Vertical spacing between nodes
   .extent([[0, 0], [innerWidth, innerHeight]]);

// --- TOOLTIP STYLES ---
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
   .tooltip {
       position: absolute;
       background: rgba(0, 0, 0, 0.85);
       color: white;
       padding: 8px 12px;
       border-radius: 4px;
       font-size: 13px;
       pointer-events: none;
       z-index: 1000;
       box-shadow: 0 2px 4px rgba(0,0,0,0.2);
       max-width: 300px;
       line-height: 1.4;
       white-space: nowrap;
   }
`;
document.head.appendChild(tooltipStyle);

// --- DATA PROCESSING ---
function processData(csvText) {
   // Split CSV text into rows and remove empty lines
   const data = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
   const sankeyData = {
       nodes: [],
       links: []
   };

   // Create nodes for each column and its unique values
   COLUMNS.forEach((col, colIndex) => {
       const uniqueValues = new Set(data.map(line => line.split(',')[colIndex]));
       
       uniqueValues.forEach(value => {
           sankeyData.nodes.push({
               name: value,
               fullName: `${COLUMN_LABELS[col]}: ${value}`,
               column: col,
               colIndex: colIndex
           });
       });
   });

   // Create links between consecutive columns
   for (let i = 0; i < COLUMNS.length - 1; i++) {
       const sourceCol = i;
       const targetCol = i + 1;

       // Count frequencies of connections
       const connections = {};
       data.forEach(line => {
           const values = line.split(',');
           const key = `${values[sourceCol]}-${values[targetCol]}`;
           connections[key] = (connections[key] || 0) + 1;
       });

       // Create links based on connections
       Object.entries(connections).forEach(([key, value]) => {
           const [sourceValue, targetValue] = key.split('-');
           const sourceNode = sankeyData.nodes.find(n => n.name === sourceValue && n.colIndex === sourceCol);
           const targetNode = sankeyData.nodes.find(n => n.name === targetValue && n.colIndex === targetCol);

           if (sourceNode && targetNode) {
               sankeyData.links.push({
                   source: sankeyData.nodes.indexOf(sourceNode),
                   target: sankeyData.nodes.indexOf(targetNode),
                   value: value
               });
           }
       });
   }

   return sankeyData;
}

// --- DRAWING FUNCTIONS ---
function drawSankey(data) {
   sankeyData = sankey(data);

   // Draw the links (connections between nodes)
   const link = plotG.append("g")
       .attr("class", "links")
       .selectAll(".link")
       .data(sankeyData.links)
       .enter()
       .append("path")
       .attr("class", "link")
       .attr("d", d3.sankeyLinkHorizontal())
       .style("stroke-width", d => Math.max(1, d.width))
       .style("stroke", d => colorScale(sankeyData.nodes[d.source.index].column))
       .style("opacity", 0.5)
       .on("mouseover", function(event, d) {
           d3.select(this).style("opacity", 0.8);
           showTooltip(event, d, sankeyData.nodes);
       })
       .on("mouseout", function() {
           d3.select(this).style("opacity", 0.5);
           hideTooltip();
       });

   // Draw the nodes (rectangles)
   const node = plotG.append("g")
       .attr("class", "nodes")
       .selectAll(".node")
       .data(sankeyData.nodes)
       .enter()
       .append("g")
       .attr("class", "node")
       .attr("transform", d => `translate(${d.x0},${d.y0})`)
       .call(d3.drag()
           .subject(d => d)
           .on("start", dragstarted)
           .on("drag", dragged)
           .on("end", dragended));

   // Add rectangles to nodes
   node.append("rect")
       .attr("height", d => d.y1 - d.y0)
       .attr("width", sankey.nodeWidth())
       .style("fill", d => colorScale(d.column))
       .style("stroke", "#000")
       .append("title")
       .text(d => `${d.fullName}\n${formatNumber(d.value)}`);

   // Add main labels to nodes
   node.append("text")
       .attr("x", d => sankey.nodeWidth() + 8)
       .attr("y", d => (d.y1 - d.y0) / 2)
       .attr("dy", "0em")
       .attr("text-anchor", "start")
       .text(d => `${COLUMN_LABELS[d.column]}: ${d.name}`)
       .style("font-size", "14px")
       .style("font-weight", "500")
       .style("alignment-baseline", "middle");

   // Add value labels to nodes
   node.append("text")
       .attr("x", d => sankey.nodeWidth() + 8)
       .attr("y", d => (d.y1 - d.y0) / 2)
       .attr("dy", "1.2em")
       .attr("text-anchor", "start")
       .text(d => `(${formatNumber(d.value)})`)
       .style("font-size", "12px")
       .style("fill", "#666")
       .style("alignment-baseline", "middle");
}

// --- INTERACTION FUNCTIONS ---
// Tooltip display function
function showTooltip(event, d, nodes) {
   const tooltip = d3.select("#tooltip")
       .style("display", "block")
       .style("left", `${event.pageX}px`)
       .style("top", `${event.pageY - 320}px`);

   tooltip.html(`
       <div style="text-align: left;">
           <div style="font-weight: 500; color: ${colorScale(nodes[d.source.index].column)}">
               ${nodes[d.source.index].fullName}
           </div>
           <div style="text-align: center; margin: 5px 0;">
               <span style="font-size: 1.2em;">↓</span>
           </div>
           <div style="font-weight: 500; color: ${colorScale(nodes[d.target.index].column)}">
               ${nodes[d.target.index].fullName}
           </div>
           <hr>
           <div style="display: flex; justify-content: space-between; align-items: center;">
               <span style="font-weight: 500;">Flow Value:</span>
               <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">
                   ${formatNumber(d.value)}
               </span>
           </div>
       </div>
   `);
}

// Hide tooltip function
function hideTooltip() {
   d3.select("#tooltip").style("display", "none");
}

// Drag start function
function dragstarted(event) {
   d3.select(this)
       .raise()
       .classed("active", true);
}

// Dragging function
function dragged(event, d) {
   // Get node height
   const nodeHeight = d.y1 - d.y0;
   
   // Calculate new Y position within bounds
   const newY = Math.max(0, Math.min(innerHeight - nodeHeight, event.y));
   
   // Update Y positions keeping X fixed
   d.y0 = newY;
   d.y1 = newY + nodeHeight;
   
   // Update node position
   d3.select(this)
       .attr("transform", `translate(${d.x0},${d.y0})`);

   // Update Sankey layout
   sankey.update(sankeyData);
   
   // Update all connections
   plotG.selectAll(".link")
       .attr("d", d3.sankeyLinkHorizontal());
}

// Drag end function
function dragended(event) {
   d3.select(this)
       .classed("active", false);

   // Ensure all connections are updated
   plotG.selectAll(".link")
       .attr("d", d3.sankeyLinkHorizontal());
}

// --- LEGEND CREATION ---
function createLegends() {
   // Create attribute legend
   const attributeLegend = d3.select("#attribute-legend")
       .selectAll(".legend-item")
       .data(COLUMNS.slice(0, -1))
       .enter()
       .append("div")
       .attr("class", "legend-item");

   attributeLegend
       .append("span")
       .style("display", "inline-block")
       .style("width", "20px")
       .style("height", "20px")
       .style("background-color", d => colorScale(d))
       .style("border-radius", "4px")
       .style("margin-right", "8px");

   attributeLegend
       .append("span")
       .text(d => COLUMN_LABELS[d]);

   // Create evaluation legend
   const evaluationValues = Array.from(new Set(sankeyData.nodes
       .filter(n => n.column === 'evaluation')
       .map(n => n.name)));

   const evaluationLegend = d3.select("#evaluation-legend")
       .selectAll(".legend-item")
       .data(evaluationValues)
       .enter()
       .append("div")
       .attr("class", "legend-item");

   evaluationLegend
       .append("span")
       .style("display", "inline-block")
       .style("width", "20px")
       .style("height", "20px")
       .style("background-color", d => colorScale('evaluation'))
       .style("border-radius", "4px")
       .style("margin-right", "8px");

   evaluationLegend
       .append("span")
       .text(d => d.toUpperCase());
}

// --- INITIALIZATION ---
async function init() {
   try {
       // Load and process the data
       const response = await fetch('http://vis.lab.djosix.com:2024/data/car.data');
       const data = await response.text();
       const processedData = processData(data);
       
       // Draw the visualization and create legends
       drawSankey(processedData);
       createLegends();
   } catch (error) {
       console.error("Error loading data:", error);
       document.getElementById('sankey-diagram').innerHTML = 
           '<p style="color: red;">Error loading data. Please check the console for details.</p>';
   }
}

// Start the visualization when page loads
window.addEventListener('load', init);