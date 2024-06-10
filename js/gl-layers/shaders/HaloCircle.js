const shader = {
  uniforms: {
    // 纹理贴图
    textureMap: { type: 'THREE.Texture', value: '' },
    // 内环半径
    innerCircleWidth: { value: 0 },
    // 环宽度
    circleWidth: { value: 0 },
    // 圆环颜色
    color: { value: null },
    // 圆环透明度
    opacity: { value: 0.8 },
    // 环圆心位置
    center: { value: null }
  },

  vertexShader: `
      varying vec2 vUv;
      varying vec3 v_position;
      void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          v_position = vec3(modelMatrix * vec4(position, 1.0));
      }
  `,

  fragmentShader: `   
     varying vec2 vUv;
     varying vec3 v_position;

     uniform float innerCircleWidth;
     uniform float circleWidth;
     uniform float radius;
     uniform float opacity;
     uniform vec3 center;
     uniform vec3 color;
     uniform sampler2D textureMap;
     uniform vec2 repeat;

     void main() {
       float dis = length(v_position - center);

       // 不超过半径范围，且与波动有交集
       if( dis < radius && dis < (innerCircleWidth + circleWidth) && dis > innerCircleWidth) {
          // 计算当前片元的位置占整个圆环宽度的比例
          float r = (dis - innerCircleWidth) / circleWidth;

          // 透明度衰减起始点和终止点
          float startDecay = radius * 0.5;
          float endDecay = radius;

          // 计算透明度
          float alpha = 1.0;
          if (dis > startDecay) {
              alpha = 1.0 - (dis - startDecay) / (endDecay - startDecay);
          }
          if (dis >= endDecay) {
              alpha = 0.0;
          }         
          
          // 方案1： 纹理和颜色混合
          gl_FragColor = mix(texture2D(textureMap, vUv * repeat), vec4(color, opacity), r);
          // 叠加 过程透明度 和 位置透明度  
          gl_FragColor.a *= alpha * r;

          // 方案2：只显示纹理
          // gl_FragColor = vec4(color, 1.0) * texture2D(textureMap, vUv);
       }else {
          // 丢弃片元不渲染
          discard;
       }        

     }
  `
}

export default shader
