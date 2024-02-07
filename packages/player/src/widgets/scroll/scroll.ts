import { webgl } from './webgl'
import * as glMatrix from 'gl-matrix'
import { Observable } from 'rxjs'
import { requestAnimationFrame } from './animation'

export interface Text {
  fontFamily: string
  color: string
  str: string
}

/*
        Scroll helpers
*/
const createCanvas = function (parent: HTMLElement) {
  const canvas = document.createElement('canvas')

  canvas.style.width = '100%'
  canvas.style.height = '100%'

  canvas.width = parent.clientWidth
  canvas.height = parent.clientHeight

  parent.appendChild(canvas)

  return canvas
}

/**
      stringWithinWidth
  
      Returns a string as long as possible but that is smaller than maxWidth.
  
      The functions works by doing a binary search of the best string.
  
      return the string and the pixel width.
*/
function stringWithinWidth(
  ctx: CanvasRenderingContext2D,
  str: string,
  maxWidth: number
): [string, number, number] {
  let current = str
  let end = str.length

  let width = ctx.measureText(str).width
  let prevWidth = width

  if (width > maxWidth) {
    var delta
    var pos = Math.floor(end / 2)

    while (pos < end) {
      current = str.slice(0, pos)
      width = ctx.measureText(current).width

      delta = Math.round((end - pos) / 2)
      if (width > maxWidth) {
        end = pos
        pos -= delta
        prevWidth = width
      } else if (width < maxWidth) {
        pos += delta
      } else {
        break
      }
    }
  }

  var bias = 0
  if (str.length != current.length) {
    var l = current.length
    var w = ctx.measureText(str.slice(0, l + 1)).width
    var nextCharWidth = ctx.measureText(str.slice(l, l + 1)).width

    bias = w - width - nextCharWidth
    bias = bias > 0 ? bias : 0
  }

  return [current, width, bias]
}

/**
 * Creates a scroll chunk object. I.e., a piece of text in a GL texture.
 */
class ScrollChunk {
  textureHandle: WebGLTexture | null
  pos: number = 0
  quad: {
    vertexBuffer: any
    textCoordsBuffer: any
  } | null = null

  constructor(
    public gl: WebGLRenderingContext,
    public canvas: HTMLCanvasElement,
    public ctx: CanvasRenderingContext2D,
    public width: number,
    public height: number
  ) {
    this.textureHandle = gl.createTexture()
  }

  setText(
    text: Text[],
    bias: number,
    index: { str: number; char: number },
    sw: number
  ) {
    let s: [string, number, number]
    let strIndex = index['str']
    let charIndex = index['char']

    this.ctx.clearRect(0, 0, this.width, this.height)

    let currentWidth = 0
    do {
      currentWidth += bias

      var font_size = (95.0 / 100.0) * this.gl.canvas.height
      this.ctx.font = Math.round(font_size) + 'px ' + text[strIndex].fontFamily
      this.ctx.fillStyle = text[strIndex].color
      this.ctx.textBaseline = 'bottom'
      var str = text[strIndex].str.slice(charIndex)

      s = stringWithinWidth(this.ctx, str, this.width - currentWidth)
      bias = s[2]

      this.ctx.fillText(s[0], currentWidth, this.height)
      currentWidth += s[1]

      if (str.length == s[0].length) {
        charIndex = 0
        strIndex++
      } else {
        break
      }
    } while (strIndex < text.length)

    if (this.textureHandle) {
      webgl.loadTexture(this.gl, this.textureHandle, this.canvas)
    }

    var xratio = this.width / this.canvas.width
    this.quad = webgl.initQuad(
      this.gl,
      this.canvas.width * xratio,
      this.canvas.height,
      1.0 * xratio,
      1.0
    )
    this.pos = sw

    index['str'] = strIndex
    index['char'] = charIndex + s[0].length

    return bias
  }

  update(value: number) {
    this.pos += value
  }

  render() {
    this.gl.pushMatrix()
    glMatrix.mat4.translate(this.gl.mvMatrix, this.gl.mvMatrix, [
      this.pos,
      0,
      0.0,
    ])

    if (this.quad && this.textureHandle) {
      webgl.drawQuad(this.gl, this.quad, this.textureHandle)
    }
    this.gl.popMatrix()
  }
}

export class Scroll {
  gl: WebGLRenderingContext
  canvas: HTMLCanvasElement
  numTextures: number
  chunks: ScrollChunk[]
  headChunk = 0
  tailChunk = 1
  index = { str: 0, char: 0 }
  bias: number
  playing = false

  constructor(
    public el: HTMLElement,
    public text: Text[]
  ) {
    const { gl, canvas, textureWidth, textureHeight } = this.initGL(el)

    this.canvas = canvas
    this.gl = gl

    const textureCanvas = document.createElement('canvas')
    textureCanvas.width = textureWidth
    textureCanvas.height = textureHeight

    const textureCanvasCtx = textureCanvas.getContext('2d')

    if (!textureCanvasCtx) {
      throw new Error('Cannot get 2D context')
    }

    this.numTextures = Math.ceil(canvas.width / textureWidth) + 2

    this.chunks = new Array()
    for (let i = 0; i < this.numTextures; i++) {
      this.chunks[i] = new ScrollChunk(
        gl,
        textureCanvas,
        textureCanvasCtx,
        textureWidth,
        textureHeight
      )
    }

    this.text = text
    this.headChunk = 0
    this.tailChunk = 1
    this.index = { str: 0, char: 0 }
    this.bias = this.chunks[0].setText(text, 0, this.index, canvas.width)

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    glMatrix.mat4.identity(gl.mvMatrix)
  }

  initGL(parent: HTMLElement) {
    const canvas = createCanvas(parent)

    const textureWidth = Math.min(pow2round(canvas.width), 1024)
    const textureHeight = Math.min(pow2round(canvas.height), 1024)

    const gl = webgl.init(canvas)
    if (!gl) {
      throw new Error('Error initializing webgl')
    }
    webgl.initShaders(gl)
    gl.clearColor(0.0, 0.0, 0.0, 0.0)
    gl.enable(gl.DEPTH_TEST)

    return { gl, canvas, textureWidth, textureHeight }
  }

  play(speed: number) {
    return new Observable<string>((subscriber) => {
      let playing = true
      const performScrolling = () => {
        if (playing) {
          requestAnimationFrame(performScrolling)
          if (this.updateScroll(-speed)) {
            subscriber.next('played')
            // subscriber.complete();
          }
        }
      }

      performScrolling()

      return () => {
        playing = false
      }
    })
  }

  updateScroll(delta: number) {
    const gl = this.gl
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    glMatrix.mat4.identity(gl.pMatrix)
    glMatrix.mat4.ortho(
      gl.pMatrix,
      0,
      gl.drawingBufferWidth,
      0,
      gl.drawingBufferHeight,
      -1,
      1
    )

    let end = false
    let i = this.headChunk
    do {
      var chunk = this.chunks[i]

      chunk.update(delta)
      chunk.render()

      var x1 = chunk.width + chunk.pos

      var next = (i + 1) % this.numTextures

      if (x1 < 0) {
        // delete head chunk.
        this.headChunk = (this.headChunk + 1) % this.numTextures

        // Loop
        if (this.headChunk == this.tailChunk) {
          this.headChunk = 0
          this.tailChunk = 1
          this.index = { str: 0, char: 0 }
          this.bias = this.chunks[0].setText(
            this.text,
            0,
            this.index,
            this.canvas.width
          )
          end = true
          break
        }
      } else if (
        x1 <= this.canvas.width &&
        next == this.tailChunk &&
        this.index['str'] < this.text.length
      ) {
        this.bias = this.chunks[this.tailChunk].setText(
          this.text,
          this.bias,
          this.index,
          this.canvas.width
        )
        this.tailChunk = (this.tailChunk + 1) % this.numTextures
      }
      i = next
    } while (i != this.tailChunk)
    return end
  }
}

function pow2round(x: number) {
  return 1 << Math.ceil(Math.log(x) / Math.log(2))
}
