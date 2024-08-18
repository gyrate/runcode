import * as THREE from 'three'
import Layer from './gl-layers.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
const { TilesRenderer } = window._3dTilesRenderer //加载3dTilesRenderer.js

/**
 * 倾斜摄影3DTile图层
 * @extends Layer
 * @author Zhanglinhai <gyrate.sky@qq.com>
 */
class TilesLayer extends Layer {
  // 切片渲染器集
  _tilesRendererArr = []

  /**
   * 创建一个实例
   * @param {Object} config
   * @param {Array} config.center 切片模型中心坐标[lng,lat] required
   * @param {String} config.tilesURL: 数据文件路径,入口文件一般为 tileset.json required
   * @param {Array} config.zooms: 显示区间 [5,22]
   * @param {String} config.loaderURL: 模型加载器相关文件的路径，默认值'./static/three/examples/js/libs/gltf/'
   */
  constructor (config) {
    const conf = {
      zooms: [5, 22],
      tilesURL: '',
      center: null,
      loaderURL: './static/three/examples/js/libs/gltf/',
      ...config
    }
    super(conf)
  }

  onReady () {
    // 加载图层内容
    // this.createHelper()
    this.loadTiles()
  }

  getCenter () {
    return this.customCoords.getCenter()
  }

  loadTiles () {
    // b3dm文件加载器
    const dracoLoader = new DRACOLoader()
    //draco_decoder.js相关文件可以在这里获取 node_modules\three\examples\jsm\libs\draco\gltf
    dracoLoader.setDecoderPath(this.mergeSourceURL(this._conf.loaderURL))
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    const tilesRenderer = new TilesRenderer(this._conf.tilesURL)
    tilesRenderer.manager.addHandler(/\.gltf$/, loader)

    tilesRenderer.setCamera(this.camera)
    tilesRenderer.setResolutionFromRenderer(this.camera, this.renderer)
    this.scene.add(tilesRenderer.group)
    this._tilesRendererArr.push(tilesRenderer)
  }

  // 更新纹理偏移量
  update () {
    for (const tilesRenderer of this._tilesRendererArr) {
      tilesRenderer.update()
    }
  }

  // 处理拾取事件
  onPicked ({ targets, event }) {
    if (targets.length > 0) {
      // 查找自定义属性
      // const {face, object} = targets[0]
      // const batchidAttr = object.geometry.getAttribute('_batchid')
      // if (batchidAttr) {
      //   let batchTableObject = object;
      //
      //   while (!batchTableObject.batchTable) {
      //     batchTableObject = batchTableObject.parent
      //   }
      //
      //   // 获取对象所有属性
      //   const batchTable = batchTableObject.batchTable
      //   const keys = batchTable.getKeys()
      //   const hoveredBatchid = batchidAttr.getX(face.a)
      //   const batchData = keys.map(k => {
      //     return {
      //       key: k,
      //       value: batchTable.getData(k)[hoveredBatchid]
      //     }
      //   })
      //   // 打印所有属性
      //   console.log(batchData)
      // }

      // 取消上一次选中对象
      this.removeLastPick()
      // 高亮选中对象
      this.setLastPick(targets[0].object)
    } else {
      // 取消上一次选中对象
      this.removeLastPick()
    }
  }

  // 选中的对象高亮
  setLastPick (mesh) {
    const { _lastPick } = this

    if (!mesh || mesh.type !== 'Mesh') {
      return
    }
    if (_lastPick && JSON.stringify(_lastPick?.uuid) === JSON.stringify(mesh?.uuid)) {
      return
    }
    this.removeLastPick()

    mesh.material.color = new THREE.Color(246 / 255, 215 / 255, 17 / 255)
    this._lastPick = mesh
  }

  // 取消选中的对象高亮
  removeLastPick () {
    const { _lastPick } = this
    if (_lastPick) {
      this._lastPick.material.color = new THREE.Color(1, 1, 1)
    }
  }

  getParentObject ({ object }, { name }) {
    do {
      if (object.name === name) {
        return object
      }
      object = object.parent
    } while (object)
    return undefined
  }
}

export default TilesLayer
