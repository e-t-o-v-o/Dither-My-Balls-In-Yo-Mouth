import React from 'react';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-dom';

const shaders = Shaders.create({
  dither: {
    frag: GLSL`
precision highp float;
varying vec2 uv;
uniform sampler2D t;
uniform int levels;
void main() {
  vec4 color = texture2D(t, uv);
  float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  // 4x4 Bayer matrix
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  int xi = int(mod(gl_FragCoord.x, 4.0));
  int yi = int(mod(gl_FragCoord.y, 4.0));
  float threshold = m[yi*4 + xi] / 16.0;
  float level = brightness + threshold/float(levels);
  float idx = floor(level * float(levels));
  float out = idx / float(levels - 1);
  gl_FragColor = vec4(out, out, out, 1.0);
}`
  }
});

export default function DitherShader({ t, levels = 10 }) {
  return (
    <Surface style={{ width: '100%', height: '100%' }}>
      <Node shader={shaders.dither} uniforms={{ t, levels }} />
    </Surface>
  );
}
