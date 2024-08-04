
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import Layer from './gl-layers.js'

/**
 *  @description 3D POI 图层
 *  @extends Layer
 *  @author Zhanglinhai <gyrate.sky@qq.com>
 */
class POI3dLayer extends Layer {
  // 最后一次高亮的物体信息
  _lastPickIndex = {
    index: null,
    modelId: 'main'
  }

  // 设备信息 { modelId: [{id, name, lngLat, xy}...] }
  _data = []

  // 模型示例结组
  _group = null

  // 所有模型设定集合
  _models = []

  // 材质缓存
  _mtMap = {}

  // 累计纹理偏移量
  _offset = 0

  // 纹理图片帧数，通过计算图片宽高比获得
  _frameX = 1

  // 初始移动位置
  _currentPosition = 0

  // 初始移动方向
  _moveDirection = 1

  // 当前旋转角度
  _currentAngle = 0

  // 最大旋转角度
  _maxAngle = Math.PI * 2

  // 用于做定位和移动的介质
  _dummy = new THREE.Object3D()

  // POI颜色字典
  _colorMap = {}

  // 点亮的POI索引数组
  _highLightIndexArray = []

  // 缓存现阶段各模型尺寸
  _sizeMap = {}
  // 缓存现阶段各模型位置
  _altitudeMap = {}

  // _labelMarkers = []

  _maxMainAltitude = 0
  _minMainAltitude = 0
  _mainAltitudeSpeed = 0

  // 便于查找instancedMesh
  _instancedMeshMap = {}

  _resolution = 0

  // 数据有自己的动画渲染函数的列表，重渲染的时候使用数据的渲染函数，不使用默认的渲染
  _customRendererList = []
  // 有渲染函数的索引值，用于判断
  _customRendererIds = []

  /**
   *  创建一个实例
   *  @param {Object}   config
   *  @param {GeoJSON|Array}  config.data  图层数据
   *  @param {ColorStyle}   [config.colorStyle] 顔色配置
   *  @param {LabelConfig}   [config.label] 用于显示POI顶部文本
   *  @param {ModelConfig[]}  [config.models] POI 模型的相关配置数组,前2个成员modelId必须为main和tray
   *  @param {Number}   [config.maxMainAltitude=1.0] 动画状态下，相对于初始位置的向上最大值, 必须大于minMainAltitude
   *  @param {Number}   [config.minMainAltitude=0]   动画状态下，相对于初始位置的向下最小距离, 可以为负数
   *  @param {Number}   [config.mainAltitudeSpeed=1.0] 动画状态下，垂直移动速度系数
   *  @param {Number}   [config.rotateSpeed=1.0] 动画状态下，旋转速度
   *  @param {Number}   [config.traySpeed=1.0] 动画状态下，圆环波动速度
   *  @param {Array}    [config.scale=1.0] POI尺寸系数, 会被models[i].size覆盖
   *  @param {Boolean}  [config.PDI=false] 像素密度无关(Pixel Density Independent)模式，开启后POI尺寸不会随着缩放而变化
   *  @param {Number}   [config.intensity=1.0] 图层的光照强度系数
   *  @param {Boolean}  [config.interact=true] 是否可交互
   */
  constructor (config) {
    const conf = _.merge({
      zooms: [4, 22],
      interact: true,
      // models: [],
      intensity: 1.0,
      animate: true,
      // POI尺寸,优先级低于models[i].size
      scale: 1.0,
      /**
       * @typedef {Object} ColorStyle POI颜色配置字典
       * @property {Object.<number|string, string>} [map] - 颜色配置字典
       * @property {string|null} [fieldName] - 用于获取颜色的字段
       */
      colorStyle: {
        map: {
          0: '#be393a',
          1: '#f97f17',
          2: '#ffe056',
          3: '#2f81f7'
        },
        fieldName: null
      },
      /**
       * @typedef {Object} LabelConfig  POI顶部文本配置
       * @property {string} [fieldName='label'] - 用于获取文本的字段
       * @property {number} [altitude=30] - 文本海拔高度
       */
      label: {
        fieldName: 'label',
        altitude: 30
      },
      // 模型相关配置
      models: [],
      // 垂直向上最大值
      maxMainAltitude: 1.0,
      // 垂直向下最小值
      minMainAltitude: 0,
      // 垂直移动速度系数
      mainAltitudeSpeed: 1.0,
      // 旋转速度
      rotateSpeed: 1.0,
      // 圆环波动速度
      traySpeed: 1.0,
      // 像素密度无关模式
      PDI: false
    }, config)

    super(conf)

    /**
     * @typedef {Object} ModelConfig 模型配置
     * @property {string} [modelId='main','tray'] - 模型的ID
     * @property {string} [name='主体'] - 模型的名称
     * @property {number} [size=1.0] - 模型的大小
     * @property {number} [altitude=1.0] - 模型的高度
     * @property {string} [sourceUrl='./static/gltf/taper1.glb'] - 模型的源URL
     */
    this._models = _.merge([{
      modelId: 'main',
      name: '主体',
      size: 1.0,
      altitude: 1.0,
      sourceUrl: './static/gltf/taper1.glb'
    }, {
      modelId: 'tray',
      name: '托盘',
      size: 2.0,
      altitude: 0,
      sourceUrl: './static/gltf/taper1-p.glb'
    }], conf.models)

    this.loader = null

    if (conf.data) {
      this.data = conf.data
    }
    this.init()
  }

  get data () {
    return this._data
  }

  set data (geoJSON) {
    const { features } = geoJSON

    let coordsArr = []

    if (features) {
      // geoJSON格式
      this._data = features.map(v => {
        const { properties, geometry } = v
        return {
          ...properties,
          lngLat: geometry.coordinates
        }
      })
      coordsArr = this.customCoords.lngLatsToCoords(features.map(v => v.geometry.coordinates))
    } else if (Array.isArray(geoJSON)) {
      // Array格式
      this._data = geoJSON
      coordsArr = this.customCoords.lngLatsToCoords(geoJSON.map(v => v.lngLat))
    } else {
      console.error('poi3dlayer: this._data invalid')
      return false
    }
    // 将3D层空间坐标赋值给每个数据
    this._customRendererList = []
    this._customRendererIds = []
    this._data.forEach((item, index) => {
      item.coords = coordsArr[index]
      if (item.renderer) {
        this._customRendererList.push({
          index,
          data: item
        })
        this._customRendererIds.push(index)
      }
    })

    if (this._data.length > 0) {
      // 重置高亮POI
      this.resetHeightLightIndexArray()
      // 更新模型
      this.updateModel()
    } else {
      this.clear()
    }
  }

  init () {
    this.initColorMap()
    this.refreshTransformData()
    this.bindMethods(['handleContainerClick', 'handelViewChange', 'handelZoomChange'])
  }

  /**
   * @description 图层销毁前执行
   */
  beforeDestroy () {
    // this.clearLabelMarkers()
    if (this.container) {
      this.container.removeEventListener('click', this.handleContainerClick)
    }
    if (this.map) {
      this.map.off('zoomchange', this.handelViewChange)
      this.map.off('zoomend', this.handelZoomChange)
    }
  }

  onRender () {
  }

  async onReady () {
    // 更新模型
    await this.updateModel()

    // 鼠标交互
    this.initMouseEvent()

    this.initLight()

    this.handleEvent('ready', this)

    // this.createHelper()
  }

  /**
   * 初始化颜色字典
   * @private
   */
  initColorMap () {
    const { map } = this._conf.colorStyle
    this._colorMap = {}
    Object.keys(map).forEach(key => {
      this._colorMap[key] = new THREE.Color(map[key])
    })
  }

  /**
   * 初始化尺寸字典
   * @private
   */
  handelViewChange () {
    // console.log('handelViewChange')
    if (this._conf.PDI) {
      this.refreshTransformData()
      this.updatePOIMesh()
    }
  }

  /**
   * @description 更新模型变换相关的过程属性
   * @private
   */
  refreshTransformData () {
    const { _conf } = this

    this._resolution = this.getResolution() * this._conf.scale

    this._models.forEach(model => {
      const {
        size,
        altitude,
        modelId
      } = model
      // 模型大小
      this._sizeMap[modelId] = this._resolution * 3 * (size !== undefined ? size : this._conf.scale)
      // 模型垂直位置
      this._altitudeMap[modelId] = this._resolution * altitude / 0.08
    })

    // 初始位置 + 最大垂直向上移动距离
    this._maxMainAltitude = this._altitudeMap.main + _conf.maxMainAltitude * this._resolution / 0.08
    // 初始位置 + 最小垂直向下移动距离
    this._minMainAltitude = this._altitudeMap.main + _conf.minMainAltitude * this._resolution / 0.08
    // 移动速度
    this._mainAltitudeSpeed = _conf.mainAltitudeSpeed * this._resolution
    // console.info(`this._altitudeMap.main ${this._altitudeMap.main},  minMainAltitude ${this._minMainAltitude}, maxMainAltitude ${this._maxMainAltitude}, mainAltitudeSpeed ${this._mainAltitudeSpeed}`)
  }

  /**
   * 地图缩放结束后触发
   * @private
   */
  handelZoomChange () {
    if (this._conf.PDI) {
      // this.setLabelMarkers({ altitude: this._resolution * 75 })
    }
    if (this._visible && this.isInZooms()) {
      // this._labelMarkers.forEach(v => {
      //   v && v.show()
      // })
    } else {
      // this._labelMarkers.forEach(v => {
      //   v && v.hide()
      // })
    }
  }

  /**
   * 获取个体的颜色,
   * 通过colorStyle.fieldName指定的属性取颜色，如果没有则通过索引值取颜色
   * @private
   * @param {Object} item 个体属性
   * @param {Number} index 个体的索引值
   * @returns {THREE.Color}
   */
  getColorByColorField (item, index) {
    const { fieldName } = this._conf.colorStyle
    const key = fieldName == null ? (index % Object.keys(this._colorMap).length) : item[fieldName]
    return this._colorMap[key] || new THREE.Color('#ffffff')
  }

  /**
   * 增加环境光照，让POI更亮
   * @private
   */
  initLight () {
    const { intensity } = this._conf
    // 环境光
    const aLight = new THREE.AmbientLight(0xffffff, 1.0 * intensity)
    this.scene.add(aLight)
    // 平行光
    const dLight = new THREE.DirectionalLight(0xffffff, 1.5 * intensity)
    dLight.position.set(1, 1, 1)
    this.scene.add(dLight)
  }

  /**
   * 处理拾取事件
   * @private
   * @param targets
   * @param event
   */
  onPicked ({ targets, event }) {
    
    let attrs = null
    if (targets.length > 0) {
      const cMesh = targets[0].object
      if (cMesh?.isInstancedMesh) {
        const intersection = this._raycaster.intersectObject(cMesh, false)
        // 获取目标序号
        const { instanceId } = intersection[0]
        // 设置选中状态
        this.setLastPick(instanceId)
        attrs = this._data[instanceId]
        this.container.style.cursor = 'pointer'
      }
    } else {
      if (this._lastPickIndex.index !== null) {
        // 如果上次有选中，这次事件无选中，才改变鼠标状态，防止改变其他图层的鼠标状态
        this.container.style.cursor = 'default'
      }
      this.removeLastPick()
    }

    // if (attrs) {
    //   this.container.style.cursor = 'pointer'
    // } else {
    //   this.container.style.cursor = 'default'
    // }

    // 派发pick事件
    this.handleEvent('pick', {
      screenX: event?.pixel?.x,
      screenY: event?.pixel?.y,
      attrs
    })
  }

  // activeLabelMark (index) {
  //   const mt = this._labelMarkers[index]
  //   if (mt) {
  //     const content = mt.getContent()
  //     mt.setContent(content.replace('label-marker', 'label-marker active'))
  //   }
  // }
  //
  // unActiveLabelMark (index) {
  //   const mt = this._labelMarkers[index]
  //   if (mt) {
  //     const content = mt.getContent()
  //     mt.setContent(content.replace('label-marker active', 'label-marker'))
  //   }
  // }

  /**
   * 设置最后一次拾取的目标
   * @param {Number} instanceId 目标序号
   * @private
   */
  setLastPick (index) {
    this._lastPickIndex.index = index
  }

  /**
   * 移除选中的模型状态
   * @private
   */
  removeLastPick () {
    const { index } = this._lastPickIndex
    if (index !== null) {
      // console.log('removeLastPick')
      // 恢复实例化模型初始状态
      const mainMesh = this.getMeshByModelId('main')

      const [x, y] = this._data[index].coords
      this.updateMatrixAt(mainMesh, {
        size: this._sizeMap.main,
        position: [x, y, this._altitudeMap.main],
        rotation: [0, 0, 0]
      }, index)
    }

    this._lastPickIndex.index = null
  }

  /**
   * 加载单个模型
   * @private
   * @param modelSetting
   * @param index
   * @returns {Promise<unknown>}
   */
  loadOneModel (modelSetting, index) {
    const { _models } = this
    const { modelId, sourceUrl } = modelSetting

    return new Promise(resolve => {
      const { model } = _models.find(v => v.modelId === modelId) || {}
      if (model !== undefined) {
        resolve()
      } else {
        
        this.loader.load(this.mergeSourceURL(sourceUrl), (gltf) => {
          // 获取模型
          const mesh = gltf.scene.children[0]
          // 缓存模型
          _models[index].model = mesh
          resolve()
        },
        function (xhr) {
          // console.log((xhr.loaded / xhr.total * 100) + '% loaded')
        },
        function (error) {
          console.log('loader model fail' + error)
        })
      }
    })
  }

  /**
   * 加载模型
   * @private
   * @returns {Promise<void>}
   */
  async loadModel () {
    if (this.loader === null) {
      this.loader = new GLTFLoader()
    }
    if (this._group === null) {
      this._group = new THREE.Group()
      this.scene.add(this._group)
    }
    for (let i = 0; i < this._models.length; i++) {
      await this.loadOneModel(this._models[i], i)
    }
    this.handleEvent('loadModelCompleted', {
      modelsMap: this._models
    })
  }

  /**
   * 清空模型
   * @private
   */
  clearModel () {
    if (!this._group) {
      return
    }
    const children = this._group.children
    do {
      this._group.remove(children[0])
    } while (children.length > 0)
  }

  /**
   * 通过modelId获取模型配置
   * @param modelId
   * @returns {*}
   */
  getModelConfById (modelId) {
    const match = this._models.find(v => v.modelId === modelId)
    return match
  }

  /**
   * 初始化特有的交互事件
   * @private
   */
  initMouseEvent () {
    this.container.addEventListener('click', this.handleContainerClick)
    this.map.on('zoomchange', this.handelViewChange)
    this.map.on('zoomend', this.handelZoomChange)
  }

  /**
   * @description处理容器点击事件
   * @param event
   */
  handleContainerClick (event) {
    const { _lastPickIndex, _data } = this
    if (_lastPickIndex.index == null) {
      return
    }
    this.handleEvent('click', {
      screenX: event?.clientX,
      screenY: event?.clientY,
      attrs: _data[_lastPickIndex.index]
    })
  }

  /**
   * 更新当前视图的模型
   * @private
   * @returns {Promise<void>}
   */
  async updateModel () {
    if (!this.scene) {
      return
    }
    if (this._data.length <= 0) {
      this.clear()
      return
    }
    await this.loadModel()

    // 创建材质
    this.createMainMaterial()
    await this.createTrayMaterial()
    // 创建模型
    await this.createInstancedMeshes()

    this.clearModel()

    // 根据models声明。创建实例化网格InstancedMesh
    // this.updateInstancedMesh()
    const { _models } = this
    for (let i = 0; i < _models.length; i++) {
      const mesh = await this.updateInstancedMesh(_models[i], this._data)
      this._instancedMeshMap[_models[i].modelId] = mesh
      this._group.add(mesh)
    }

    // this.updateMarker()
  }

  /**
   * 更新告警数量浮标
   * 等AMap新版本支持altitude后再优化为labelMarker
   */
  updateMarker () {
    const { map, _conf } = this

    // 清空之前的marker
    // this.clearLabelMarkers()

    const fieldName = _conf.label.fieldName

    // 创建新的marker
    this._data.forEach(item => {
      if (item[fieldName] <= 0 || ['', undefined, null].includes(item[fieldName])) {
        this._labelMarkers.push(null)
        return
      }
      const [lng, lat] = item.lngLat
      const marker = new AMap.Marker({
        offset: [-30, -15],
        position: [lng, lat, this._resolution * 75],
        content: `<div class="gl-label-marker" style="width: 60px; color:#fff;text-align: center;font-weight: bold;">${item[fieldName]}</div>`,
        map
      })
      this._labelMarkers.push(marker)
    })
  }

  /**
   * @description 清空所有label marker
   * @orivate
   */
  clearLabelMarkers () {
    if (this.map) {
      this.map.remove(this._labelMarkers.filter(v => v !== null))
    }
    this._labelMarkers = []
  }

  setLabelMarkers ({ altitude = 0 }) {
    this._labelMarkers.filter(v => v !== null).forEach(v => {
      const { lng, lat } = v.getPosition()
      v.setPosition([lng, lat, altitude])
    })
    // console.log('setLabelMarkers')
  }

  /**
   * 创建托盘材质
   * @returns {Promise<*>}
   */
  async createTrayMaterial () {
    const loader = new THREE.TextureLoader()
    //todo: conf source'URL
    const texture = await loader.loadAsync(this.mergeSourceURL('./static/image/texture/texture_wave_circle4.png'))

    const { width, height } = texture.image
    this._frameX = width / height
    // xy方向纹理重复方式必须为平铺
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    // 设置xy方向重复次数，x轴有frameX帧，仅取一帧
    texture.repeat.set(1 / this._frameX, 1)

    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: texture,
      transparent: true,
      opacity: 0.8,
      metalness: 0.0,
      roughness: 0.6,
      depthTest: true,
      depthWrite: false
      // emissiveIntensity: 1.0,
      // blending: THREE.AdditiveBlending
    })
    this._mtMap.tray = material
  }

  /**
   * 创建主体材质
   * @returns {*}
   */
  createMainMaterial () {
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      metalness: 0.0,
      roughness: 0.5,
      // emissive: new THREE.Color('#ff6302'),
      // emissiveIntensity: 0.5,
      // blending: THREE.AdditiveBlending
    })
    this._mtMap.main = material
  }

  /**
   * 创建所有声明的实例化网格体
   * @private
   */
  async createInstancedMeshes () {
    const { _models, _data, _mtMap } = this
    for (let i = 0; i < _models.length; i++) {
      const { model, modelId } = _models[i]
      const mt = _mtMap[modelId]
      const mesh = new THREE.InstancedMesh(model.geometry, mt, _data.length)
      mesh.attrs = { modelId }
      _models[i].instancedMesh = mesh
    }
  }

  /**
   * @description 更新一种实例化网格体
   * @private
   * @param {Object} modelConf 模型配置
   * @param {Array} data 原始数据
   * @returns {THREE.InstancedMesh}
   */
  async updateInstancedMesh (modelConf, data) {
    const { instancedMesh, modelId } = modelConf
    const instanceCount = data.length

    const newSize = this._sizeMap[modelId]
    this._dummy.scale.set(newSize, newSize, newSize)

    for (let i = 0; i < instanceCount; i++) {
      const { id, coords } = data[i]
      // 设置位置
      this._dummy.position.set(coords[0], coords[1], this._altitudeMap[modelId])
      this._dummy.updateMatrix()
      instancedMesh.setMatrixAt(i, this._dummy.matrix)
      // 设置颜色
      instancedMesh.setColorAt(i, this.getColorByColorField(data[i], i))
    }
    return instancedMesh
  }

  /**
   * @description 通过id获取地图中模型实例
   * @param {String} id 模型实例id
   * @returns {Mesh}
   */
  getModelById (id) {
    const res = this._group.children.find(v => v._attrs.id === id)
    return res || null
  }

  /**
   * @description 通过模型id查找实例化网格
   * @param modelId
   */
  getMeshByModelId (modelId) {
    return this?._instancedMeshMap[modelId] || null
  }

  clear () {
    this._highLightIndexArray = []
    this._lastPickIndex.index = null
    this.clearModel()
    if (this.renderer) {
      this.renderer.clear()
    }
  }

  /**
   * @description 逐帧更新图层动画
   * @private
   */
  update (time) {
    const { _conf, _maxAngle, _highLightIndexArray, _lastPickIndex, _sizeMap } = this
    if (!this._isAnimate) {
      return
    }
    // 更新托盘纹理
    if (this?._mtMap?.tray?.map) {
      this._offset += _conf.traySpeed * 0.6
      this._mtMap.tray.map.offset.x = Math.floor(this._offset) / this._frameX
    }

    const mainMesh = this.getMeshByModelId('main')

    // 更新主体动画
    if (mainMesh) {
      // 更新主体位置
      this._currentPosition += this._moveDirection * this._mainAltitudeSpeed
      if (this._currentPosition >= this._maxMainAltitude) {
        this._currentPosition = this._maxMainAltitude
        this._moveDirection *= -1
      } else if (this._currentPosition <= this._minMainAltitude) {
        this._currentPosition = this._minMainAltitude
        this._moveDirection *= -1
      }

      // 如果数据中有render函数，调用数据的render函数，并跳过下面的设置状态
      this._customRendererList.forEach(v => {
        const renderInfo = v.data.renderer(Object.assign(_conf, {
          size: _sizeMap.main,
          altitude: this._altitudeMap
        }))
        // console.log('renderInfo', renderInfo)
        this.updateMatrixAt(mainMesh, renderInfo, v.index)
      })

      // 更新主体旋转角度
      this._currentAngle = (this._currentAngle + _conf.rotateSpeed * 0.05) % _maxAngle

      // 高亮对象
      for (let i = 0; i < _highLightIndexArray.length; i++) {
        const index = _highLightIndexArray[i]
        if (this._customRendererIds.includes(index)) {
          continue
        }
        const [x, y] = this._data[index].coords
        this.updateMatrixAt(mainMesh, {
          size: _sizeMap.main,
          position: [x, y, this._currentPosition],
          rotation: [0, 0, this._currentAngle]
        }, index)
      }

      // 鼠标悬浮对象
      if (_lastPickIndex.index !== null && !this._customRendererIds.includes(_lastPickIndex.index)) {
        const [x, y] = this._data[_lastPickIndex.index].coords
        this.updateMatrixAt(mainMesh, {
          size: _sizeMap.main * 1.2,
          position: [x, y, this._currentPosition],
          rotation: [0, 0, this._currentAngle]
        }, _lastPickIndex.index)
      }

      // 强制更新instancedMesh实例
      if (mainMesh?.instanceMatrix) {
        mainMesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  /**
   * @description 更新所有POI实例尺寸
   */
  updatePOIMesh () {
    const { _sizeMap } = this

    // 更新模型尺寸
    const mainMesh = this.getMeshByModelId('main')
    const trayMesh = this.getMeshByModelId('tray')

    // 重置纹理偏移
    if (this?._mtMap?.tray?.map) {
      this._mtMap.tray.map.offset.x = 0
    }
    // 重置初始位移
    this._currentPosition = 0

    for (let i = 0; i < this._data.length; i++) {
      const [x, y] = this._data[i].coords
      // 变换主体
      this.updateMatrixAt(mainMesh, {
        size: _sizeMap.main,
        position: [x, y, this._altitudeMap.main + this.getRandomValue()],
        rotation: [0, 0, 0]
      }, i)
      // 变换托盘
      this.updateMatrixAt(trayMesh, {
        size: _sizeMap.tray,
        position: [x, y, this._altitudeMap.tray + this.getRandomValue()],
        rotation: [0, 0, 0]
      }, i)
    }
    // 强制更新instancedMesh实例
    if (mainMesh?.instanceMatrix) {
      mainMesh.instanceMatrix.needsUpdate = true
    }
    if (trayMesh?.instanceMatrix) {
      trayMesh.instanceMatrix.needsUpdate = true
    }
  }

  getRandomValue () {
    return Math.random() * 2 - 1
  }

  /**
   * @description 重置所有高亮的POI为初始状态
   */
  resetHeightLightIndexArray () {
    const { _highLightIndexArray } = this
    if (_highLightIndexArray.length > 0) {
      const mainMesh = this.getMeshByModelId('main')
      const { altitude } = this.getModelConfById('main')

      for (let i = 0; i < _highLightIndexArray.length; i++) {
        const [x, y] = this._data[i].coords
        this.updateMatrixAt(mainMesh, {
          size: this._sizeMap.main,
          position: [x, y, altitude],
          rotation: [0, 0, 0]
        }, i)
      }
    }
    this._highLightIndexArray = []
  }

  /**
   * @description 更新指定网格体的单个示例的变化矩阵
   * @param {instancedMesh} Mesh 网格体
   * @param {Object} transform 变化设置，比如{size:1, position:[0,0,0], rotation:[0,0,0]}
   * @param {Number} index 网格体实例索引值
   */
  updateMatrixAt (mesh, transform, index) {
    if (!mesh) {
      return
    }
    const { size, position, rotation } = transform
    const { _dummy } = this
    // 更新尺寸
    _dummy.scale.set(size, size, size)
    // 更新dummy的位置和旋转角度
    _dummy.position.set(position[0], position[1], position[2])
    _dummy.rotation.x = rotation[0]
    _dummy.rotation.y = rotation[1]
    _dummy.rotation.z = rotation[2]
    _dummy.updateMatrix()
    mesh.setMatrixAt(index, _dummy.matrix)
  }

  /**
   * @description 将指定id的元素点亮
   * @param {Array} array
   */
  lightUp (ids) {
    const indexArray = ids.map(v => {
      return this._data.findIndex(v2 => v2.id === v)
    })
    // 去重合并数组
    this._highLightIndexArray = _.union(this._highLightIndexArray, _.without(indexArray, -1))
    // console.log(this._highLightIndexArray)
  }

  /**
   * @description 将指定id的元素熄灭
   * @param {Array} ids
   */
  lightOff (ids) {
    const indexArray = ids.map(v => {
      return this._data.findIndex(v2 => v2.id === v)
    })
    // 获取数组this._highLightIndexArray和indexArray的差集
    this._highLightIndexArray = _.difference(this._highLightIndexArray, indexArray)
    // console.log(this._highLightIndexArray)
  }

  /**
   * @description 切换指定id的元素的亮灭状态
   * @param {String} id
   */
  switchLight (id) {
    const index = this._data.findIndex(v => v.id === id)
    if (this._highLightIndexArray.includes(index)) {
      this.lightOff([id])
    } else {
      this.lightUp([id])
    }
  }

}

export default POI3dLayer
