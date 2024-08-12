import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import Layer from "./gl-layers.js";

/**
 * @description 自定义图层模板，继承自Layer
 * @see {@link https://lbs.iot-cas.com/gl-layers/docs/demos/index.html#/BuildingLayer}
 * @extends Layer
 * @author Zhanglinhai <gyrate.sky@qq.com>
 */
class POI3dLayer0 extends Layer {
  // 缓存模型
  _models = {};
  // 缓存材质
  _materials = {};
  // 缓存实例化模型
  _instanceMap = {};
  // 纹理图片帧数，通过计算图片宽高比获得
  _frameX = 1;
  // 托盘纹理的偏移量，用于实现动画
  _offset = 0;

  // 主体旋转角度
  _currentAngle = 0;

  _size = 10;

  // 最大旋转角度
  _maxAngle = Math.PI * 2;

  // 用于做定位和移动的介质
  _dummy = new THREE.Object3D();

  // 最后一次高亮的物体信息
  _lastPickIndex = {
    index: null,
  };

  _resolution = 0;
  _sizeMap = {};

  /**
   * 创建一个实例
   * @param {Object} config
   * @param {GeoJSON} config.data 基础数据 required
   */
  constructor(config) {
    const conf = {
      data: null,
      intensity: 1.0, //光照倍数
      interact: true, //允许交互
      PDI: true, // 像素密度无关模式
      ...config,
    };
    super(conf);

    if(config.size>0){
      this._size = config.size
    }

    this.init();
  }

  init() {
    this.initData(this._conf.data);
    this.bindMethods(["handelViewChange"]);
    this.refreshTransformData();
  }

  // 处理转换图层基础数据的地理坐标为空间坐标
  initData(geoJSON) {
    const { features } = geoJSON;
    this._data = JSON.parse(JSON.stringify(features));

    const coordsArr = this.customCoords.lngLatsToCoords(
      features.map((v) => v.lngLat)
    );
    this._data.forEach((item, index) => {
      item.coords = coordsArr[index];
    });
  }

  // Layer已准备好
  async onReady() {
    // debugger 增加辅助坐标轴帮助定位
    // this.createHelper()

    // 加载主体模型
    await this.loadMainMesh();
    // 加载底座模型
    await this.loadTrayMesh();
    // 实例化模型
    this.createInstancedMeshes();

    // 鼠标交互
    this.initMouseEvent();

    //光照
    this.initLight();
  }

  /**
   * 初始化特有的交互事件
   * @private
   */
  initMouseEvent() {
    this.map.on("zoomchange", this.handelViewChange);
  }

  /**
   * 初始化尺寸字典
   * @private
   */
  handelViewChange() {
    if (this._conf.PDI) {
      this.refreshTransformData();
      this.updatePOIMesh();
    }
  }

  /**
   * @description 重新计算每个模型的目标尺寸系数
   * @private
   */
  refreshTransformData() {
    this._resolution = this.getResolution();
    this._sizeMap["main"] = this._resolution * 1;
    this._sizeMap["tray"] = this._resolution * 1;
  }

  /**
   * @description 更新所有POI实例尺寸
   */
  updatePOIMesh() {
    const { _sizeMap } = this;

    // 更新模型尺寸
    const mainMesh = this._instanceMap["main"];
    const trayMesh = this._instanceMap["tray"];

    // 重置纹理偏移
    if (this?._mtMap?.tray?.map) {
      this._mtMap.tray.map.offset.x = 0;
    }

    for (let i = 0; i < this._data.length; i++) {
      const [x, y] = this._data[i].coords;
      // 变换主体
      this.updateMatrixAt(
        mainMesh,
        {
          size: _sizeMap.main ,
          position: [x, y, 0],
          rotation: [0, 0, 0],
        },
        i
      );
      // 变换托盘
      this.updateMatrixAt(
        trayMesh,
        {
          size: _sizeMap.tray ,
          position: [x, y, 0],
          rotation: [0, 0, 0],
        },
        i
      );
    }
    // 强制更新instancedMesh实例
    if (mainMesh?.instanceMatrix) {
      mainMesh.instanceMatrix.needsUpdate = true;
    }
    if (trayMesh?.instanceMatrix) {
      trayMesh.instanceMatrix.needsUpdate = true;
    }
  }

  async loadMainMesh() {
    // 加载主体模型
    const model = await this.loadOneModel("../static/gltf/taper2.glb");
    // 缓存模型
    this._models.main = model;

    // 给模型换一种材质
    const material = new THREE.MeshStandardMaterial({
    //   color: 0xffffff, //自身颜色
      transparent: true,
      opacity: 0.8, //透明度
      metalness: 0.0, //金属性
      roughness: 0.0, //粗糙度
    //   emissive: new THREE.Color("#ffffff"), //发光颜色
    //   emissiveIntensity: 0.1,
      // blending: THREE.AdditiveBlending
    });

    this._materials.main = material;
  }

  async loadTrayMesh() {
    // 加载底部托盘
    const model = await this.loadOneModel("../static/gltf/taper1-p.glb");
    // 缓存模型
    this._models.tray = model;

    const loader = new THREE.TextureLoader();

    const texture = await loader.loadAsync(
      "../static/image/texture/texture_wave_circle4.png"
    );
    const { width, height } = texture.image;
    this._frameX = width / height;
    // xy方向纹理重复方式必须为平铺
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    // 设置xy方向重复次数，x轴有frameX帧，仅取一帧
    texture.repeat.set(1 / this._frameX, 1);

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      transparent: true,
      opacity: 0.8,
      metalness: 0.0,
      roughness: 0.6,
      depthTest: true,
      depthWrite: false,
    });

    this._materials.tray = material;
  }

  loadOneModel(sourceUrl) {
    const loader = new GLTFLoader();
    return new Promise((resolve) => {
      loader.load(
        sourceUrl,
        (gltf) => {
          // 获取模型
          const mesh = gltf.scene.children[0];
          // 放大模型以便观察
          const size = this._size;
          mesh.scale.set(size, size, size);
          // this.scene.add(mesh)
          resolve(mesh);
        },
        function (xhr) {},
        function (error) {
          console.log("loader model fail" + error);
        }
      );
    });
  }

  createInstancedMeshes() {
    const { _models, _data, _materials, scene } = this;

    const keys = Object.keys(_models);

    for (let i = 0; i < keys.length; i++) {
      // 创建实例化模型
      let key = keys[i];
      const mesh = new THREE.InstancedMesh(
        _models[key].geometry,
        _materials[key],
        _data.length
      );
      mesh.attrs = { modelId: key };
      this._instanceMap[key] = mesh;

      // 实例化
      this.updateInstancedMesh(mesh, key);
      scene.add(mesh);
    }
  }
  updateInstancedMesh(instancedMesh, modelId) {
    const { _data } = this;

    for (let i = 0; i < _data.length; i++) {
      // 获得转换后的坐标
      const [x, y] = this._data[i].coords;

      // 每个实例的尺寸
      const newSize = this._size; //* this._sizeMap[]
      this._dummy.scale.set(newSize, newSize, newSize);
      // 更新每个实例的位置
      this._dummy.position.set(x, y, i);
      this._dummy.updateMatrix();

      // 更新实例 变换矩阵
      instancedMesh.setMatrixAt(i, this._dummy.matrix);
      console.log(this._dummy.matrix);
      // 设置实例 颜色
      instancedMesh.setColorAt(i, new THREE.Color(this.getColor(i)));
    }
    // 强制更新实例
    instancedMesh.instanceMatrix.needsUpdate = true;
  }

  // 获取实例颜色示例
  getColor(index, data) {
    return index % 2 == 0 ? 0x00ffff : 0xfff200;
  }

  /**
   * @description 更新指定网格体的单个示例的变化矩阵
   * @param {instancedMesh} Mesh 网格体
   * @param {Object} transform 变化设置，比如{size:1, position:[0,0,0], rotation:[0,0,0]}
   * @param {Number} index 网格体实例索引值
   */
  updateMatrixAt(mesh, transform, index) {
    if (!mesh) {
      return;
    }
    const { size, position, rotation } = transform;
    const { _dummy } = this;
    // 更新尺寸
    _dummy.scale.set(size, size, size);
    // 更新dummy的位置和旋转角度
    _dummy.position.set(position[0], position[1], position[2]);
    _dummy.rotation.x = rotation[0];
    _dummy.rotation.y = rotation[1];
    _dummy.rotation.z = rotation[2];
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
  }

  /**
   * 增加环境光照
   * @private
   */
  initLight() {
    const { intensity } = this._conf;
    // 环境光
    const aLight = new THREE.AmbientLight(0xffffff, 1.0 * intensity);
    this.scene.add(aLight);
    // 平行光
    const dLight = new THREE.DirectionalLight(0xffffff, 1.5 * intensity);
    dLight.position.set(1, 1, 1);
    this.scene.add(dLight);
  }

  /**
   * 处理拾取事件
   * @private
   * @param targets
   * @param event
   */
  onPicked({ targets, event }) {
    let attrs = null;
    if (targets.length > 0) {
      const cMesh = targets[0].object;
      if (cMesh?.isInstancedMesh) {
        const intersection = this._raycaster.intersectObject(cMesh, false);
        // 获取目标序号
        const { instanceId } = intersection[0];
        // 设置选中状态
        this.setLastPick(instanceId);
        attrs = this._data[instanceId];
        this.container.style.cursor = "pointer";
      }
    } else {
      if (this._lastPickIndex.index !== null) {
        this.container.style.cursor = "default";
      }
      this.removeLastPick();
    }

    // 派发pick事件
    this.handleEvent("pick", {
      screenX: event?.pixel?.x,
      screenY: event?.pixel?.y,
      attrs,
    });
  }

  /**
   * 设置最后一次拾取的目标
   * @param {Number} instanceId 目标序号
   * @private
   */
  setLastPick(index) {
    this._lastPickIndex.index = index;
  }

  /**
   * 移除选中的模型状态
   */
  removeLastPick() {
    const { index } = this._lastPickIndex;
    if (index !== null) {
      // 恢复实例化模型初始状态
      const mainMesh = this._instanceMap["main"];

      const [x, y] = this._data[index].coords;
      this.updateMatrixAt(
        mainMesh,
        {
          size: this._conf.PDI ? this._sizeMap.main: this._size,
          position: [x, y, 0],
          rotation: [0, 0, 0],
        },
        index
      );
    }

    this._lastPickIndex.index = null;
  }

  /**
   * @description 更新指定网格体的单个示例的变化矩阵
   * @param {instancedMesh} Mesh 网格体
   * @param {Object} transform 变化设置，比如{size:1, position:[0,0,0], rotation:[0,0,0]}
   * @param {Number} index 网格体实例索引值
   */
  updateMatrixAt(mesh, transform, index) {
    if (!mesh) {
      return;
    }
    const { size, position, rotation } = transform;
    const { _dummy } = this;
    // 更新尺寸
    _dummy.scale.set(size, size, size);
    // 更新dummy的位置和旋转角度
    _dummy.position.set(position[0], position[1], position[2]);
    _dummy.rotation.x = rotation[0];
    _dummy.rotation.y = rotation[1];
    _dummy.rotation.z = rotation[2];
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
  }

  // 逐帧更新图层
  update() {
    const { main, tray } = this._instanceMap;
    const { _lastPickIndex, _size } = this;

    // 更新托盘纹理
    const texture = tray?.material?.map;

    if (texture) {
      this._offset += 0.6;
      texture.offset.x = Math.floor(this._offset) / this._frameX;
    }

    // 鼠标悬浮对象
    if (_lastPickIndex.index !== null) {
      const [x, y] = this._data[_lastPickIndex.index].coords;
      const newSize = this._conf.PDI ? this._sizeMap.main: this._size
      this.updateMatrixAt(
        main,
        {
          size: newSize * 1.2, // 选中的对象放大1.2倍
          position: [x, y, 0],
          rotation: [0, 0, this._currentAngle],
        },
        _lastPickIndex.index
      );
    }

    // 更新旋转角度值
    this._currentAngle = (this._currentAngle + 0.05) % this._maxAngle;

    // 强制更新instancedMesh实例，必须！
    if (main?.instanceMatrix) {
      main.instanceMatrix.needsUpdate = true;
    }
  }
}

export default POI3dLayer0;
