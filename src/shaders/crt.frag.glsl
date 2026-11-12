uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCurvature;
uniform float uScanSpeed;
varying vec2 vUv;

vec3 sampleLinear(sampler2D tex, vec2 tc) {
  return pow(texture2D(tex, tc).rgb, vec3(2.2));
}

vec3 blur(sampler2D tex, vec2 tc, float offs) {
    return texture2D(tex, tc).rgb;
  vec4 xoffs = offs * vec4(-2.0, -1.0, 1.0, 2.0) / uResolution.x;
  vec4 yoffs = offs * vec4(-2.0, -1.0, 1.0, 2.0) / uResolution.y;
  vec3 color = vec3(0.0);
  color += sampleLinear(tex,tc + vec2(xoffs.x, yoffs.x)) * 0.00366;
  color += sampleLinear(tex,tc + vec2(xoffs.y, yoffs.x)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(0.0,     yoffs.x)) * 0.02564;
  color += sampleLinear(tex,tc + vec2(xoffs.z, yoffs.x)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.w, yoffs.x)) * 0.00366;
  color += sampleLinear(tex,tc + vec2(xoffs.x, yoffs.y)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.y, yoffs.y)) * 0.05861;
  color += sampleLinear(tex,tc + vec2(0.0,     yoffs.y)) * 0.09524;
  color += sampleLinear(tex,tc + vec2(xoffs.z, yoffs.y)) * 0.05861;
  color += sampleLinear(tex,tc + vec2(xoffs.w, yoffs.y)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.x, 0.0)) * 0.02564;
  color += sampleLinear(tex,tc + vec2(xoffs.y, 0.0)) * 0.09524;
  color += sampleLinear(tex,tc) * 0.15018;
  color += sampleLinear(tex,tc + vec2(xoffs.z, 0.0)) * 0.09524;
  color += sampleLinear(tex,tc + vec2(xoffs.w, 0.0)) * 0.02564;
  color += sampleLinear(tex,tc + vec2(xoffs.x, yoffs.z)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.y, yoffs.z)) * 0.05861;
  color += sampleLinear(tex,tc + vec2(0.0,     yoffs.z)) * 0.09524;
  color += sampleLinear(tex,tc + vec2(xoffs.z, yoffs.z)) * 0.05861;
  color += sampleLinear(tex,tc + vec2(xoffs.w, yoffs.z)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.x, yoffs.w)) * 0.00366;
  color += sampleLinear(tex,tc + vec2(xoffs.y, yoffs.w)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(0.0,     yoffs.w)) * 0.02564;
  color += sampleLinear(tex,tc + vec2(xoffs.z, yoffs.w)) * 0.01465;
  color += sampleLinear(tex,tc + vec2(xoffs.w, yoffs.w)) * 0.00366;
  return color;
}

float rand(vec2 co) {
  float dt = dot(co, vec2(12.9898, 78.233));
  return fract(sin(mod(dt, 3.14)) * 43758.5453);
}

vec2 curve(vec2 uv) {
  uv = (uv - 0.5) * 2.0;
  uv *= 1.1;
  uv.x *= 1.0 + pow(abs(uv.y) / 5.0, 2.0);
  uv.y *= 1.0 + pow(abs(uv.x) / 4.0, 2.0);
  uv = uv / 2.0 + 0.5;
  return uv * 0.92 + 0.04;
}

void main() {
  vec2 uv = mix(vUv, curve(vUv), uCurvature);
  vec3 col;
  float o = 2.0 * mod(gl_FragCoord.y, 2.0) / uResolution.x;

  // col = texture(tDiffuse, uv).rgb;
  col.r = blur(tDiffuse, uv + vec2( 0.0009,  0.0009) * 0.5, 1.2).r + 0.005;
  col.g = blur(tDiffuse, uv + vec2( 0.0000, -0.0015) * 0.5, 1.2).g + 0.005;
  col.b = blur(tDiffuse, uv + vec2(-0.0015,  0.0000) * 0.5, 1.2).b + 0.005;
  col.r += 0.2 * blur(tDiffuse, uv + vec2( 0.0009,  0.0009), 2.25).r - 0.005;
  col.g += 0.2 * blur(tDiffuse, uv + vec2( 0.0000, -0.0015), 1.75).g - 0.005;
  col.b += 0.2 * blur(tDiffuse, uv + vec2(-0.0015,  0.0000), 1.25).b - 0.005;

  float ghs = 0.05;
  col.r += ghs * (1.0 - 0.299) * blur(tDiffuse, 0.75 * vec2( 0.01, -0.027) + uv + vec2( 0.001,  0.001), 7.0).r;
  col.g += ghs * (1.0 - 0.587) * blur(tDiffuse, 0.75 * vec2(-0.022,-0.020) + uv + vec2( 0.000, -0.002), 5.0).g;
  col.b += ghs * (1.0 - 0.114) * blur(tDiffuse, 0.75 * vec2(-0.020,-0.000) + uv + vec2(-0.002,  0.000), 3.0).b;

  col = clamp(col * 0.4 + 0.6 * col * col, 0.0, 1.0);
  float vig = 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  col *= vec3(pow(max(vig, 0.0), 0.3));
  col *= vec3(0.95, 1.05, 0.95);
  col = mix(col, col * col, 0.3) * 3.8;

  float scans = clamp(0.35 + 0.15 * sin(3.5 * (uTime * uScanSpeed) + uv.y * uResolution.y * 1.5), 0.0, 1.0);
  col *= vec3(pow(scans, 0.9));
  col *= 1.0 + 0.0015 * sin(300.0 * uTime);
  col *= 1.0 - 0.15 * vec3(clamp((mod(gl_FragCoord.x + o, 2.0) - 1.0) * 2.0, 0.0, 1.0));
  col *= vec3(1.0) - 0.25 * vec3(rand(uv + 0.0001*uTime), rand(uv + 0.0001*uTime + 0.3), rand(uv + 0.0001*uTime + 0.5));
  // col = pow(max(col, 0.0), vec3(0.45));

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
}
