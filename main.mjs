class EventManager {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((fn) => fn !== listener);
    }
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => {
        listener(data);
      });
    }
  }
}

class ColorGradient extends EventManager {
  constructor(root) {
    super();
    this.root = root;
    this.createElements();
    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());

    let handles = [0, 0.25, 0.5, 0.75, 1];
    this.curve.addHandles(handles);

    this.curve.on("update", (e) => {
      let positions = this.curve.getHandlePositions();

      let colors = [];
      for (let position of positions) {
        let color = this.getColorAtCoordinate(position.x, position.y);
        colors.push(color);
      }

      console.log(colors, positions);

      this.emit("update", colors);
    });
  }

  createElements() {
    this.curves = this.getCurves();
    this.canvas = this.getCanvas();
    this.root.append(this.curves);
    this.root.append(this.canvas);
  }

  getCanvas() {
    let canvas = document.createElement("canvas");
    canvas.width = this.root.clientWidth;
    canvas.height = this.root.clientHeight;
    return canvas;
  }

  getCurves() {
    this.curve = new Curve(this.root.clientWidth, this.root.clientHeight);
    return this.curve.getNode();
  }

  drawColors() {
    const ctx = this.canvas.getContext("2d");
    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const hue = (x / width) * 360;
        const lightness = 100 - (y / height) * 100;
        ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  getColorAtCoordinate(x, y) {
    const ctx = this.canvas.getContext("2d");
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    const [r, g, b] = pixelData;
    return `rgb(${r}, ${g}, ${b})`;
  }

  handleResize() {
    this.canvas.width = this.root.clientWidth;
    this.canvas.height = this.root.clientHeight;
    this.curve.updateSize(this.root.clientWidth, this.root.clientHeight); // Pass updated dimensions
    this.drawColors();
  }
}

class Curve extends EventManager {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
    this.handles = [];
    this.points = this.generateRandomPoints(5);
    this.selected = this.points[0];
    this.svg = this.createSVG();
    this.addStyles();
    this.addRect();
    this.addPath();
    this.addEventListeners();
    this.update();
  }

  addHandles(handles = []) {
    this.handles = handles;
    this.update();
  }

  updateSize(width, height) {
    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = width;
    this.height = height;

    // Adjust point positions based on canvas resize
    this.points = this.points.map((point) => [
      (point[0] / oldWidth) * this.width,
      (point[1] / oldHeight) * this.height,
    ]);

    // Update SVG attributes and elements
    this.svg.attr("viewBox", [0, 0, this.width, this.height]);
    this.svg
      .select("rect")
      .attr("width", this.width)
      .attr("height", this.height);
    this.update();
  }

  generateRandomPoints(count) {
    return d3
      .range(1, count)
      .map((i) => [
        (i * this.width) / count,
        50 + Math.random() * (this.height - 100),
      ]);
  }

  createSVG() {
    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, this.width, this.height])
      .attr("tabindex", 1)
      .attr("pointer-events", "all")
      .call(
        d3
          .drag()
          .subject((e) => this.dragsubject(e))
          .on("start", (e) => this.dragstarted(e))
          .on("drag", (e) => this.dragged(e))
      );
    this.svg = svg;
    return svg;
  }

  addStyles() {
    this.svg.append("style").text(`
            svg[tabindex] {
                display: block;
                margin: 0 -14px;
                border: solid 2px transparent;
                box-sizing: border-box;
            }
            svg[tabindex]:focus {
                outline: none;
                border: solid 2px lightblue;
            }
        `);
  }

  addRect() {
    this.svg
      .append("rect")
      .attr("fill", "none")
      .attr("width", this.width)
      .attr("height", this.height);
  }

  addPath() {
    this.svg
      .append("path")
      .datum(this.points)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1.5);
  }

  addEventListeners() {
    d3.select(window).on("keydown", (event) => this.keydown(event));
  }

  update() {
    this.svg
      .select("path")
      .attr("d", d3.line().curve(d3.curveBasis)(this.points))
      .attr("stroke", "#ffffff55")
      .attr("stroke-width", 20);

    this.drawDotsAtPercentages(this.handles);

    const handles = this.svg.selectAll("circle.handle").data(this.points);

    handles
      .enter()
      .append("circle")
      .attr("class", "handle")
      .attr("r", 8)
      .attr("cx", (d) => d[0])
      .attr("cy", (d) => d[1])
      .call((enter) =>
        enter.transition().duration(750).ease(d3.easeElastic).attr("r", 5)
      )
      .merge(handles)
      .attr("fill", (d) => (d === this.selected ? "lightblue" : "black"))
      .attr("cx", (d) => d[0])
      .attr("cy", (d) => d[1]);

    handles.exit().remove();

    this.emit("update");
  }

  drawDotsAtPercentages(percentages) {
    for (let percentage of percentages) {
      this.drawDotAtPercentage(percentage);
    }
  }

  drawDotAtPercentage(percentage) {
    const totalLength = this.svg.select("path").node().getTotalLength();
    const pointAtPercentage = this.svg
      .select("path")
      .node()
      .getPointAtLength(totalLength * percentage);

    this.createDot(percentage, pointAtPercentage);
  }

  getHandlePositions() {
    let all = [];
    for (let handle of this.handles) {
      all.push(this.getPositionAtPercentage(handle));
    }
    return all;
  }

  getPositionAtPercentage(percentage) {
    const path = this.svg.select("path").node();
    const totalLength = path.getTotalLength();
    const pointAtPercentage = path.getPointAtLength(totalLength * percentage);

    const svgRect = this.svg.node().getBoundingClientRect();
    const point = {
      x: svgRect.left + pointAtPercentage.x,
      y: svgRect.top + pointAtPercentage.y,
    };
    return point;
  }

  createDot(percentage, point) {
    this.svg.select(`[percentage="${percentage}"]`).remove();
    this.svg
      .append("circle")
      .attr("percentage", percentage)
      .attr("cx", point.x)
      .attr("cy", point.y)
      .attr("r", 8)
      .attr("fill", "red");
  }

  dragsubject(event) {
    let subject = event.sourceEvent.target.__data__;
    // if (!subject) {
    // 	this.updatePoints([event.x, event.y]);
    // }
    return subject;
  }

  dragstarted({ subject }) {
    this.selected = subject;
    this.update();
  }

  dragged(event) {
    event.subject[0] = Math.max(-14, Math.min(this.width + 14, event.x));
    event.subject[1] = Math.max(0, Math.min(this.height, event.y));
    this.updatePoints(this.points);
    this.update();
  }

  updatePoints(newPoints) {
    this.points = newPoints;
  }

  keydown(event) {
    if (!this.selected) return;
    switch (event.key) {
      case "Backspace":
      case "Delete": {
        event.preventDefault();
        this.deleteSelectedPoint();
        this.update();
        break;
      }
    }
  }

  deleteSelectedPoint() {
    const i = this.points.indexOf(this.selected);
    this.points.splice(i, 1);
    this.selected = this.points.length ? this.points[i > 0 ? i - 1 : 0] : null;
  }

  getNode() {
    return this.svg.node();
  }
}

class Palette extends EventManager {
  constructor(targetDiv, colors) {
    super();
    this.targetDiv = targetDiv;
    this.colors = colors || [];

    this.drawColors();
  }

  drawColors() {
    this.colors.forEach((color, index) => {
      const colorDiv = document.createElement("div");
      colorDiv.style.backgroundColor = color;
      colorDiv.style.width = "50px";
      colorDiv.style.height = "50px";
      colorDiv.style.border = "1px solid black";
      colorDiv.style.display = "inline-block";
      colorDiv.style.margin = "5px";
      colorDiv.addEventListener("click", () => {
        this.emit("colorSelected", { color: color, index: index });
      });

      this.targetDiv.appendChild(colorDiv);
    });
  }

  updateColors(newColors) {
    console.log(newColors);
    this.colors = newColors || [];
    this.targetDiv.innerHTML = "";
    this.drawColors();
  }
}

function main() {
  let colorRoot = document.querySelector(".colors");
  let palette = new Palette(colorRoot, []);

  let root = document.querySelector(".color-gradient");
  const colorGradient = new ColorGradient(root);
  colorGradient.on("update", (colors) => {
    palette.updateColors(colors);
  });
}

let d3 = null;
const load = async () => {
  d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
  console.log(d3);
  main();
};

load();
