varying vec2 vUv;
uniform sampler2D videoMap;
uniform float contrast;
uniform float opacity;

void main() {
  vec3 col = clamp(texture2D(videoMap, vUv).rgb - vec3(1.0 - contrast), 0.0, 1.0) * 1.0 / contrast;
  gl_FragColor = vec4(col, opacity);
}
