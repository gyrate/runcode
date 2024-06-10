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
   * @param {RotateOptions} [config.rotateOptions] - 旋转动画相关配置
   */
  constructor (config) {
    const conf = {
      altitude: 0,
      radius: 1000,
      speed: 1.0,
      textureMapURL: './static/texture/ring_0.png',
      color: '#ffffff',
      opacity: 1.0,
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
    const {  rotateOptions } = this._conf

    this._angle = rotateOptions.initAngle
  }

  async createMesh () {
    const { radius, altitude } = this._conf

    // 几何体
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2)

    // 材质
    let material = await this.generateRotateMaterial()

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
    })

    return material
  }

  update (deltaTime) {

    const { rotateOptions } = this._conf

    if (this?._mesh?.material === undefined) {
      return
    }

    if (this._angle > 360) {
      this._angle = rotateOptions.initAngle
    } else {
      this._angle += 0.1 * this._conf.speed * rotateOptions.direction
    }
    this._mesh.material.map.rotation = this._angle * Math.PI / 180
  }



}

export default HaloLayer1
