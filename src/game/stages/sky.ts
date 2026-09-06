import * as T from "three";
export type SkyTheme = "city" | "golden" | "day" | "space";
/** Analytic sky dome: no cubemap download and no texture seams at the horizon. */
export function sky(parent: T.Group, theme: SkyTheme) {
  const space = theme === "space",
    golden = theme === "golden" || theme === "city";
  const mat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      zenith: {
        value: new T.Color(
          space
            ? "#030712"
            : theme === "city"
              ? "#485e8b"
              : golden
                ? "#424f82"
                : "#3d81b7",
        ),
      },
      horizon: {
        value: new T.Color(
          space
            ? "#18223c"
            : theme === "city"
              ? "#dcb8ba"
              : golden
                ? "#ecb58e"
                : "#d5e2dc",
        ),
      },
      sunDir: {
        value: new T.Vector3(-0.65, golden ? 0.19 : 0.55, -0.45).normalize(),
      },
      space: { value: space ? 1 : 0 },
    },
    vertexShader: `varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.0);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunDir;uniform float space;varying vec3 direction;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(direction);float up=max(d.y,0.);vec3 c=mix(horizon,zenith,pow(up,.48));float sun=max(dot(d,sunDir),0.);
    if(space<.5){vec2 p=d.xz/max(.14,d.y+.08);float cloud=noise(p*1.4)*.6+noise(p*3.1+7.)*.28+noise(p*7.)*.12;float wisps=smoothstep(.53,.75,cloud)*smoothstep(.025,.2,d.y);c=mix(c,vec3(.94,.92,.84),wisps*.7);c+=vec3(.28,.18,.09)*pow(sun,18.);c=mix(c,vec3(1.,.85,.58),smoothstep(.9988,.9993,sun));}
    else{vec2 p=vec2(atan(d.z,d.x),asin(d.y))*230.;vec2 cell=floor(p);float bright=step(.986,hash(cell));float star=exp(-dot(fract(p)-.5,fract(p)-.5)*95.)*bright;float band=exp(-abs(d.x*.42+d.y*.7+d.z*.57)*18.);c+=vec3(.035,.045,.075)*band*(.4+noise(p*.028));c+=vec3(.8,.87,1.)*star;c+=vec3(.12,.17,.24)*pow(sun,90.);c=mix(c,vec3(.9,.96,1.),smoothstep(.99965,.99982,sun));}
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>}`,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10000;
  mesh.userData.cameraIgnore = true;
  mesh.name = `${theme}-sky`;
  parent.add(mesh);
  return mesh;
}
