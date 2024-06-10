// import getData from 'https://code.juejin.cn/api/raw/7165810446271545375?id=7165810446271594527';
// import solver from 'https://code.juejin.cn/api/raw/7165811417449234464?id=7165811417449283616';
import * as THREE from 'three'

export default class GLLayer {

  // 配置项
  _conf = {
    /**
     * @typedef {Object} RenderOption 渲染器配置参数
     * @property {Boolean} [antialias=false] - 是否开启抗锯齿，让画面看起来更加平滑，有性能消耗
     * @property {String} [precision='highp'] - 着色器精度. 可以是"highp","mediump","lowp".
     */
    renderOption: {
      antialias: false,
      precision: 'highp'
    },
    // alone: true,
    zIndex: 120,
    visible: true
  }

  // 当前图层是否应该显示
  // 受conf.visible和isInZooms影响
  _visible = true

  // 图层画布
  _canvas = null

  // 图层显示范围
  _zooms = [3, 22]

  // 图层中心坐标
  _center = null

  constructor (config) {
    this._conf = Object.assign(this._conf, config)

    // 地图是必须项
    if (
      config.map === undefined ||
      config.map == null ||
      typeof config.map.getContainer !== 'function'
    ) {
      throw Error('config.map invalid')
    }
    this.map = config.map

    // 默认取地图容器
    this.container = config.container || config.map.getContainer()
    if (!this.container) {
      throw Error('config.container invalid')
    }
    this.customCoords = this.map.customCoords

    if (config.center) {
      this.updateCenter(config.center)
      this._center = config.center
    } else {
      const { lng, lat } = this.map.getCenter()
      this.updateCenter([lng, lat])
      this._center = [lng, lat]
    }

    // three相关属性
    this.camera = null
    this.renderer = null
    this.scene = null

    // 绑定this
    this.bindMethods(['animate', 'resizeLayer'])

    this.prepare()
  }

  async prepare(){
    this.initZooms()
    this.addModuleListener()
    await this.initLayer()
    this.onReady()
    this.animate()
  }

  /**
   * @abstract
   * @description GLCustomLayer已经准备好时执行,需要子类覆盖
   */
  onReady () {
    throw Error('该方法只能被子类重写')
  }

  /**
   * @abstract
   * @description 更新图层属性，需要子类覆盖
   */
  update () {
  }

  /**
   * @abstract
   * @description 每次渲染时执行
   */
  onRender () {}

  /**
   * @private
   * @description 异步初始化图层
   * @returns {}
   */
  async initLayer () {
    this.layer = await this.createGlCustomLayer()
  }

  /**
   * @public
   * @description 设置图层中心
   * @param {Array} lngLat [lng,lat]
   * @example
   * setCenter([112,37])
   */
  setCenter (lngLat) {
    this._center = lngLat
  }

  /**
   * 设置当前图层的显示状态
   * @param {Boolean} val 显示
   */
  setVisible (val) {
    this._conf.visible = val === true
    this.reviseVisible()
  }

  /**
   * 获取当前图层的显示状态
   * @returns  {Boolean}
   */
  getVisible () {
    return this._visible
  }

  /**
   * @description 修正内部visible的值
   * @params {Boolean,undefined} val
   * @private
   * @return {Boolean}
   */
  reviseVisible (val) {
    const targetValue = typeof val === 'boolean' ? val && this.isInZooms() : this.isInZooms()
    if (targetValue !== this._visible) {
      if (targetValue === false) {
        this.renderer && this.renderer.clear()
      }
    }
    this._visible = targetValue
    return this._visible
  }

  /**
   * @protected
   * @description 判断当前图层是否在可以显示的范围内
   * @returns {boolean}
   */
  isInZooms () {
    const zoom = this.map.getZoom()
    return zoom >= this._zooms[0] && zoom <= this._zooms[1]
  }

  /**
   * 创建非独立图层
   * @return  {AMap.GlCustomLayer}
   */
  createGlCustomLayer () {
    return new Promise((resolve) => {
      const layer = new AMap.GLCustomLayer({
        zIndex: this._conf.zIndex,
        visible: true, // 设置为true时才会执行init
        init: (gl) => {
          this.initThree(gl)
          this.updateCenter(this._center)

          this.reviseVisible()

          resolve(layer)
        },
        render: (gl) => {
          this.updateCamera()
          this.onRender()
        }
      })
      this.map.add(layer)
    })
  }

  /**
   * @private
   * @description 设置图层中心坐标，非常重要
   * @param {Array} lngLat
   */
  updateCenter (lngLat) {
    if (lngLat instanceof Array) {
      // 注意：customCoords是map成员，所有图层实例共享的，更改center要小心
      this.customCoords.setCenter(lngLat)
    }
    this._center = this.customCoords.getCenter()
  }

  /**
   * @private
   * @description 初始化three实例
   * @param {*} gl
   */
  initThree (gl) {
    const { clientWidth, clientHeight } = this.container
    this.camera = new THREE.PerspectiveCamera(
      60,
      clientWidth / clientHeight,
      100,
      1 << 30
    )

    const { antialias, precision } = this._conf.renderOption
    const option = {
      alpha: true,
      antialias,
      precision
    }
    option.context = gl

    const renderer = new THREE.WebGLRenderer(option)
    // 必须设置为false才能实现多个render的叠加
    renderer.autoClear = false
    renderer.setClearAlpha(0)
    renderer.setSize(clientWidth, clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)

    this.renderer = renderer
    this.scene = new THREE.Scene()
  }

  updateCamera () {
    // console.log('this.updateCamera')
    const { scene, renderer, camera, customCoords } = this
    if (!renderer) {
      return
    }
    // 保证投影正常显示
    renderer.resetState()

    // 重新定位中心，这样才能使当前图层与Loca图层共存时显示正常
    if (this._center) {
      customCoords.setCenter(this._center)
    }
    const { near, far, fov, up, lookAt, position } = customCoords.getCameraParams()

    camera.near = near // 近平面
    camera.far = far // 远平面
    camera.fov = fov // 视野范围
    camera.position.set(...position)
    camera.up.set(...up)
    camera.lookAt(...lookAt)

    // 更新相机坐标系
    camera.updateProjectionMatrix()

    if (this._visible) {
      renderer.render(scene, camera)
    }

    // 这里必须执行！重新设置 three 的 gl 上下文状态
    renderer.resetState()
  }

  /**
   * @private
   * @description 执行逐帧动画
   */
  animate (time) {
    if (!this.renderer) {
      return
    }
    if (this.update) {
      this.update(time)
      // this.handleEvent('update', this)
    }
    // if (this._conf.alone) {
    //   this.updateCamera()
    // } else if (this.map) {
      this.map.render()
    // }
    requestAnimationFrame(this.animate)
  }


  addModuleListener () {
    window.addEventListener('resize', this.resizeLayer)
  }

  /**
   * @description 更新当前视口
   * @private
   */
  resizeLayer () {
    const { clientWidth, clientHeight } = this.container
    if (this._canvas) {
      this._canvas.width = clientWidth
      this._canvas.height = clientHeight
      this._canvas.style.width = clientWidth + 'px'
      this._canvas.style.height = clientHeight + 'px'
    }
    if (this.camera) {
      this.camera.aspect = clientWidth / clientHeight
    }
  }

  /**
   * @public
   * @description 绑定方法的this指向当前对象
   */
  bindMethods (fnNames) {
    fnNames.forEach((name) => {
      this[name] = this[name].bind(this)
    })
  }

  /**
   * @protected
   * @description 控制图层显示范围
   */
  initZooms () {
    this.map.on('zoomend', (event) => {
      this.reviseVisible()
    })
  }

}
