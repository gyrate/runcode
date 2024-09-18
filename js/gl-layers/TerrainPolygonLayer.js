import Layer from "./gl-layers.js";
import * as THREE from "three";
import { MeshLineGeometry, MeshLineMaterial } from '../../plugins/meshline.js'
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";

class TerrainPolygonLayer extends Layer {
  // 缓存边界区域的路径
  _data = [];

  // 最后一次高亮对象
  _lastPick = {
    mesh: null,
    opacity: null,
  };

  // 区域几何体的矩形范围盒子
  _extRange = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  };

  // 顶部网格体
  _topMesh = null;
  // 缓存顶部网格体的相关属性
  _topMeshProps = {};

  // 侧边网格体
  _sideMesh = null;
  // 缓存侧边网格体的相关属性
  _sideMeshProps = {};

  // CanvasTexture贴图的最大尺寸
  // 影响到贴图的清晰程度
  _CANVAS_MAX_LEN = 2000;

  /**
   * 创建一个实例
   * @param {Object} config
   * @param {GeoJSON} config.data 基础数据 required
   * @param {Number} [config.altitude=0] 海拔高度
   * @param {Number} [config.opacity=1.0] 多边形网格体的透明度
   * @param {Number} [config.lineWidth=50.0] 边缘线宽度，如果值为0则不渲染边缘线
   * @param {String} [config.lineColor='#ffffff'] 边缘线颜色
   * @param {Number} [config.interact=false] 是否支持鼠标交互
   * @param {THREE.Texture} config.textureMap 纹理贴图
   * @param {THREE.Texture} config.displacementMap 位移贴图，会影响顶部面的顶点位置
   * @param {Number} [config.segment=2] 面的细分程度
   */
  constructor(config) {
    const conf = {
      data: null,
      altitude: 0,
      opacity: 1.0,
      interact: false,
      intensity: 0.9,
      lineWidth: 100.0,
      lineColor: "#FFFFFF",
      sizeAttenuation: 1, // 线宽与镜头距离相关联
      textureMapURL: null,
      normalMapURL: null,
      displacementMapURL: null,
      segment: 15,
      sideTextureMapURL: "./static/texture/texture_cake_1.png",
      ...config,
    };
    super(conf);
    this.initData(conf.data);
  }

  /**
   * 处理转换图层基础数据的地理坐标为空间坐标
   * @param geoJSON {JSON}
   * @private
   */
  initData(geoJSON) {
    const { features } = geoJSON;
    features.forEach(({ geometry, properties }) => {
      switch (geometry.type) {
        case "MultiPolygon":
          geometry.coordinates[0].forEach((item) => {
            this._data.push({
              path: this.customCoords.lngLatsToCoords(item),
              properties,
            });
          });
          break;
        case "Polygon":
          this._data.push({
            path: this.customCoords.lngLatsToCoords(geometry.coordinates[0]),
            properties,
          });
          break;
        default:
          break;
      }
    });
    console.log(this._data);
  }

  // Layer已准备好
  async onReady() {
    this.initExtRange();
    await this.initTexture();
    this.createTopMesh();
    if (this._conf.altitude > 0) {
      this.createSideMesh({ height: this._conf.altitude });
    }
    if (this._conf.lineWidth > 0) {
      this.createEdge();
    }
    this.initLight();
  }

  /**
   * 增加方向光照，使法线贴图产生效果
   */
  initLight() {
    const {intensity} = this._conf
    // 方向平行光
    const directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 * intensity);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    // 环境光
    const light = new THREE.AmbientLight( 0x404040, 2.0 * intensity ); // soft white light
    this.scene.add( light );
  }

  getParentObject({ object }) {
    do {
      if (object.parent?.type === "Scene") {
        return object;
      }
      object = object.parent;
    } while (object);
    return undefined;
  }

  onPicked({ targets, event }) {
    let attrs = null;

    if (targets.length > 0) {
      const cMesh = this.getParentObject(targets[0]);
      if (cMesh) {
        this.setLastPick(cMesh);
        attrs = cMesh._attrs;
      } else {
        this.removeLastPick();
      }
    } else {
      this.removeLastPick();
    }
    /**
     * 模型拾取事件
     * @event  ModelLayer#pick
     * @type {object}
     * @property {Number} screenX 图层场景
     * @property {Number} screenY 图层相机
     * @property {Object} attrs 模型属性
     */
    this.handleEvent("pick", {
      screenX: event?.pixel?.x,
      screenY: event?.pixel?.y,
      attrs,
    });
  }

  /**
   * 高亮最后的选中项
   * @param {THREE.Mesh} mesh
   */
  setLastPick(mesh) {
    if (mesh) {
      this.removeLastPick();

      this._lastPick = {
        mesh,
        opacity: mesh.material.opacity,
      };
      mesh.material.opacity = 0.9;
    }
  }

  /**
   * 取消高亮最后的选中项
   * @param {THREE.Mesh} mesh
   */
  removeLastPick() {
    if (this._lastPick.mesh) {
      // debugger
      const { mesh, opacity } = this._lastPick;
      mesh.material.opacity = opacity;

      this._lastPick = {
        mesh: null,
        opacity: null,
      };
    }
  }

  /**
   * 创建边界线网格体
   * @private
   */
  createEdge() {
    const path = this._data[0].path;
    // 几何体
    const points = [];
    path.forEach(([x, y, z]) => {
      points.push(new THREE.Vector3(x, y, this._conf.altitude + 20));
    });
    const line = new MeshLineGeometry();
    line.setPoints(points);

    const { sizeAttenuation, lineWidth, lineColor } = this._conf;

    const material = new MeshLineMaterial({
      useMap: 0,
      color: new THREE.Color(lineColor),
      opacity: 1,
      // transparent: true,
      depthTest: true,
      sizeAttenuation: sizeAttenuation ? 1 : 0,
      lineWidth,
    });
    const mesh = new THREE.Mesh(line, material);
    this.scene.add(mesh);

    this._edgeMesh = mesh;
  }

  /**
   * 获取边缘线材质
   * @private
   * @return {MeshLineMaterial}
   */
  getLineMaterial() {
    if (this._lineMaterial == null) {
      this._lineMaterial = new MeshLineMaterial({
        useMap: 0,
        color: new THREE.Color(lineColor),
        opacity: 1,
        // transparent: true,
        depthTest: true,
        sizeAttenuation: sizeAttenuation ? 1 : 0,
        lineWidth,
      });
    }
    return this._lineMaterial;
  }

  /**
   * 创建顶部的网格体
   * @private
   */
  createTopMesh() {
    const { normalScale, displacementScale } = this._conf;

    const { textureMap, normalMap, displacementMap, alphaMap } = this._topMeshProps;

    // 将纹理设置为sRGB颜色空间，以便正确显示颜色
    textureMap.encoding = THREE.sRGBEncoding;
    // normalMap.encoding = THREE.sRGBEncoding;

    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      map: textureMap,
      normalMap,
      normalScale: new THREE.Vector2(normalScale, normalScale), // 法线贴图对材质的影响程度
      alphaMap,
      displacementMap,
      displacementScale,
      displacementBias: 0,
      wireframe: false,
      transparent: true,
      alphaTest: 0.1, // 该值必须大于0，以保证透明本图层的透明区域不会遮挡其他图层
    });
    // 几何体
    const geometry = this.generateTopGeometry();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, this._conf.altitude);
    this.scene.add(mesh);

    this._topMesh = mesh;
  }

  /**
   * 创建顶部面的几何体
   * @private
   * @return {*}
   */
  generateTopGeometry() {
    const { segment } = this._conf;
    const { minX, minY, maxX, maxY } = this._extRange;
    const coords = [
      [minX, minY],
      [minX, maxY],
      [maxX, maxY],
      [maxX, minY],
    ];
    // 创建多边形
    const path = new THREE.Shape();
    coords.forEach(([x, y], index) => {
      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });
    // 创建几何体
    let geometry = new THREE.ShapeGeometry(path);

    // 细分出更多顶点
    const tessellateModifier = new TessellateModifier(0.1, segment);
    geometry = tessellateModifier.modify(geometry);

    // 创建 UV 属性并将其设置到几何体
    const uvArray = this.getGeometryUV(geometry);
    const uvAttribute = new THREE.BufferAttribute(uvArray, 2);
    geometry.setAttribute("uv", uvAttribute);

    return geometry;
  }

  /**
   * 通过边缘坐标数据获取灰度图纹理
   * @private
   */
  generateAlphaMap() {
    const polygonVertices = this._data[0].path.map(([x, y]) => {
      return new THREE.Vector3(x, y, 0);
    });

    // 行政区域的矩形范围
    const { minX, minY, maxX, maxY } = this._extRange;

    // 计算缩放比例
    const maxDimension = Math.max(maxX - minX, maxY - minY);
    // 限制画布的最大宽和高
    const scale = this._CANVAS_MAX_LEN / maxDimension;
    // 缩放多边形顶点的坐标
    const scaledVertices = polygonVertices.map((vertex) => {
      const x = (vertex.x - minX) * scale;
      const y = (vertex.y - minY) * scale;
      return new THREE.Vector3(x, y, vertex.z);
    });

    // 计算调整后的画布大小
    const width = Math.ceil((maxX - minX) * scale);
    const height = Math.ceil((maxY - minY) * scale);

    const canvas = this.generateCanvas({ width, height });
    const context = canvas.getContext("2d");
    // 绘制多边形
    context.fillStyle = "#000000"; // 设置背景颜色为黑色
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#FFFFFF"; // 设置多边形颜色为白色
    context.beginPath();
    context.moveTo(scaledVertices[0].x, scaledVertices[0].y);
    for (let i = 1; i < scaledVertices.length; i++) {
      context.lineTo(scaledVertices[i].x, scaledVertices[i].y);
    }
    context.closePath();
    context.fill();

    return new THREE.CanvasTexture(
      canvas,
      null,
      THREE.RepeatWrapping,
      THREE.RepeatWrapping
    );
  }

  generateCanvas({ width, height }) {
    // 创建画布和上下文
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    // Canvas调整为与UV坐标系一致
    // 坐标垂直翻转，原点定位在左下角
    context.translate(0, height);
    context.scale(1, -1);
    return canvas;
  }

  /**
   * 更新顶部面的细分程度
   * @param value {Number} 细分迭代次数
   */
  setSegment(value) {
    this._conf.segment = value;
    this._topMesh.geometry = this.generateTopGeometry();
  }

  /**
   * 初始化各种纹理贴图
   * @return {Promise<void>}
   */
  async initTexture() {
    // 顶部网格体
    const topTextureArr = ["textureMap", "normalMap", "displacementMap"];
    for (let i = 0; i < topTextureArr.length; i++) {
      const name = topTextureArr[i];
      const url = this._conf[`${name}URL`];
      const textureMap = await new THREE.TextureLoader().load(url);
      textureMap.wrapS = THREE.RepeatWrapping; // 在U方向（水平）平铺
      textureMap.wrapT = THREE.RepeatWrapping; // 在V方向（垂直）平铺
      this._topMeshProps[name] = textureMap;
    }
    this._topMeshProps.alphaMap = this.generateAlphaMap();

    // 侧边网格体
    const texture = await new THREE.TextureLoader().load(
      this._conf.sideTextureMapURL
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(0, 1);
    this._sideMeshProps.textureMap = texture;
  }

  /**
   * 初始化边界范围盒子
   * @private
   */
  initExtRange() {
    const positions = this._data[0].path;

    let minX = positions[0][0];
    let minY = positions[0][1];
    let maxX = positions[0][0];
    let maxY = positions[0][1];

    for (let i = 0; i < positions.length; i += 3) {
      const [x, y] = positions[i];
      if (x < minX) {
        minX = x;
      } else if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      } else if (y > maxY) {
        maxY = y;
      }
    }
    this._extRange = { minX, minY, maxX, maxY };
  }

  /**
   * 获取几何体归一化之后的UV坐标
   * @param geometry
   * @return {Float32Array}
   */
  getGeometryUV(geometry) {
    // 获取所有顶点数量
    const vertexCount = geometry.attributes.position.count;
    // 创建 UV 坐标数组
    const uvArray = new Float32Array(vertexCount * 2);
    const { minX, minY, maxX, maxY } = this._extRange;
    // 设置 UV 坐标
    for (let i = 0; i < vertexCount; i++) {
      const vertexIndex = i * 2;
      // UV坐标归一化
      const u = (geometry.attributes.position.getX(i) - minX) / (maxX - minX);
      const v = (geometry.attributes.position.getY(i) - minY) / (maxY - minY);
      uvArray[vertexIndex] = u;
      uvArray[vertexIndex + 1] = v;
    }
    return uvArray;
  }

  /**
   * 创建侧面几何体
   * @param arr
   * @param height
   * @return {*}
   */
  createSideGeometry(arr, { height }) {
    // 保持闭合路线
    if (arr[0].toString() !== arr[arr.length - 1].toString()) {
      arr.push(arr[0]);
    }

    const vec3List = []; // 顶点数组
    let faceList = []; // 三角面数组
    let faceVertexUvs = []; // 面的UV层队列，用于纹理和几何信息映射

    const t0 = [0, 0];
    const t1 = [1, 0];
    const t2 = [1, 1];
    const t3 = [0, 1];

    for (let i = 0; i < arr.length; i++) {
      const [x1, y1, z1] = arr[i];
      vec3List.push([x1, y1, 0]);
      vec3List.push([x1, y1, z1 !== undefined ? z1 : height]);
    }

    for (let i = 0; i < vec3List.length - 2; i++) {
      if (i % 2 === 0) {
        // 下三角
        faceList = [
          ...faceList,
          ...vec3List[i],
          ...vec3List[i + 2],
          ...vec3List[i + 1],
        ];
        // UV
        faceVertexUvs = [...faceVertexUvs, ...t0, ...t1, ...t3];
      } else {
        // 上三角
        faceList = [
          ...faceList,
          ...vec3List[i],
          ...vec3List[i + 1],
          ...vec3List[i + 2],
        ];
        // UV
        faceVertexUvs = [...faceVertexUvs, ...t3, ...t1, ...t2];
      }
    }

    const geometry = new THREE.BufferGeometry();
    // 顶点三角面
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(faceList), 3)
    );
    // UV面
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(faceVertexUvs), 2)
    );

    return geometry;
  }

  /**
   * 创建侧面网格体
   * @param height
   * @param name
   */
  createSideMesh({ height = 0, name }) {
    if (height <= 0) {
      return;
    }
    const arr = this._data[0].path;
    const geometry = this.createSideGeometry(arr, { height });

    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      map: this._sideMeshProps.textureMap,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);

    this._sideMesh = mesh;
  }

  /**
   * 更新材质uniforms参数
   * @public
   * @param prop {String}
   * @param value {*}
   */
  updateUniforms(prop, value) {
    this._topMesh.material.uniforms[prop].value = value;
  }

  /**
   * 更新材质属性
   * @param prop {String}
   * @param value {*}
   */
  updateMaterial(prop, value) {
    this._topMesh.material[prop] = value;
  }

  // 逐帧更新图层
  // 更新纹理偏移量
  update() {
    // todo: 更新业务逻辑
  }
}

export default TerrainPolygonLayer;
