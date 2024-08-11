import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import Layer from './gl-layers.js'


/**
 * @description 自定义图层模板，继承自Layer
 * @see {@link https://lbs.iot-cas.com/gl-layers/docs/demos/index.html#/BuildingLayer}
 * @extends Layer
 * @author Zhanglinhai <gyrate.sky@qq.com>
 */
class POI3dLayer0 extends Layer {

    // 缓存模型
    _models = {}
    // 纹理图片帧数，通过计算图片宽高比获得
    _frameX = 1
    // 托盘纹理的偏移量，用于实现动画
    _offset = 0

    // 主体旋转角度
    _currentAngle = 0

    /**
     * 创建一个实例
     * @param {Object} config
     * @param {GeoJSON} config.data 基础数据 required
     */
    constructor(config) {
        const conf = {
            data: null,
            intensity: 1.0, //光照倍数
            ...config
        }
        super(conf)
        this.initData(conf.data)
    }

    // 处理转换图层基础数据的地理坐标为空间坐标
    initData(geoJSON) {
        const { features } = geoJSON
        this._data = JSON.parse(JSON.stringify(features))
    }

    // Layer已准备好
    async onReady() {

        // debugger 增加辅助坐标轴帮助定位
        this.createHelper()

        // 主体
        await this.createMainMesh()
        // 底座
        await this.createTrayMesh()

        //光照
        this.initLight()

    }

    async createMainMesh() {
        // 加载主体模型
        const model = await this.loadOneModel('../static/gltf/taper2.glb')
        // 缓存模型
        this._models.main = model

        // 给模型换一种材质
        const material = new THREE.MeshStandardMaterial({
            color: 0x1171ee, //自身颜色
            transparent: true,
            opacity: 1, //透明度
            metalness: 0.0, //金属性
            roughness: 0.5, //粗糙度
            // emissive: new THREE.Color('#1171ee'), //发光颜色
            // emissiveIntensity: 0.2,
            // blending: THREE.AdditiveBlending
        })
        model.material = material
    }

    async createTrayMesh() {
        // 加载底部托盘
        const model = await this.loadOneModel('../static/gltf/taper1-p.glb')
        // 缓存模型
        this._models.tray = model

        const loader = new THREE.TextureLoader()

        const texture = await loader.loadAsync('../static/image/texture/texture_wave_circle4.png')
        const { width, height } = texture.image
        this._frameX = width / height
        // xy方向纹理重复方式必须为平铺
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        // 设置xy方向重复次数，x轴有frameX帧，仅取一帧
        texture.repeat.set(1 / this._frameX, 1)

        const material = new THREE.MeshStandardMaterial({
            color: 0x1171ee,
            map: texture,
            transparent: true,
            opacity: 0.8,
            metalness: 0.0,
            roughness: 0.6,
            depthTest: true,
            depthWrite: false
        })
        model.material = material
      
    }

    loadOneModel(sourceUrl) {
       
        const loader = new GLTFLoader()
        return new Promise(resolve => {
            loader.load(sourceUrl, (gltf) => {
                // 获取模型
                const mesh = gltf.scene.children[0]
                // 放大模型以便观察
                const size = 100
                mesh.scale.set(size, size, size)
                this.scene.add(mesh)

                resolve(mesh)
            },
                function (xhr) {
                },
                function (error) {
                    console.log('loader model fail' + error)
                })
        })

    }

    /**
     * 增加环境光照 
     * @private
     */
    initLight() {
        const { intensity } = this._conf
        // 环境光
        const aLight = new THREE.AmbientLight(0xffffff, 1.0 * intensity)
        this.scene.add(aLight)
        // 平行光
        const dLight = new THREE.DirectionalLight(0xffffff, 1.5 * intensity)
        dLight.position.set(1, 1, 1)
        this.scene.add(dLight)
    }

    // 逐帧更新图层
    update() {

        const {main, tray} = this._models

         // 更新托盘纹理
        const texture = tray?.material?.map
       
        if (texture) {
            this._offset += 0.6
            texture.offset.x = Math.floor(this._offset) / this._frameX
        }
        // 更新主体位置
        
        if(main){
            this._currentAngle += 0.005;
            main.rotateZ((this._currentAngle / 180) * Math.PI);
        }


    }
}

export default POI3dLayer0