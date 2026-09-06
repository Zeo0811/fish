// Presentation model only. Does not alter the solver's y=0 water surface.
export function waterAppearance(flow){
  const t=Math.max(0,Math.min(1,(flow-.65)/1.85)),energy=t*t*(3-2*t);
  return {energy,waveAmplitude:.002+.046*energy,foamStrength:energy*.82};
}
export const surfaceWaves=`
uniform float uTravel,uEnergy,uWaveAmplitude;
float waveHeight(vec2 p){
  float x=p.x-uTravel;float bankFade=1.-smoothstep(3.7,5.1,abs(p.y));
  return bankFade*uWaveAmplitude*(.6*sin(x*7.+sin(p.y*2.8))+.27*sin(x*15.3-p.y*7.2-uTravel*.7)+.13*sin(x*28.+p.y*11.));
}
vec3 waveNormal(vec2 p){float h=waveHeight(p),e=.018;return normalize(vec3(-(waveHeight(p+vec2(e,0.))-h)/e,1.,-(waveHeight(p+vec2(0.,e))-h)/e));}
`;
