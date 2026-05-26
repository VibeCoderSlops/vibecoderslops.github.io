/* =========================
   Setup
========================= */

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  alert("WebGL not supported");
}

const errorBox = document.getElementById("error");
const shaderEditor = document.getElementById("shaderCode");
const highlighting = document.getElementById("highlighting");
const runBtn = document.getElementById("runBtn");

const divider = document.getElementById("divider");
const preview = document.getElementById("preview");
const editorPanel = document.getElementById("editor-panel");

const lineNumbers = document.getElementById("line-numbers");

/* =========================
   Resize Panels
========================= */

let isResizing = false;

divider.addEventListener("mousedown", () => {
  isResizing = true;
  document.body.style.cursor = "col-resize";
});

window.addEventListener("mousemove", (e) => {

  if (!isResizing) return;

  const totalWidth = window.innerWidth;

  const leftWidth = e.clientX;
  const rightWidth = totalWidth - leftWidth;

  if (leftWidth < 200 || rightWidth < 250) {
    return;
  }

  preview.style.width = `${leftWidth}px`;
  editorPanel.style.width = `${rightWidth}px`;

  resizeCanvas();
});

window.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.style.cursor = "default";
});

function updateLineNumbers() {

  const lines =
    shaderEditor.value.split("\n").length;

  let numbers = "";

  for (let i = 1; i <= lines; i++) {
    numbers += i + "\n";
  }

  lineNumbers.textContent = numbers;
}

/* =========================
   Slots
========================= */

const fileInputs = {};

function openFilePicker(unit) {
  if (!fileInputs[unit]) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const img = new Image();

      img.onload = () => {
        createTexture(img, unit);

        document.getElementById(`preview${unit}`).src = img.src;
      };

      img.src = URL.createObjectURL(file);
    });

    fileInputs[unit] = input;
  }

  fileInputs[unit].click();
}

document.querySelectorAll(".texture-preview").forEach((el) => {
  const unit = parseInt(el.dataset.texture);

  el.addEventListener("click", () => {
    openFilePicker(unit);
  });

  // стартовое состояние = чёрный
  el.style.background = "black";
});

/* =========================
   Syntax Highlighting
========================= */

const TYPES = [
  "float",
  "vec2",
  "vec3",
  "vec4",
  "int",
  "mat2",
  "mat3",
  "mat4",
  "sampler2D",
  "void",
  "bool"
];

const BUILTINS = [
  "sin",
  "cos",
  "tan",
  "normalize",
  "texture",
  "dot",
  "mix",
  "length",
  "fract",
  "smoothstep",
  "clamp",
  "pow"
];

const KEYWORDS = [
  "uniform",
  "attribute",
  "varying",
  "return",
  "if",
  "else",
  "for"
];

function escapeHtml(text) {

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightCode(code) {

  code = escapeHtml(code);

  /* Comments */

  code = code.replace(
    /(\/\/.*)/g,
    '<span class="comment">$1</span>'
  );

  /* Numbers */

  code = code.replace(
    /\b(\d+(\.\d+)?)\b/g,
    '<span class="number">$1</span>'
  );

  /* Types */

  const typeRegex = new RegExp(
    `\\b(${TYPES.join("|")})\\b`,
    "g"
  );

  code = code.replace(
    typeRegex,
    '<span class="type">$1</span>'
  );

  /* Builtins */

  const builtinRegex = new RegExp(
    `\\b(${BUILTINS.join("|")})\\b`,
    "g"
  );

  code = code.replace(
    builtinRegex,
    '<span class="builtin">$1</span>'
  );

  /* Keywords */

  const keywordRegex = new RegExp(
    `\\b(${KEYWORDS.join("|")})\\b`,
    "g"
  );

  code = code.replace(
    keywordRegex,
    '<span class="keyword">$1</span>'
  );

  /* Functions */

  code = code.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,
    (match) => {

      if (BUILTINS.includes(match)) {
        return match;
      }

      return `<span class="function">${match}</span>`;
    }
  );

  return code;
}

function updateHighlighting() {

  highlighting.innerHTML =
    highlightCode(shaderEditor.value);

  updateLineNumbers();
}

shaderEditor.addEventListener(
  "input",
  updateHighlighting
);

const AUTO_CLOSE = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'"
};

shaderEditor.addEventListener(
  "keydown",
  (e) => {

    const closeChar =
      AUTO_CLOSE[e.key];

    if (!closeChar) {
      return;
    }

    e.preventDefault();

    const start =
      shaderEditor.selectionStart;

    const end =
      shaderEditor.selectionEnd;

    const value =
      shaderEditor.value;

    shaderEditor.value =
      value.slice(0, start) +
      e.key +
      closeChar +
      value.slice(end);

    shaderEditor.selectionStart =
      shaderEditor.selectionEnd =
      start + 1;

    updateHighlighting();
  }
);

/* Sync Scroll */

shaderEditor.addEventListener(
  "scroll",
  () => {

    highlighting.scrollTop =
      shaderEditor.scrollTop;

    highlighting.scrollLeft =
      shaderEditor.scrollLeft;

    lineNumbers.scrollTop =
      shaderEditor.scrollTop;
  }
);

updateHighlighting();

/* =========================
   Vertex Shader
========================= */

const vertexShaderSource = `#version 300 es

in vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

let program;
let timeLocation;
let resolutionLocation;
const textures = [];
const textureUniforms = [];

function createTexture(image, unit) {
  const texture = gl.createTexture();

  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    gl.REPEAT
  );

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR
  );

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    gl.LINEAR
  );

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image
  );

  textures[unit] = texture;
}

document
  .querySelectorAll('input[type="file"]')
  .forEach(input => {

    input.addEventListener("change", e => {

      const file = e.target.files[0];

      if (!file) return;

      const unit =
        parseInt(
          input.dataset.texture
        );

      const img = new Image();

      img.onload = () => {

        createTexture(img, unit);

        document.getElementById(
          `preview${unit}`
        ).src = img.src;
      };

      img.src =
        URL.createObjectURL(file);
    });
  });

/* =========================
   Resize Canvas
========================= */

function resizeCanvas() {

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  gl.viewport(
    0,
    0,
    canvas.width,
    canvas.height
  );
}

window.addEventListener(
  "resize",
  resizeCanvas
);

resizeCanvas();

/* =========================
   Shader Compilation
========================= */

function createShader(type, source) {

  const shader =
    gl.createShader(type);

  gl.shaderSource(shader, source);

  gl.compileShader(shader);

  if (
    !gl.getShaderParameter(
      shader,
      gl.COMPILE_STATUS
    )
  ) {

    const error =
      gl.getShaderInfoLog(shader);

    gl.deleteShader(shader);

    throw new Error(error);
  }

  return shader;
}

function createProgram(fragmentSource) {

  const vertexShader =
    createShader(
      gl.VERTEX_SHADER,
      vertexShaderSource
    );

  const fragmentShader =
    createShader(
      gl.FRAGMENT_SHADER,
      fragmentSource
    );

  const prog =
    gl.createProgram();

  gl.attachShader(
    prog,
    vertexShader
  );

  gl.attachShader(
    prog,
    fragmentShader
  );

  gl.linkProgram(prog);

  if (
    !gl.getProgramParameter(
      prog,
      gl.LINK_STATUS
    )
  ) {

    const error =
      gl.getProgramInfoLog(prog);

    throw new Error(error);
  }

  return prog;
}

/* =========================
   Fullscreen Quad
========================= */

const positionBuffer =
  gl.createBuffer();

gl.bindBuffer(
  gl.ARRAY_BUFFER,
  positionBuffer
);

gl.bufferData(
  gl.ARRAY_BUFFER,

  new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,

    -1,  1,
     1, -1,
     1,  1
  ]),

  gl.STATIC_DRAW
);

/* =========================
   Compile Shader
========================= */

function compileCurrentShader() {

  try {

    errorBox.textContent = "";

    program =
      createProgram(
        shaderEditor.value
      );

    gl.useProgram(program);

    const positionLocation =
      gl.getAttribLocation(
        program,
        "a_position"
      );

    gl.enableVertexAttribArray(
      positionLocation
    );

    gl.bindBuffer(
      gl.ARRAY_BUFFER,
      positionBuffer
    );

    gl.vertexAttribPointer(
      positionLocation,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    timeLocation =
      gl.getUniformLocation(
        program,
        "u_time"
      );

    resolutionLocation =
      gl.getUniformLocation(
        program,
        "u_resolution"
      );

      for (let i = 0; i < 4; i++) {

        textureUniforms[i] =
          gl.getUniformLocation(
            program,
            `u_texture${i}`
          );
      }

  } catch (err) {

    errorBox.textContent =
      err.message;

    console.error(err);
  }
}

runBtn.addEventListener(
  "click",
  compileCurrentShader
);

compileCurrentShader();

/* =========================
   Render Loop
========================= */

const fpsBox = document.getElementById("fps");

let lastTime = performance.now();
let frames = 0;
let fps = 0;

function render(time) {

  time *= 0.001;

  frames++;

  const now = performance.now();
  const delta = now - lastTime;

  if (delta >= 1000) {
    fps = Math.round((frames * 1000) / delta);

    fpsBox.textContent = `FPS: ${fps}`;

    frames = 0;
    lastTime = now;
  }


  resizeCanvas();

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (program) {

    gl.useProgram(program);

    gl.uniform1f(timeLocation, time);

    gl.uniform2f(
      resolutionLocation,
      canvas.width,
      canvas.height
    );

    for (let i = 0; i < 4; i++) {

      if (!textures[i]) continue;

      gl.activeTexture(gl.TEXTURE0 + i);

      gl.bindTexture(
        gl.TEXTURE_2D,
        textures[i]
      );

      gl.uniform1i(
        textureUniforms[i],
        i
      );
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);