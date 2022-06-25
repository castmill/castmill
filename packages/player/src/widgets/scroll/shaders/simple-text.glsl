#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

varying float xPosition;

/**
  Returns a alpha delta to fade the out the left and right parts of the
  scroller.
*/
float leftRightFade( float start, float xPos )
{
  float deltaAlpha;
  
  xPos = abs(xPos);
  
  // Bug in opengl drivers?
  
  //if( xPos > start)
    //deltaAlpha = smoothstep(start, 1.0, xPos);

  if( xPos > start)
    deltaAlpha = (xPos - start) * 1.0 / (1.0-start);
  return deltaAlpha;
}

void main(void) {
  gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor.a -= leftRightFade( 0.8, xPosition);
}
