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

/**
 * KeyboardManager
 */
class KeyboardManager extends EventManager {
  /**
   * create a new KeyboardManager
   */
  constructor() {
    super();
    this.keys = {};
    this.init();
  }

  init() {
    window.addEventListener("keydown", (event) => {
      let key = event.key.toLowerCase();
      this.keys[key] = true;
      this.emit("keydown", event);
      this.emit(`keydown:${key}`, event);
    });

    window.addEventListener("keyup", (event) => {
      let key = event.key.toLowerCase();
      this.keys[key] = false;
      this.emit("keyup", event);
      this.emit(`keyup:${key}`, event);
    });

    window.addEventListener("keypress", (event) => {
      let key = event.key.toLowerCase();
      console.log(this.keys);
      this.emit("keypress", event);
      this.emit(`keypress:${key}`, event);
    });
  }

  /**
   * Test if keys are pressed
   * @param {Array} keys
   */
  test(keys = []) {
    let pressed = true;
    for (let key of keys) {
      if (!this.keys[key]) {
        pressed = false;
      }
    }
    return pressed;
  }
}

class Curve extends EventManager {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
    this.handles = [];
    this.guideAmount = 10;
    this.guides = [...Array(this.guideAmount).keys()].map(
      (i) => i / (this.guideAmount - 1)
    );

    // uids
    this.pathID = "path";
    this.handleID = "handle";
    this.styling = {
      // curve
      curve: {
        stroke: "#ffffff55",
        fill: "none",
        strokeWidth: 20,
      },
      // handle
      handle: {
        fill: "#fff",
        r: 7,
      },
    };

    this.keyboardManager = new KeyboardManager();

    this.init();
  }

  // Initialization functions
  // ------------------------

  // init
  init() {
    this.svg = this.createSVG();
    this.handles = this.createDefaultHandles();

    this.initSVGEvents(this.svg);
    this.initEvents();

    this.updateSize(this.width, this.height);
    this.update();
  }

  // init SVG events
  initSVGEvents(svg) {
    // drag
    svg.call(
      d3
        .drag()
        .on("start", (event) => this.emit("dragstart", event))
        .on("drag", (event) => this.emit("drag", event))
        .on("end", (event) => this.emit("dragend", event))
    );
  }

  // handle all events
  initEvents() {
    this.handleEvents = [];

    this.keyboardManager.on("keyup:delete", (event) => {
      console.log(this.handles, this.selectedHandle);

      if (this.selectedHandle) {
        this.handles = this.handles.filter(
          (handle) => handle !== this.selectedHandle
        );
        this.update();
      }
    });
    // nothing yet
  }

  // handle events
  initHandleEvents(handles) {
    // remove old events
    this.handleEvents.forEach((eventSetup) => this.off(...eventSetup));

    // remove event from array
    this.handleEvents = [];

    // handle dragging and click events
    handles
      .call(
        d3
          .drag()
          .on("start", (event) => this.emit("handle:dragstart", event))
          .on("drag", (event) => this.emit("handle:drag", event))
          .on("end", (event) => this.emit("handle:dragend", event))
      )
      .on("click", (event) =>
        this.emit("handle:click", {
          subject: event.target.__data__,
        })
      );

    // handle dragging
    const handleDrag = (event) => {
      event.subject[0] = event.x;
      event.subject[1] = event.y;
      this.update();
    };
    this.on("handle:drag", handleDrag);
    this.handleEvents.push(["handle:drag", handleDrag]);

    // handle new handle on shift drag
    const handleDragStart = (event) => {
      if (this.keyboardManager.test(["shift"])) {
        this.handles.push([event.x, event.y]);
      }
    };
    this.on("handle:dragstart", handleDragStart);
    this.handleEvents.push(["handle:dragstart", handleDragStart]);

    // handle selection
    ["handle:click", "handle:dragstart"].forEach((type) => {
      const handleClick = (event) => {
        this.selectedHandle = event.subject;
      };
      this.on(type, handleClick);
      this.handleEvents.push([type, handleClick]);
    });
  }

  // Getters
  // -------

  // get node
  getNode() {
    return this.svg.node();
  }

  // Create functions
  // ----------------

  // get node
  createSVG() {
    const svg = d3
      .create("svg")
      .attr("viewBox", [0, 0, this.width, this.height])
      .attr("tabindex", 1)
      .attr("pointer-events", "all");

    this.svg = svg;
    return svg;
  }

  // get handles
  createDefaultHandles() {
    let handles = [
      [this.width / 2, this.height / 4],
      [this.width / 2, this.height / 1.5],
    ];
    return handles;
  }

  // create guides
  createGuides(guides) {
    guides = guides
      .enter()
      .append("circle")
      .attr("class", "guide")
      .merge(guides)
      // pointer events none
      .attr("pointer-events", "none");

    return guides;
  }

  // create handle
  createHandles(handles) {
    handles = handles
      .enter()
      .append("circle")
      .attr("class", this.handleID)
      .merge(handles);

    this.initHandleEvents(handles);

    return handles;
  }

  // Update functions
  // ----------------

  // update size
  updateSize(width, height) {
    this.width = width;
    this.height = height;

    // Update SVG attributes and elements
    this.svg.attr("viewBox", [0, 0, this.width, this.height]);
    this.svg
      .select("rect")
      .attr("width", this.width)
      .attr("height", this.height);

    // Adjust point positions based on canvas resize
    this.handles = this.handles.map((point) => [
      (point[0] / this.width) * this.width,
      (point[1] / this.height) * this.height,
    ]);

    this.update();
  }

  // update svg
  update() {
    this.drawCurve(this.handles);
    this.drawGuides(this.guides);
    this.drawHandles(this.handles);
  }

  // Draw functions
  // --------------

  // draw Curve
  drawCurve(points = []) {
    // get path element
    let path = this.svg.select(`#${this.pathID}`);

    // create path if it doesn't exist
    if (path.empty()) {
      path = this.svg.append("path").attr("id", this.pathID);
    }

    // update path
    path.attr("d", d3.line().curve(d3.curveBasis)(points));

    // style path
    this.styleCurve(path);
  }

  drawGuides(fractions = []) {
    let points = [];
    for (let fraction of fractions) {
      let path = this.svg.select(`#${this.pathID}`).node();
      const totalLength = path.getTotalLength();
      const pointAtPercentage = path.getPointAtLength(totalLength * fraction);

      points.push([pointAtPercentage.x, pointAtPercentage.y]);
    }

    // get guide elements
    let guides = this.svg.selectAll(".guide").data(points);

    // add extra guides if needed
    if (guides.size() < points.length) {
      guides = this.createGuides(guides);
    }

    // update guides
    guides.attr("cx", (d) => d[0]).attr("cy", (d) => d[1]);

    // style guides
    this.styleGuide(guides);
  }

  // drag Handles
  drawHandles(points = []) {
    // get handle elements
    let handles = this.svg.selectAll(`.${this.handleID}`).data(points);

    // add extra handles if needed
    if (handles.size() < points.length) {
      handles = this.createHandles(handles);
    }

    // update handles
    handles.attr("cx", (d) => d[0]).attr("cy", (d) => d[1]);

    // style handles
    this.styleHandle(handles);
  }

  // Styling functions
  // -----------------

  // style curve
  styleCurve(path) {
    path
      .attr("stroke", this.styling?.curve?.stroke || "white")
      .attr("fill", this.styling?.curve?.fill || "none")
      .attr("stroke-width", this.styling?.curve?.strokeWidth || 20)
      .attr("stroke-linecap", "round");
  }

  // style handles
  styleHandle(handle) {
    handle
      .attr("fill", this.styling?.handle?.fill || "white")
      .attr("r", this.styling?.handle?.r || 10);
  }

  // style guides
  styleGuide(guides) {
    guides
      .attr("fill", this.styling?.guide?.fill || "black")
      .attr("r", this.styling?.guide?.r || 5)
      // draw on top
      .raise();
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
const loadDependencies = async () => {
  d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
  console.log(d3);
  main();
};

loadDependencies();
