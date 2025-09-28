import * as glMatrix from 'gl-matrix';

import texmap from './shaders/simple-text.glsl';
import transform from './shaders/simple-transform.glsl';

declare global {
  interface WebGLRenderingContext {
    prototype: WebGLRenderingContext;
    mvMatrix: glMatrix.mat4;
    pMatrix: glMatrix.mat4;
    pushMatrix: () => void;
    popMatrix: () => void;
    mvMatrixStack: glMatrix.mat4[];

    shaderProgram: WebGLProgram;
  }

  interface WebGLProgram {
    vertexPositionAttribute: number;
    textureCoordAttribute: number;
    pMatrixUniform: WebGLUniformLocation | null;
    mvMatrixUniform: WebGLUniformLocation | null;
    samplerUniform: WebGLUniformLocation | null;
  }

  interface WebGLBuffer {
    itemSize: number;
    numItems: number;
  }
}

WebGLRenderingContext.prototype.pushMatrix = function (): void {
  const copy = glMatrix.mat4.create();

  glMatrix.mat4.copy(this.mvMatrix, copy);
  this.mvMatrixStack.push(copy);
};

WebGLRenderingContext.prototype.popMatrix = function () {
  if (this.mvMatrixStack.length == 0) {
    throw 'Invalid popMatrix!';
  }
  this.mvMatrix = this.mvMatrixStack.pop() as glMatrix.mat4;
};

export let webgl = {
  //
  // Shader types: gl.FRAGMENT_SHADER, gl.VERTEX_SHADER
  //

  loadShader: function (
    gl: WebGLRenderingContext,
    src: string,
    shaderType: number
  ) {
    const shader = gl.createShader(shaderType);
    if (shader) {
      gl.shaderSource(shader, src);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw gl.getShaderInfoLog(shader);
      }
    }
    return shader;
  },

  loadTexture: function (
    gl: WebGLRenderingContext,
    textureHandle: WebGLTexture,
    canvasTexture: TexImageSource
  ) {
    gl.bindTexture(gl.TEXTURE_2D, textureHandle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvasTexture
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
  },

  init: function (canvas: HTMLCanvasElement) {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl');

      if (gl) {
        gl.mvMatrix = glMatrix.mat4.create();
        gl.pMatrix = glMatrix.mat4.create();

        gl.mvMatrixStack = [];
      }
      return gl;
    } catch (e) {}
    if (!gl) {
      alert('Your Web Browser does not have WebGL Capabilities...');
    }
  },

  initShaders: function (gl: WebGLRenderingContext) {
    const texmapShader = webgl.loadShader(gl, texmap, gl.FRAGMENT_SHADER);
    if (!texmapShader) {
      throw new Error('Erroor loading fragment shader');
    }
    const transformShader = webgl.loadShader(gl, transform, gl.VERTEX_SHADER);
    if (!transformShader) {
      throw new Error('Error loading vertex shader');
    }

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
      throw new Error('Error creating shader program');
    }

    gl.shaderProgram = shaderProgram;

    gl.attachShader(shaderProgram, texmapShader);
    gl.attachShader(shaderProgram, transformShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Could not initialise shaders');
    }

    if (!gl.getProgramParameter(gl.shaderProgram, gl.LINK_STATUS)) {
      alert('Could not initialise shaders');
    }

    gl.useProgram(gl.shaderProgram);

    // Mapping attributes
    gl.shaderProgram.vertexPositionAttribute = gl.getAttribLocation(
      gl.shaderProgram,
      'aVertexPosition'
    );
    gl.enableVertexAttribArray(gl.shaderProgram.vertexPositionAttribute);

    gl.shaderProgram.textureCoordAttribute = gl.getAttribLocation(
      gl.shaderProgram,
      'aTextureCoord'
    );
    gl.enableVertexAttribArray(gl.shaderProgram.textureCoordAttribute);

    // Mapping uniform variables.
    gl.shaderProgram.pMatrixUniform = gl.getUniformLocation(
      gl.shaderProgram,
      'uPMatrix'
    );
    gl.shaderProgram.mvMatrixUniform = gl.getUniformLocation(
      gl.shaderProgram,
      'uMVMatrix'
    );
    gl.shaderProgram.samplerUniform = gl.getUniformLocation(
      gl.shaderProgram,
      'uSampler'
    );
  },

  initQuad: function (
    gl: WebGLRenderingContext,
    w: number,
    h: number,
    tw: number,
    th: number
  ) {
    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    var vertices = [w, h, 0.0, 0.0, h, 0.0, w, 0.0, 0.0, 0.0, 0.0, 0.0];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    if (!vertexBuffer) {
      throw new Error('Invalid vertex buffer');
    }
    vertexBuffer.itemSize = 3;
    vertexBuffer.numItems = 4;

    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);

    var textureCoords = [tw, th, 0.0, th, tw, 0.0, 0.0, 0.0];

    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(textureCoords),
      gl.STATIC_DRAW
    );

    if (!texCoordBuffer) {
      throw new Error('Invalid tex coord buffer');
    }

    texCoordBuffer.itemSize = 2;
    texCoordBuffer.numItems = 4;

    var quad = {
      vertexBuffer: vertexBuffer,
      textCoordsBuffer: texCoordBuffer,
    };

    return quad;
  },

  drawQuad: function (
    gl: WebGLRenderingContext,
    quad: {
      vertexBuffer: WebGLBuffer;
      textCoordsBuffer: WebGLBuffer;
    },
    texture: WebGLTexture
  ) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad.vertexBuffer);

    gl.vertexAttribPointer(
      gl.shaderProgram.vertexPositionAttribute,
      quad.vertexBuffer.itemSize,
      gl.FLOAT,
      false,
      0,
      0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, quad.textCoordsBuffer);
    gl.vertexAttribPointer(
      gl.shaderProgram.textureCoordAttribute,
      quad.textCoordsBuffer.itemSize,
      gl.FLOAT,
      false,
      0,
      0
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.shaderProgram.samplerUniform, 0);

    setMatrixUniforms(gl);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, quad.vertexBuffer.numItems);
  },
};

function drawScene(
  gl: WebGLRenderingContext,
  textureHandle: WebGLTexture,
  xpos: number,
  quad: {
    vertexBuffer: WebGLBuffer;
    textCoordsBuffer: WebGLBuffer;
  }
) {
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  glMatrix.mat4.identity(gl.pMatrix);
  glMatrix.mat4.identity(gl.mvMatrix);

  glMatrix.mat4.ortho(
    gl.pMatrix,
    0,
    gl.drawingBufferWidth,
    0,
    gl.drawingBufferHeight,
    -1,
    1
  );

  gl.pushMatrix();
  glMatrix.mat4.translate(gl.mvMatrix, gl.mvMatrix, [xpos, 0, 0.0]);
  webgl.drawQuad(gl, quad, textureHandle);
  gl.popMatrix();
}

function setMatrixUniforms(gl: WebGLRenderingContext) {
  gl.uniformMatrix4fv(gl.shaderProgram.pMatrixUniform, false, new Float32Array(gl.pMatrix));
  gl.uniformMatrix4fv(gl.shaderProgram.mvMatrixUniform, false, new Float32Array(gl.mvMatrix));
}
