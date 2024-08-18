import Layer from './gl-layers.js'
import * as THREE from 'three'

/**
 * 建筑单体化图层
 * @extends Layer
 * @author Zhanglinhai <gyrate.sky@qq.com>
 */
class BuildingLayer extends Layer {
  // 数据原始数据
  _data = []

  _map = null

  // 材质缓存
  _mt = null

  /**
     * 创建一个实例
     * @param {Object}   config
     * @param {GeoJSON}  config.data  建筑数据   required
     * @param {Array}    config.zooms  显示区间，默认值 [5,14]
     * @param {Obejct}   config.style 样式声明，可设置默认状态和交互状态下的颜色透明度
     */
  constructor (config) {
    const conf = {
      animate: true,
      zooms: [5, 14],
      data: null,
      interact: true,
      style: {
        initial: {
          color: '#ffffff',
          opacity: 0.3
        },
        hover: {
          color: '#ff0000',
          opacity: 0.8
        }
      },
      ...config
    }
    super(conf)
    this.initData(conf.data)
  }

  initData (geoJSON) {
    const { features } = geoJSON
    this._data = JSON.parse(JSON.stringify(features))
    this._data.forEach((feature, index) => {
      const { geometry } = feature
      const { type, coordinates } = geometry
      if (type === 'MultiPolygon') {
        feature.geometry.coordinates = coordinates.map(sub => {
          return this.customCoords.lngLatsToCoords(sub)
        })
      }
      if (type === 'Polygon') {
        feature.geometry.coordinates = this.customCoords.lngLatsToCoords(coordinates)
      }
    })
    console.log(this._data)
  }

  onReady () {
    //  this.createHelper()
    this.initMaterial()
    this.createPolygon()
  }

  // 处理拾取事件
  onPicked ({ targets, event }) {
    let attrs = null
    if (targets.length > 0) {
      const cMesh = targets[0]?.object
      // console.log(cMesh._attrs)
      if (cMesh?.type == 'Mesh') {
        this.setLastPick(cMesh)
        attrs = cMesh._attrs
      } else {
        this.removeLastPick()
      }
    } else {
      this.removeLastPick()
    }
    /**
     * 模型拾取事件
     * @event  ModelLayer#pick
     * @type {object}
     * @property {Number} screenX 图层场景
     * @property {Number} screenY 图层相机
     * @property {Object} attrs 模型属性
     */
    this.handleEvent('pick', {
      screenX: event?.pixel?.x,
      screenY: event?.pixel?.y,
      attrs
    })
  }

  setLastPick (mesh) {
    const { _lastPick, scene } = this

    if (!mesh) {
      return
    }
    if (_lastPick && _lastPick && JSON.stringify(_lastPick?._attrs) === JSON.stringify(mesh?._attrs)) {
      // mesh 与 上次选中mesh为同一个
      return
    }
    this.removeLastPick()

    mesh.material = this._mt.hover

    this._lastPick = mesh
  }

  removeLastPick () {
    const { _lastPick, scene } = this
    if (_lastPick) {
      _lastPick.material = this._mt.initial
      this._lastPick = null
    }
  }

  initMaterial () {
    const { initial, hover } = this._conf.style
    // 顶部材质
    this._mt = {}
    this._mt.initial = new THREE.MeshBasicMaterial({
      color: initial.color,
      transparent: true,
      opacity: initial.opacity,
      side: THREE.DoubleSide,
      wireframe: false
    })
    this._mt.hover = new THREE.MeshBasicMaterial({
      color: hover.color,
      transparent: true,
      opacity: hover.opacity,
      side: THREE.DoubleSide
    })
  }

  /**
     * 根据数据创建所有模型到场景
     */
  createPolygon () {
    const material = this._mt.initial

    let sideGeometryArr = []
    let topGeometryArr = []

    this._data.forEach((item, index) => {
      const { geometry, properties } = item
      const { type, coordinates } = geometry

      // 对象为单体多边形
      if (type === 'Polygon') {
        const { sides, tops } = this._createPolygon(coordinates, properties)
        sideGeometryArr = sideGeometryArr.concat(sides)
        topGeometryArr = topGeometryArr.concat(tops)
      }

      // 对象多体多边形
      if (type === 'MultiPolygon') {
        coordinates.forEach(sub => {
          const { sides, tops } = this._createPolygon(sub, properties)
          sideGeometryArr = sideGeometryArr.concat(sides)
          topGeometryArr = topGeometryArr.concat(tops)
        })
      }
    })

    // 楼层侧面
    sideGeometryArr.forEach(geometry => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh._attrs = geometry._attrs
      delete geometry._attrs
      this.scene.add(mesh)
    })

    // 楼层平面
    // topGeometryArr.forEach(geometry => {
    //     let mesh = new THREE.Mesh(geometry, material)
    //     this.scene.add(mesh)
    // })
  }

  /**
     * 根据路径绘制单个多边几何体
     * @param paths
     * @param properties
     * @returns {{tops: Array, sides: Array}}
     * @private
     */
  _createPolygon (paths = [], properties) {
    let sides = []
    let tops = []

    paths.forEach(path => {
      // 绘制侧边几何体
      const newSides = this.drawSide(path, properties)
      sides = [...sides, ...newSides]

      // 绘制顶部几何体
      const newTops = this.drawTop(path, properties)
      tops = [...tops, ...newTops]
    })
    return { sides, tops }
  }

  /**
     * @description 绘制建筑侧边
     * @param {Array} path 边界路线
     * @param {Object} option 配置项
     * @param {Number} option.height 区块高度
     * @param {String} option.name 区块名称
     */
  drawSide (path, properties) {
    // 创建立面
    const { regions } = properties
    const result = []

    for (let i = 0; i <= regions.length - 1; i++) {
      const geometry = this.createSideGeometry(path, regions[i])
      geometry._attrs = { ...regions[i] }
      result.push(geometry)
    }

    return result
  }

  /**
     * @description 绘制建筑顶部
     * @param {Array} path 区块边界数据
     * @param {Object} option 配置项
     * @param {Number} option.height 区块高度
     * @param {String} option.name 区块名称
     */
  drawTop (path, properties) {
    const { regions } = properties
    const result = []

    for (let i = 0; i <= regions.length - 1; i++) {
      const shape = new THREE.Shape()
      const { bottomAltitude, extendAltitude } = regions[i]

      path.forEach(([x, y], index) => {
        if (index === 0) {
          shape.moveTo(x, y)
        } else {
          shape.lineTo(x, y)
        }
      })

      // 顶部面
      const geometry = new THREE.ShapeGeometry(shape)
      const z = bottomAltitude + extendAltitude

      // 设置高度
      geometry.attributes.position.array.forEach((v, i) => {
        if ((i + 1) % 3 === 0) {
          geometry.attributes.position.array[i] = z
        }
      })
      result.push(geometry)
    }
    return result
  }

  /**
     * 根据路线创建侧面几何面
     * @param  {Array} path [[x,y],[x,y],[x,y]...] 路线数据
     * @param  {Number} height 几何面高度，默认为0
     * @returns {THREE.BufferGeometry}
     */
  createSideGeometry (path, region) {
    if (path instanceof Array === false) {
      throw 'createSideGeometry: path must be array'
    }
    const { id, bottomAltitude, extendAltitude } = region

    // 保持path的路线是闭合的
    if (path[0].toString() !== path[path.length - 1].toString()) {
      path.push(path[0])
    }

    const vec3List = [] // 顶点数组
    let faceList = [] // 三角面数组
    let faceVertexUvs = [] // 面的UV层队列，用于纹理和几何信息映射

    const t0 = [0, 0]
    const t1 = [1, 0]
    const t2 = [1, 1]
    const t3 = [0, 1]

    for (let i = 0; i < path.length; i++) {
      const [x1, y1] = path[i]
      vec3List.push([x1, y1, bottomAltitude])
      vec3List.push([x1, y1, bottomAltitude + extendAltitude])
    }

    for (let i = 0; i < vec3List.length - 2; i++) {
      if (i % 2 === 0) {
        // 下三角
        faceList = [
          ...faceList,
          ...vec3List[i],
          ...vec3List[i + 2],
          ...vec3List[i + 1]
        ]
        // UV
        faceVertexUvs = [...faceVertexUvs, ...t0, ...t1, ...t3]
      } else {
        // 上三角
        faceList = [
          ...faceList,
          ...vec3List[i],
          ...vec3List[i + 1],
          ...vec3List[i + 2]
        ]
        // UV
        faceVertexUvs = [...faceVertexUvs, ...t3, ...t1, ...t2]
      }
    }

    const geometry = new THREE.BufferGeometry()
    // 顶点三角面
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(faceList), 3)
    )
    // UV面
    geometry.setAttribute(
      'uv',
      new THREE.BufferAttribute(new Float32Array(faceVertexUvs), 2)
    )

    return geometry
  }

  // 更新纹理偏移量
  update () {
  }
}

export default BuildingLayer
