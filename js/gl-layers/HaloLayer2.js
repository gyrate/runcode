import SpreadShader from './shaders/HaloCircle.js'
import Layer from './gl-layers.js'
import * as THREE from 'three'

class HaloLayer1 extends Layer {
  // 缓存旋转角度
  _angle = 0

  // 扩散步长
  _spreadStep = 0

  // 缓存网格体
  _mesh = null

  /**
   * 创建一个实例
   * @param {Object} config
   * @param {Number} [config.radius=1000] 网格体的半径
   * @param {Number} [config.speed=1] 光圈动画速度倍率
   * @param {String} [config.easingFunction = 'Easing.Linear.None'] 缓动函数
   * @param {String} [config.textureMapURL] 贴图的路径
   * @param {String} [config.color='#ffffff'] 光圈颜色
   * @param {Number} [config.opacity=1.0] 整体透明度
   * @param {Number[]}  config.center 光圈的圆心，如果不指定则使用当前地图中心
   * @param {Number} [config.altitude=0] 网格体的海拔位置高度
   * @param {('rotate'|'spread')}  [config.mode='rotate'] 动画模式
   * @param {SpreadOptions} [config.spreadOptions] - mode="spread"时，扩散动画相关配置
   * @param {RotateOptions} [config.rotateOptions] - mode="rotate"时，旋转动画相关配置
   */
  constructor (config) {
    const conf = {
      altitude: 0,
      radius: 1000,
      speed: 1.0,
      textureMapURL: './static/texture/ring_0.png',
      color: '#ffffff',
      opacity: 1.0,
      mode: 'rotate',
      /**
       * 旋转动画配置
       * @typedef {Object} RotateOptions
       * @property {-1|1} [direction=1] - 旋转方向，1为正向，-1为反向
       * @property {number} [initialAngle=0] - 旋转初始角度(度),默认为0
       */
      rotateOptions: {
        direction: 1,
        initAngle: 0
      },
      /**
       * 扩散动画配置
       * @typedef {Object} SpreadOptions
       * @property {number} [initialRadius=0] - 扩散初始半径,默认为0
       * @property {number} [maxRadius] - 扩散最大半径,不指定则没有限制
       * @property {number} [radiusIncrement=1] - 每次扩散半径的增量
       * @property {number} [circleWidth] - 环形的宽度,不指定则默认为半径的1/10
       */
      spreadOptions: {
        initRadius: 0,
        circleWidth: null,
        center: null
      },
      ...config
    }
    super(conf)
    this.initData(conf.data)
  }

  // 处理转换图层基础数据的地理坐标为空间坐标
  initData (geoJSON) {
  }

  // Layer已准备好
  async onReady () {
    this.initOptions()
    await this.createMesh()
  }

  /**
   * 根据当前模式初始化各种配置
   */
  initOptions () {
    const { mode, rotateOptions, spreadOptions, radius } = this._conf

    switch (mode) {
      case 'rotate':
        this._angle = rotateOptions.initAngle
        break
      case 'spread':
        this._spreadStep = Math.max(this._conf.radius / 240, 1.0)
        const { circleWidth, center, initRadius, repeat } = spreadOptions
        // 环形宽度
        if (circleWidth === undefined) {
          spreadOptions.circleWidth = Math.max(1, parseInt(radius / 10))
        }
        // 初始半径
        if (initRadius === undefined) {
          spreadOptions.initRadius = 0
        }
        // 环的圆心
        if (center instanceof Array === false) {
          spreadOptions.center = [0, 0]
        }
        // 重复次数
        if (repeat instanceof Array === false) {
          spreadOptions.repeat = [1, 1]
        }
        break
      default:
        break
    }
  }

  async createMesh () {
    const { radius, altitude, mode } = this._conf

    // 几何体
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2)

    // 材质
    let material = null
    switch (mode) {
      case 'rotate':
        material = await this.generateRotateMaterial()
        break
      case 'spread':
        material = await this.generateSpreadMaterial()
        break
        break
      default:
        break
    }

    // 网格体
    const plane = new THREE.Mesh(geometry, material)
    plane.position.set(0, 0, altitude)
    this.scene.add(plane)

    this._mesh = plane
  }


  /**
   * 设置光圈半径
   * @param value {Number} 半径数值
   */
  setRadius (value) {
    this._conf.radius = value
    const newGeometry = new THREE.PlaneGeometry(value * 2, value * 2)
    this._mesh.geometry = newGeometry
  }

  /**
   * 设置网格体高度
   * @param value {Number} 半径数值
   */
  setAltitude (value) {
    this._mesh.position.set(0, 0, value)
  }

  /**
   * 创建旋转动画的材质
   * @private
   */
  async generateRotateMaterial () {
    const { textureMapURL, color, opacity } = this._conf
    const texture = await new THREE.TextureLoader().load(textureMapURL)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.center = new THREE.Vector2(0.5, 0.5)

    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      opacity,
      color
      // blending: THREE.CustomBlending,
      // blendSrc: THREE.OneFactor,
      // blendDst: THREE.OneFactor
    })

    return material
  }

  /**
   * 创建扩散动画的材质
   * @private
   */
  async generateSpreadMaterial () {
    const { textureMapURL, radius, spreadOptions, color } = this._conf
    const { initRadius, circleWidth, center, repeat } = spreadOptions
    const texture = await new THREE.TextureLoader().load(textureMapURL)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.center = new THREE.Vector2(0.5, 0.5)

    const { vertexShader, fragmentShader } = SpreadShader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        innerCircleWidth: { value: initRadius },
        circleWidth: { value: circleWidth },
        color: { value: new THREE.Color(color || 0xffffff) },
        opacity: { value: 0.8 },
        center: { value: new THREE.Vector3(center[0], center[1]) },
        radius: { value: radius },
        textureMap: { value: texture },
        repeat: { value: new THREE.Vector2(repeat[0], repeat[1]) }
      },
      vertexShader,
      fragmentShader,
      transparent: true
    })
    return material
  }

  update (deltaTime) {
    // return
    const { speed, radius, mode, rotateOptions, spreadOptions } = this._conf

    if (this?._mesh?.material === undefined) {
      return
    }

    switch (mode) {
      case 'rotate':
        if (this._angle > 360) {
          this._angle = rotateOptions.initAngle
        } else {
          this._angle += 0.1 * this._conf.speed
        }
        this._mesh.material.map.rotation = this._angle * Math.PI / 180
        break
      case 'spread':
        const { innerCircleWidth } = this._mesh.material.uniforms
        innerCircleWidth.value += this._spreadStep
        if (innerCircleWidth.value > radius) {
          innerCircleWidth.value = spreadOptions.initRadius
        }
        break
      default:
        break
    }
  }



}

export default HaloLayer1
