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
    return { allowed, output: allowed ? "Dùng màu đã làm mềm" : "Giữ màu ban đầu" };
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
      title: "Cơ chế 1 — Một pixel có ba số",
      instruction: "Bấm một ô, rồi đổi R, G hoặc B. Màu của đúng pixel đó sẽ thay đổi.",
      question: "Cho pixel (120, 80, 40). Nếu chỉ giữ kênh đỏ, bộ ba mới là gì?",
      answers: [["(120, 0, 0)", "120,0,0"], ["(0, 80, 0)", "0,80,0"], ["(120, 80, 40)", "120,80,40"]],
      correct: "120,0,0",
      code: "pixel = pixels[row, column]\nred_only = (pixel[0], 0, 0)\nred_channel = pixels[:, :, 0]",
    },
    rgb_rule: {
      title: "Cơ chế 2 — Điều kiện RGB tạo giá trị 0 hoặc 255",
      instruction: "Chọn một pixel. Máy thay ba số vào từng phép tính rồi kiểm tra tất cả điều kiện.",
      question: "Pixel nền xanh (35, 80, 185) phải nhận giá trị nào?",
      answers: [["0 — không chọn", "0"], ["255 — chọn", "255"]],
      correct: "0",
      code: "looks_like_skin = (brightness >= 35) & (warmth >= 8) & (red_green_gap <= 90)\nraw_mask = np.where(looks_like_skin, 255, 0)",
    },
    neighbours: {
      title: "Cơ chế 3 — Đếm các pixel đạt điều kiện trong vùng 3×3",
      instruction: "Bấm từng ô để đổi giữa 0 và 1. Số 1 nghĩa là pixel đó đã đạt điều kiện RGB.",
      question: "Một vùng có 6 pixel đạt điều kiện. Nếu cần ít nhất 5 pixel, pixel giữa nhận giá trị nào?",
      answers: [["255 — giữ vùng này", "255"], ["0 — bỏ vùng này", "0"]],
      correct: "255",
      code: "binary = (raw_mask == 255).astype(np.uint8)\ncount = ndimage.convolve(binary, np.ones((3, 3)), mode=\"nearest\")\nskin_mask = np.where(count >= 5, 255, 0)",
    },
    red_spot: {
      title: "Cơ chế 4 — So với vùng xung quanh rồi mở rộng vùng chọn",
      instruction: "Xem riêng hai việc: tính trung bình vùng 5×5, rồi mở rộng một ô được chọn thành vùng 3×3.",
      question: "Một pixel có độ đỏ 120. Trung bình vùng 5×5 là 90. Mốc so sánh là 24. Pixel này có được chọn không?",
      answers: [["Có, vì 120 − 90 = 30", "yes"], ["Không, vì 120 nhỏ hơn 90", "no"]],
      correct: "yes",
      code: "local_redness = ndimage.uniform_filter(redness, size=5, mode=\"nearest\")\ncandidate = redness - local_redness >= 24\nexpanded = ndimage.maximum_filter(candidate, size=3, mode=\"nearest\")",
    },
    soften: {
      title: "Cơ chế 5 — Tính màu mềm rồi chọn màu đầu ra",
      instruction: "Bảng trọng số tạo một màu mới. pimple_mask quyết định dùng màu mới hay giữ màu ban đầu.",
      question: "Tâm là (200, 80, 80), tám pixel quanh nó là (160, 120, 100). Kết quả của bảng 1–2–1 là gì?",
      answers: [["(170, 110, 95)", "170,110,95"], ["(180, 100, 90)", "180,100,90"], ["(160, 120, 100)", "160,120,100"]],
      correct: "170,110,95",
      code: "softened = ndimage.convolve(pixels, weights, mode=\"nearest\") / weights.sum()\noutput = np.where(pimple_mask[:, :, None] == 255, softened, pixels)",
    },
    face_gate: {
      title: "Cơ chế 6 — Hai vùng cùng chọn thì pixel mới được đổi",
      instruction: "Bật hoặc tắt hai giá trị. Dấu & chỉ cho kết quả đúng khi cả hai bên đều đúng.",
      question: "face_mask = 1 nhưng skin_mask = 0. Chương trình phải làm gì?",
      answers: [["Giữ màu ban đầu", "keep"], ["Dùng màu đã làm mềm", "change"]],
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
    const left = panel("1. Chọn dữ liệu");
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
        cell.title = `Hàng ${row}, cột ${column}: ${tuple(value)}`;
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
    const right = panel("2. Máy tách ba kênh");
    const swatches = el("div", "mech-swatches");
    swatches.append(
      colourSwatch(result.pixel, `RGB ${tuple(result.pixel)}`),
      colourSwatch(result.redOnly, `Chỉ R ${tuple(result.redOnly)}`),
      colourSwatch(result.greenOnly, `Chỉ G ${tuple(result.greenOnly)}`),
      colourSwatch(result.blueOnly, `Chỉ B ${tuple(result.blueOnly)}`),
    );
    right.appendChild(swatches);
    right.appendChild(el("p", "mech-conclusion", "Đổi một số chỉ làm thay đổi kênh màu tương ứng của pixel đang chọn."));
    body.append(left, right);
  }

  function setRulePreset(state, name) {
    const values = name === "skin" ? SKIN : name === "spot" ? RED_SPOT : BLUE;
    Object.assign(state, { preset: name, red: values[0], green: values[1], blue: values[2] });
  }

  function renderRule(body, state, rerender, save) {
    const left = panel("1. Chọn một pixel");
    const choices = el("div", "mech-choices");
    [["Pixel da", "skin"], ["Pixel đỏ", "spot"], ["Nền xanh", "blue"]].forEach(([label, name]) => {
      choices.appendChild(button(label, `mech-choice${state.preset === name ? " selected" : ""}`, () => {
        setRulePreset(state, name); save(); rerender();
      }));
    });
    left.append(choices, colourSwatch([state.red, state.green, state.blue], tuple([state.red, state.green, state.blue])));

    const result = calculateRule(state);
    const right = panel("2. Thay số vào ba phép tính");
    const rows = el("div", "mech-calculations");
    rows.append(
      el("p", "", `brightness = (${state.red} + ${state.green} + ${state.blue}) // 3 = ${result.brightness}`),
      el("p", "", `warmth = ${state.red} − ${state.blue} = ${result.warmth}`),
      el("p", "", `red_green_gap = ${state.red} − ${state.green} = ${result.redGreenGap}`),
    );
    right.appendChild(rows);
    if (state.passed) {
      right.appendChild(el("p", `mech-result ${result.accepted ? "yes" : "no"}`,
        result.accepted ? "Đạt tất cả điều kiện → ghi 255" : "Có điều kiện không đạt → ghi 0"));
    } else {
      right.appendChild(el("p", "mech-locked", "Em hãy trả lời câu kiểm tra để mở kết luận 0/255."));
    }
    body.append(left, right);
  }

  function renderNeighbours(body, state, rerender, save) {
    const left = panel("1. Đổi các ô giữa 0 và 1");
    const grid = el("div", "mech-binary-grid");
    state.cells.forEach((value, index) => {
      grid.appendChild(button(String(value), `mech-binary ${value ? "on" : "off"}`, () => {
        state.cells[index] = value ? 0 : 1; save(); rerender();
      }));
    });
    left.appendChild(grid);
    const label = el("label", "mech-range");
    label.append("Số pixel tối thiểu", el("strong", "", String(state.threshold)));
    const input = el("input");
    input.type = "range"; input.min = "1"; input.max = "9"; input.value = String(state.threshold);
    input.onchange = () => { state.threshold = Number(input.value); save(); rerender(); };
    label.appendChild(input); left.appendChild(label);

    const result = calculateNeighbours(state);
    const right = panel("2. Đếm rồi so sánh");
    right.append(
      el("p", "mech-equation", `count = ${state.cells.join(" + ")} = ${result.count}`),
      el("p", "mech-equation", `${result.count} >= ${result.threshold} → ${result.accepted}`),
      el("p", `mech-result ${result.accepted ? "yes" : "no"}`,
        result.accepted ? "Đủ số pixel → skin_mask = 255" : "Chưa đủ số pixel → skin_mask = 0"),
    );
    body.append(left, right);
  }

  function renderRedSpot(body, state, rerender, save) {
    const left = panel("1. Chọn việc muốn quan sát");
    const choices = el("div", "mech-choices");
    [["Tính trung bình 5×5", "mean"], ["Mở rộng vùng chọn", "expand"]].forEach(([label, name]) => {
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
    const right = panel("2. Theo dõi đúng một kết quả");
    if (state.view === "mean") {
      right.append(
        el("p", "mech-equation", "local_redness = (161 + 24 × 68) / 25 = 71.72"),
        el("p", "mech-equation", "red_gap = 161 − 71.72 = 89.28"),
        el("p", "mech-result yes", "89.28 >= 24 → chọn pixel giữa"),
      );
    } else {
      right.append(
        el("p", "mech-equation", "Trước: 1 pixel được chọn"),
        el("p", "mech-equation", `Sau maximum_filter 3×3: ${result.expandedCount} pixel được chọn`),
        el("p", "mech-conclusion", "Việc mở rộng giúp vùng làm mềm phủ cả phần sát bên điểm đỏ."),
      );
    }
    body.append(left, right);
  }

  function renderSoften(body, state, rerender, save) {
    const left = panel("1. Tính màu mới cho pixel giữa");
    const weights = el("div", "mech-weight-grid");
    WEIGHTS.flat().forEach((value) => weights.appendChild(el("span", "", String(value))));
    left.append(
      weights,
      el("p", "mech-equation", "R = (4 × 225 + 12 × 183) / 16 = 194"),
      el("p", "mech-equation", "G = (4 × 62 + 12 × 127) / 16 = 111"),
      el("p", "mech-equation", "B = (4 × 66 + 12 × 103) / 16 = 94"),
    );

    const result = calculateSoften(state);
    const right = panel("2. Chọn màu đầu ra bằng pimple_mask");
    const choices = el("div", "mech-choices");
    [0, 255].forEach((value) => {
      choices.appendChild(button(`pimple_mask = ${value}`, `mech-choice${Number(state.mask) === value ? " selected" : ""}`, () => {
        state.mask = value; save(); rerender();
      }));
    });
    right.append(
      choices,
      colourSwatch(RED_SPOT, `Màu ban đầu ${tuple(RED_SPOT)}`),
      colourSwatch(result.softened, `Màu đã làm mềm ${tuple(result.softened)}`),
      el("p", "mech-result yes", Number(state.mask) === 255
        ? `Mask bằng 255 → đầu ra ${tuple(result.output)}`
        : `Mask bằng 0 → đầu ra vẫn là ${tuple(result.output)}`),
    );
    body.append(left, right);
  }

  function renderFace(body, state, rerender, save) {
    const left = panel("1. Bật hoặc tắt hai vùng");
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
    const right = panel("2. Tính phép AND");
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
    if (!spec || !RENDERERS[kind]) throw new Error(`Không có bảng cơ chế ${kind}`);
    const state = Object.assign(copy(DEFAULTS[kind]), copy(options.state || {}));
    if (options.completed) state.passed = true;

    const save = () => options.onChange && options.onChange(copy(state));
    const render = () => {
      host.textContent = "";
      const card = el("article", `mechanism-card${state.passed ? " passed" : ""}`);
      card.dataset.mechanism = id;
      const header = el("header", "mech-header");
      header.append(el("div", "mech-step", state.passed ? "Đã kiểm tra" : "Thử trước khi xem code"));
      header.append(el("h3", "", spec.title), el("p", "", spec.instruction));
      card.appendChild(header);
      const body = el("div", "mech-body");
      RENDERERS[kind](body, state, render, save);
      card.appendChild(body);

      const check = el("section", "mech-check");
      check.appendChild(el("h4", "", "3. Dự đoán bằng một trường hợp mới"));
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
            ? "Đúng. Kết quả này dùng cùng cơ chế, nhưng các số khác ví dụ mẫu."
            : "Chưa đúng. Hãy thay các số của câu hỏi vào đúng phép tính rồi thử lại."));
      }
      if (state.passed) {
        const code = el("div", "mech-code");
        code.append(el("h4", "", "4. Đoạn code làm cùng việc"), el("pre", "", spec.code));
        check.appendChild(code);
      } else {
        check.appendChild(el("p", "mech-locked", "Đoạn code sẽ hiện sau khi em kiểm tra đúng một trường hợp mới."));
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
