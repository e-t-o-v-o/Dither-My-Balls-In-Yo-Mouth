import React from 'react';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-dom';
import { paletteSets } from './constants';

const ShadersDefs = Shaders.create({
  default: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      void main() {
        gl_FragColor = texture2D(t, uv);
      }
    `,
  },
  twoTone: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      uniform vec3 fg;
      uniform vec3 bg;
      uniform float threshold;
      void main() {
        vec4 color = texture2D(t, uv);
        float lum = dot(color.rgb, vec3(0.299,0.587,0.114));
        vec3 outC = lum > threshold ? fg : bg;
        gl_FragColor = vec4(outC, 1.0);
      }
    `,
  },
  palette: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      uniform vec3 palette[10];
      uniform int palSize;
      void main() {
        vec4 color = texture2D(t, uv);
        float minDist = 1e6;
        vec3 best = palette[0];
        for (int i = 0; i < 10; i++) {
          if (i >= palSize) break;
          float d = distance(color.rgb, palette[i]);
          if (d < minDist) { minDist = d; best = palette[i]; }
        }
        gl_FragColor = vec4(best, 1.0);
      }
    `,
  },
});

export default function GLPreview({ videoRef, config }) {
  const { effect } = config;
  let shader = ShadersDefs.default;
  const uniforms = { t: videoRef.current };
  if (effect === 'two-tone') {
    shader = ShadersDefs.twoTone;
    uniforms.fg = hexToVec3(config.fgColor);
    uniforms.bg = hexToVec3(config.bgColor);
    uniforms.threshold = config.threshold / 255.0;
  } else if (effect === 'palette') {
    shader = ShadersDefs.palette;
    const pal = paletteSets[config.paletteName] || [];
    const rgbPal = pal.slice(0, 10).map(hexToVec3);
    for (let i = 0; i < 10; i++) uniforms['palette['+i+']'] = rgbPal[i] || [0,0,0];
    uniforms.palSize = rgbPal.length;
  }
  return (
    <Surface style={{ width: '100%', height: '100%' }}>
      <Node shader={shader} uniforms={uniforms} />
    </Surface>
  );
}

function hexToVec3(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r,g,b];
}
