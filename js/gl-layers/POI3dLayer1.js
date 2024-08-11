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
    // 缓存材质
    _materials = {}
    // 缓存实例化模型
    _instanceMap = {}
    // 纹理图片帧数，通过计算图片宽高比获得
    _frameX = 1
    // 托盘纹理的偏移量，用于实现动画
    _offset = 0

    // 主体旋转角度
    _currentAngle = 0

    _size = 10

    // 最大旋转角度
    _maxAngle = Math.PI * 2

    // 用于做定位和移动的介质
    _dummy = new THREE.Object3D()


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

        const coordsArr = this.customCoords.lngLatsToCoords(features.map(v => v.lngLat))
        this._data.forEach((item, index) => {
            item.coords = coordsArr[index]
        })
    }

    // Layer已准备好
    async onReady() {

        // debugger 增加辅助坐标轴帮助定位
        // this.createHelper()

        // 加载主体模型
        await this.loadMainMesh()
        // 加载底座模型
        await this.loadTrayMesh()
        // 实例化模型
        this.createInstancedMeshes()

        //光照
        this.initLight()

    }

    async loadMainMesh() {
        // 加载主体模型
        const model = await this.loadOneModel('../static/gltf/taper2.glb')
        // 缓存模型
        this._models.main = model

        // 给模型换一种材质
        const material = new THREE.MeshStandardMaterial({
            color: 0xfbdd4f, //自身颜色
            transparent: true,
            opacity: 0.8, //透明度
            metalness: 0.0, //金属性
            roughness: 0.5, //粗糙度
            emissive: new THREE.Color('#ff6302'), //发光颜色
            emissiveIntensity: 0.5,
            // blending: THREE.AdditiveBlending
        })

        this._materials.main = material
    }

    async loadTrayMesh() {
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
            color: 0xfbdd4f,
            map: texture,
            transparent: true,
            opacity: 0.8,
            metalness: 0.0,
            roughness: 0.6,
            depthTest: true,
            depthWrite: false
        })

        this._materials.tray = material

    }

    loadOneModel(sourceUrl) {

        const loader = new GLTFLoader()
        return new Promise(resolve => {
            loader.load(sourceUrl, (gltf) => {
                // 获取模型
                const mesh = gltf.scene.children[0]
                // 放大模型以便观察
                const size = this._size
                mesh.scale.set(size, size, size)
                // this.scene.add(mesh)

                resolve(mesh)
            },
                function (xhr) {
                },
                function (error) {
                    console.log('loader model fail' + error)
                })
        })

    }

    createInstancedMeshes() {
        const { _models, _data, _materials, scene } = this

        const keys = Object.keys(_models)

        for (let i = 0; i < keys.length; i++) {
            // 创建实例化模型
            let key = keys[i]
            const mesh = new THREE.InstancedMesh(_models[key].geometry, _materials[key], _data.length)
            mesh.attrs = { modelId: key }
            this._instanceMap[key] = mesh

            // 实例化
            this.updateInstancedMesh(mesh)
            scene.add(mesh)
        }

    }
    updateInstancedMesh(instancedMesh) {
        const { _data } = this

        for (let i = 0; i < _data.length; i++) {
            // 获得转换后的坐标
            const [x, y] = this._data[i].coords

            // 每个实例的尺寸
            const newSize = this._size * this._data[i].scale
            this._dummy.scale.set(newSize, newSize, newSize)
            // 更新每个实例的位置
            this._dummy.position.set(x, y, i)
            this._dummy.updateMatrix()

            // 更新实例 变换矩阵
            instancedMesh.setMatrixAt(i, this._dummy.matrix)
            console.log(this._dummy.matrix)
            // 设置实例 颜色 
            instancedMesh.setColorAt(i, new THREE.Color(this.getColor(i)))
        }
        // // 强制更新实例
        instancedMesh.instanceMatrix.needsUpdate = true
    }

    // 获取实例颜色示例
    getColor(index, data){
        return index % 2 == 0 ? 0xfbdd4f : 0xff0000
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

    /**
     * @description 更新指定网格体的单个示例的变化矩阵
     * @param {instancedMesh} Mesh 网格体
     * @param {Object} transform 变化设置，比如{size:1, position:[0,0,0], rotation:[0,0,0]}
     * @param {Number} index 网格体实例索引值
     */
    updateMatrixAt(mesh, transform, index) {
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


    // 逐帧更新图层
    update() {

        const { main, tray } = this._instanceMap

        // 更新托盘纹理
        const texture = tray?.material?.map

        if (texture) {
            this._offset += 0.6
            texture.offset.x = Math.floor(this._offset) / this._frameX
        }

        // 更新主体旋转角度
        this._data.forEach((item, index) => {
            const [x, y] = item.coords
            this.updateMatrixAt(main, {
                size:  item.scale * this._size,
                position: [x, y, 0],
                rotation: [0, 0, this._currentAngle]
            }, index)
        })
        // 更新主体旋转角度
        this._currentAngle = (this._currentAngle + 0.05) % this._maxAngle
        
        // 强制更新instancedMesh实例，必须！
        if (main?.instanceMatrix) {
            main.instanceMatrix.needsUpdate = true
        }
    }
}

export default POI3dLayer0