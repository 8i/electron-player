varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
uniform sampler2D videoMap;
uniform float contrast;
uniform float opacity;

#define EPSILON (1e-6)

void main() {
  vec3 baseColor = clamp(texture2D(videoMap, vUv).rgb - vec3(1.0 - contrast), 0.0, 1.0) / contrast;
  vec3 viewDir = normalize(cameraPosition - vPosition);
  vec3 normal = normalize(vNormal);
  float lighting = smoothstep(0.0, 1.0, max(dot(normal, viewDir), contrast * 0.85));
  vec3 col = baseColor * lighting;
  gl_FragColor = vec4(col, opacity);
}
