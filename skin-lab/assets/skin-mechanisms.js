(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SkinMechanisms = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SKIN = [183, 127, 103];
  const RED_SPOT = [225, 62, 66];
  const BLUE = [35, 80, 185];
  const WEIGHTS = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];

  const copy = (value) => JSON.parse(JSON.stringify(value));
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const rgb = (value) => `rgb(${value.join(",")})`;
  const tuple = (value) => `(${value.join(", ")})`;

  function pixelAt(row, column) {
    if (row === 3 && column === 3) return RED_SPOT.slice();
    if (row === 0 || row === 6 || column === 0 || column === 6) return BLUE.slice();
    return SKIN.slice();
  }

  function calculateRgb(state) {
    const pixel = [Number(state.red), Number(state.green), Number(state.blue)];
    return {
      pixel,
      redOnly: [pixel[0], 0, 0],
      greenOnly: [0, pixel[1], 0],
      blueOnly: [0, 0, pixel[2]],
    };
  }

  function calculateRule(state) {
    const red = Number(state.red), green = Number(state.green), blue = Number(state.blue);
    const brightness = Math.floor((red + green + blue) / 3);
    const warmth = red - blue;
    const redGreenGap = red - green;
    const accepted = brightness >= 35 && brightness <= 240
      && warmth >= 8 && redGreenGap >= -10 && redGreenGap <= 90;
    return { brightness, warmth, redGreenGap, accepted, mask: accepted ? 255 : 0 };
  }

  function calculateNeighbours(state) {
    const count = sum(state.cells.map(Number));
    const threshold = Number(state.threshold);
    return { count, threshold, accepted: count >= threshold, mask: count >= threshold ? 255 : 0 };
  }

  function calculateRedSpot() {
    const localAverage = (161 + 24 * 68) / 25;
    const gap = 161 - localAverage;
    return { localAverage, gap, accepted: gap >= 24, expandedCount: 9 };
  }

  function weightedColour(center, neighbour) {
    return center.map((value, channel) => Math.round((4 * value + 12 * neighbour[channel]) / 16));
  }

  function calculateSoften(state) {
    const softened = weightedColour(RED_SPOT, SKIN);
    const checkpoint = weightedColour([200, 80, 80], [160, 120, 100]);
    return {
      softened,
      checkpoint,
      output: Number(state.mask) === 255 ? softened : RED_SPOT.slice(),
    };
  }

  function calculateFace(state) {
    const allowed = Boolean(Number(state.face)) && Boolean(Number(state.skin));
    return { allowed, output: allowed ? "Use the smoothed colour" : "Keep the original colour" };
  }

  const DEFAULTS = {
    rgb_pixel: { row: 3, column: 3, red: 225, green: 62, blue: 66, answer: "", passed: false },
    rgb_rule: { preset: "skin", red: 183, green: 127, blue: 103, answer: "", passed: false },
    neighbours: { cells: [1, 1, 1, 1, 0, 1, 1, 1, 1], threshold: 5, answer: "", passed: false },
    red_spot: { view: "mean", answer: "", passed: false },
    soften: { mask: 255, answer: "", passed: false },
    face_gate: { face: 1, skin: 1, answer: "", passed: false },
  };

  const SPECS = {
    rgb_pixel: {
      title: "Mechanism 1 — One pixel has three numbers",
      instruction: "Select a pixel, then change R, G, or B. Watch the selected pixel and the separated channels.",
      question: "A pixel is (120, 80, 40). If the code keeps only red, what is the new triplet?",
      answers: [["(120, 0, 0)", "120,0,0"], ["(0, 80, 0)", "0,80,0"], ["(120, 80, 40)", "120,80,40"]],
      correct: "120,0,0",
      code: "pixel = pixels[row, column]\nred_only = (pixel[0], 0, 0)\nred_channel = pixels[:, :, 0]",
    },
    rgb_rule: {
      title: "Mechanism 2 — RGB conditions produce 0 or 255",
      instruction: "Choose a pixel. The panel substitutes its three values and checks every condition.",
      question: "What mask value should the blue background pixel (35, 80, 185) receive?",
      answers: [["0 — do not select", "0"], ["255 — select", "255"]],
      correct: "0",
      code: "looks_like_skin = (brightness >= 35) & (warmth >= 8) & (red_green_gap <= 90)\nraw_mask = np.where(looks_like_skin, 255, 0)",
    },
    neighbours: {
      title: "Mechanism 3 — Count passing pixels in a 3 × 3 area",
      instruction: "Click a cell to switch between 0 and 1. A 1 means that pixel passed the RGB rule.",
      question: "An area contains 6 passing pixels. If at least 5 are required, what value should the centre receive?",
      answers: [["255 — keep this region", "255"], ["0 — reject this region", "0"]],
      correct: "255",
      code: "binary = (raw_mask == 255).astype(np.uint8)\ncount = ndimage.convolve(binary, np.ones((3, 3)), mode=\"nearest\")\nskin_mask = np.where(count >= 5, 255, 0)",
    },
    red_spot: {
      title: "Mechanism 4 — Compare locally, then expand the selection",
      instruction: "Inspect two operations separately: the 5 × 5 local mean and the 3 × 3 expansion.",
      question: "A pixel's redness is 120, the 5 × 5 mean is 90, and the threshold is 24. Is it selected?",
      answers: [["Yes, because 120 − 90 = 30", "yes"], ["No, because 120 is below 90", "no"]],
      correct: "yes",
      code: "local_redness = ndimage.uniform_filter(redness, size=5, mode=\"nearest\")\ncandidate = redness - local_redness >= 24\nexpanded = ndimage.maximum_filter(candidate, size=3, mode=\"nearest\")",
    },
    soften: {
      title: "Mechanism 5 — Calculate a smooth colour, then choose the output",
      instruction: "The kernel calculates a new colour. pimple_mask decides whether the output uses it.",
      question: "The centre is (200, 80, 80); all eight neighbours are (160, 120, 100). What does the 1–2–1 kernel produce?",
      answers: [["(170, 110, 95)", "170,110,95"], ["(180, 100, 90)", "180,100,90"], ["(160, 120, 100)", "160,120,100"]],
      correct: "170,110,95",
      code: "softened = ndimage.convolve(pixels, weights, mode=\"nearest\") / weights.sum()\noutput = np.where(pimple_mask[:, :, None] == 255, softened, pixels)",
    },
    face_gate: {
      title: "Mechanism 6 — Both masks must allow the change",
      instruction: "Switch both values. The & operation is true only when both sides are true.",
      question: "face_mask = 1 but skin_mask = 0. What must the program do?",
      answers: [["Keep the original colour", "keep"], ["Use the smoothed colour", "change"]],
      correct: "keep",
      code: "allowed = face_mask & skin_mask\noutput = np.where(allowed[..., None], cleaned, original)",
    },
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, className, onClick) {
    const node = el("button", className, text);
    node.type = "button";
    node.onclick = onClick;
    return node;
  }

  function panel(title) {
    const node = el("section", "mech-panel");
    node.appendChild(el("h4", "", title));
    return node;
  }

  function colourSwatch(value, label) {
    const node = el("div", "mech-swatch");
    node.style.background = rgb(value);
    node.appendChild(el("span", "", label || tuple(value)));
    return node;
  }

  function renderRgb(body, state, rerender, save) {
    const left = panel("1. Choose a pixel");
    const grid = el("div", "mech-pixel-grid");
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const value = row === state.row && column === state.column
          ? [state.red, state.green, state.blue] : pixelAt(row, column);
        const cell = button("", `mech-pixel${row === state.row && column === state.column ? " selected" : ""}`, () => {
          const picked = pixelAt(row, column);
          Object.assign(state, { row, column, red: picked[0], green: picked[1], blue: picked[2] });
          save(); rerender();
        });
        cell.style.background = rgb(value);
        cell.title = `Row ${row}, column ${column}: ${tuple(value)}`;
        grid.appendChild(cell);
      }
    }
    left.appendChild(grid);
    left.appendChild(el("p", "mech-readout", `pixels[${state.row}, ${state.column}] = (${state.red}, ${state.green}, ${state.blue})`));
    [["R", "red"], ["G", "green"], ["B", "blue"]].forEach(([label, key]) => {
      const row = el("label", "mech-range");
      row.append(label, el("strong", "", String(state[key])));
      const input = el("input");
      input.type = "range"; input.min = "0"; input.max = "255"; input.value = String(state[key]);
      input.onchange = () => { state[key] = Number(input.value); save(); rerender(); };
      row.appendChild(input); left.appendChild(row);
    });

    const result = calculateRgb(state);
    const right = panel("2. Separate the three channels");
    const swatches = el("div", "mech-swatches");
    swatches.append(
      colourSwatch(result.pixel, `RGB ${tuple(result.pixel)}`),
      colourSwatch(result.redOnly, `Red only ${tuple(result.redOnly)}`),
      colourSwatch(result.greenOnly, `Green only ${tuple(result.greenOnly)}`),
      colourSwatch(result.blueOnly, `Blue only ${tuple(result.blueOnly)}`),
    );
    right.appendChild(swatches);
    right.appendChild(el("p", "mech-conclusion", "Changing one number changes the matching colour channel of the selected pixel."));
    body.append(left, right);
  }

  function setRulePreset(state, name) {
    const values = name === "skin" ? SKIN : name === "spot" ? RED_SPOT : BLUE;
    Object.assign(state, { preset: name, red: values[0], green: values[1], blue: values[2] });
  }

  function renderRule(body, state, rerender, save) {
    const left = panel("1. Choose a pixel");
    const choices = el("div", "mech-choices");
    [["Skin-coloured pixel", "skin"], ["Red pixel", "spot"], ["Blue background", "blue"]].forEach(([label, name]) => {
      choices.appendChild(button(label, `mech-choice${state.preset === name ? " selected" : ""}`, () => {
        setRulePreset(state, name); save(); rerender();
      }));
    });
    left.append(choices, colourSwatch([state.red, state.green, state.blue], tuple([state.red, state.green, state.blue])));

    const result = calculateRule(state);
    const right = panel("2. Substitute the numbers");
    const rows = el("div", "mech-calculations");
    rows.append(
      el("p", "", `brightness = (${state.red} + ${state.green} + ${state.blue}) // 3 = ${result.brightness}`),
      el("p", "", `warmth = ${state.red} − ${state.blue} = ${result.warmth}`),
      el("p", "", `red_green_gap = ${state.red} − ${state.green} = ${result.redGreenGap}`),
    );
    right.appendChild(rows);
    if (state.passed) {
      right.appendChild(el("p", `mech-result ${result.accepted ? "yes" : "no"}`,
        result.accepted ? "Every condition passes → write 255" : "At least one condition fails → write 0"));
    } else {
      right.appendChild(el("p", "mech-locked", "Answer the new case below to reveal the 0/255 conclusion."));
    }
    body.append(left, right);
  }

  function renderNeighbours(body, state, rerender, save) {
    const left = panel("1. Switch cells between 0 and 1");
    const grid = el("div", "mech-binary-grid");
    state.cells.forEach((value, index) => {
      grid.appendChild(button(String(value), `mech-binary ${value ? "on" : "off"}`, () => {
        state.cells[index] = value ? 0 : 1; save(); rerender();
      }));
    });
    left.appendChild(grid);
    const label = el("label", "mech-range");
    label.append("Minimum passing pixels", el("strong", "", String(state.threshold)));
    const input = el("input");
    input.type = "range"; input.min = "1"; input.max = "9"; input.value = String(state.threshold);
    input.onchange = () => { state.threshold = Number(input.value); save(); rerender(); };
    label.appendChild(input); left.appendChild(label);

    const result = calculateNeighbours(state);
    const right = panel("2. Count, then compare");
    right.append(
      el("p", "mech-equation", `count = ${state.cells.join(" + ")} = ${result.count}`),
      el("p", "mech-equation", `${result.count} >= ${result.threshold} → ${result.accepted}`),
      el("p", `mech-result ${result.accepted ? "yes" : "no"}`,
        result.accepted ? "Enough pixels pass → skin_mask = 255" : "Too few pixels pass → skin_mask = 0"),
    );
    body.append(left, right);
  }

  function renderRedSpot(body, state, rerender, save) {
    const left = panel("1. Choose one operation to inspect");
    const choices = el("div", "mech-choices");
    [["Calculate the 5 × 5 mean", "mean"], ["Expand the selection", "expand"]].forEach(([label, name]) => {
      choices.appendChild(button(label, `mech-choice${state.view === name ? " selected" : ""}`, () => {
        state.view = name; save(); rerender();
      }));
    });
    left.appendChild(choices);
    const grid = el("div", `mech-five-grid ${state.view}`);
    for (let index = 0; index < 25; index += 1) {
      const middle = index === 12;
      const selected = state.view === "expand" && [6, 7, 8, 11, 12, 13, 16, 17, 18].includes(index);
      const value = state.view === "mean" ? (middle ? 161 : 68) : (selected ? 1 : 0);
      grid.appendChild(el("span", `${middle ? "middle " : ""}${selected ? "selected" : ""}`, String(value)));
    }
    left.appendChild(grid);

    const result = calculateRedSpot();
    const right = panel("2. Follow one result");
    if (state.view === "mean") {
      right.append(
        el("p", "mech-equation", "local_redness = (161 + 24 × 68) / 25 = 71.72"),
        el("p", "mech-equation", "red_gap = 161 − 71.72 = 89.28"),
        el("p", "mech-result yes", "89.28 >= 24 → select the centre pixel"),
      );
    } else {
      right.append(
        el("p", "mech-equation", "Before: 1 selected pixel"),
        el("p", "mech-equation", `After maximum_filter 3 × 3: ${result.expandedCount} selected pixels`),
        el("p", "mech-conclusion", "Expansion lets the blend include the area immediately around the red point."),
      );
    }
    body.append(left, right);
  }

  function renderSoften(body, state, rerender, save) {
    const left = panel("1. Calculate a new centre colour");
    const weights = el("div", "mech-weight-grid");
    WEIGHTS.flat().forEach((value) => weights.appendChild(el("span", "", String(value))));
    left.append(
      weights,
      el("p", "mech-equation", "R = (4 × 225 + 12 × 183) / 16 = 194"),
      el("p", "mech-equation", "G = (4 × 62 + 12 × 127) / 16 = 111"),
      el("p", "mech-equation", "B = (4 × 66 + 12 × 103) / 16 = 94"),
    );

    const result = calculateSoften(state);
    const right = panel("2. Choose the output with pimple_mask");
    const choices = el("div", "mech-choices");
    [0, 255].forEach((value) => {
      choices.appendChild(button(`pimple_mask = ${value}`, `mech-choice${Number(state.mask) === value ? " selected" : ""}`, () => {
        state.mask = value; save(); rerender();
      }));
    });
    right.append(
      choices,
      colourSwatch(RED_SPOT, `Original ${tuple(RED_SPOT)}`),
      colourSwatch(result.softened, `Smoothed ${tuple(result.softened)}`),
      el("p", "mech-result yes", Number(state.mask) === 255
        ? `Mask is 255 → output ${tuple(result.output)}`
        : `Mask is 0 → output remains ${tuple(result.output)}`),
    );
    body.append(left, right);
  }

  function renderFace(body, state, rerender, save) {
    const left = panel("1. Switch the two masks");
    [["face_mask", "face"], ["skin_mask", "skin"]].forEach(([label, key]) => {
      const row = el("div", "mech-toggle-row");
      row.append(el("strong", "", label));
      [0, 1].forEach((value) => row.appendChild(button(String(value),
        `mech-choice${Number(state[key]) === value ? " selected" : ""}`, () => {
          state[key] = value; save(); rerender();
        })));
      left.appendChild(row);
    });
    const result = calculateFace(state);
    const right = panel("2. Calculate AND");
    right.append(
      el("p", "mech-equation", `${state.face} & ${state.skin} → ${result.allowed}`),
      el("p", `mech-result ${result.allowed ? "yes" : "no"}`, result.output),
    );
    const table = el("div", "mech-truth-table");
    [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]].forEach((row) => {
      const active = row[0] === Number(state.face) && row[1] === Number(state.skin);
      table.appendChild(el("span", active ? "active" : "", `${row[0]} & ${row[1]} → ${row[2]}`));
    });
    right.appendChild(table);
    body.append(left, right);
  }

  const RENDERERS = {
    rgb_pixel: renderRgb,
    rgb_rule: renderRule,
    neighbours: renderNeighbours,
    red_spot: renderRedSpot,
    soften: renderSoften,
    face_gate: renderFace,
  };

  function mount(host, options) {
    const id = options.id, kind = options.kind;
    const spec = SPECS[kind];
    if (!spec || !RENDERERS[kind]) throw new Error(`No mechanism panel exists for ${kind}`);
    const state = Object.assign(copy(DEFAULTS[kind]), copy(options.state || {}));
    if (options.completed) state.passed = true;

    const save = () => options.onChange && options.onChange(copy(state));
    const render = () => {
      host.textContent = "";
      const card = el("article", `mechanism-card${state.passed ? " passed" : ""}`);
      card.dataset.mechanism = id;
      const header = el("header", "mech-header");
      header.append(el("div", "mech-step", state.passed ? "Checked" : "Predict before seeing the code"));
      header.append(el("h3", "", spec.title), el("p", "", spec.instruction));
      card.appendChild(header);
      const body = el("div", "mech-body");
      RENDERERS[kind](body, state, render, save);
      card.appendChild(body);

      const check = el("section", "mech-check");
      check.appendChild(el("h4", "", "3. Predict a new case"));
      check.appendChild(el("p", "", spec.question));
      const answers = el("div", "mech-answers");
      spec.answers.forEach(([label, value]) => {
        answers.appendChild(button(label,
          `mech-answer${state.answer === value ? " selected" : ""}`,
          () => {
            state.answer = value;
            if (value === spec.correct) {
              state.passed = true;
              if (options.onPass) options.onPass(id);
            }
            save(); render();
          }));
      });
      check.appendChild(answers);
      if (state.answer) {
        check.appendChild(el("p", state.passed ? "mech-feedback correct" : "mech-feedback wrong",
          state.passed
            ? "Correct. This new case uses the same mechanism with different numbers."
            : "Not yet. Substitute the question's numbers into the calculation and try again."));
      }
      if (state.passed) {
        const code = el("div", "mech-code");
        code.append(el("h4", "", "4. Code that performs the same operation"), el("pre", "", spec.code));
        check.appendChild(code);
      } else {
        check.appendChild(el("p", "mech-locked", "The code appears after you solve one new case correctly."));
      }
      card.appendChild(check);
      host.appendChild(card);
    };

    render();
    return { getState: () => copy(state) };
  }

  return {
    mount,
    pixelAt,
    calculateRgb,
    calculateRule,
    calculateNeighbours,
    calculateRedSpot,
    calculateSoften,
    calculateFace,
    defaults: () => copy(DEFAULTS),
  };
}));
