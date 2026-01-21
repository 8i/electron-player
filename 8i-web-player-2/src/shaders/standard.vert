// weightsAtt and bindingsAtt are vertex attributes for bone weights and indices.
attribute vec4 weightsAtt;
attribute vec4 bindingsAtt;

// boneTransforms is an array of matrices for bone transformations.
uniform mat4 boneTransforms[25];
varying vec2 vUv;

// See https://github.com/8i/Loki/blob/c48354c470c82fa7265a1c5a66cae74f1a29b07e/qtPlayer/shaders/render.vert

void main() {
  vUv = uv;
  // This loop calculates the final vertex position based on bone transformations and weights.
  vec4 totalAnimatedPos = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    int index = int(bindingsAtt[i]);
    if (index == -1 || index == 0) {
      totalAnimatedPos = vec4(position, 1.0);
      break;
    }
    vec4 localAnimatedPos = boneTransforms[index] * vec4(position, 1.0);
    totalAnimatedPos += localAnimatedPos * weightsAtt[i];
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(totalAnimatedPos.xyz, 1.0);
}
