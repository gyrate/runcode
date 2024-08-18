/**
 * 图层管理器
 * @extends null
 * @author Zhanglinhai <gyrate.sky@qq.com>
 */
class Manager {
  /**
   * @description 创建一个实例
   * @param {Object} conf
   * @param {Array} conf.data 图层数组 [layer,...] 默认为[]
   */
  constructor (config = {}) {
    this._list = config.data || []
  }

  /**
   * @description 添加1个图层到管理器
   * @param {String} id 图层id
   * @param {String} title 图层名称
   * @param {*} layer 图层实例
   */
  add (layer) {
    if (layer === undefined) {
      console.error('缺少图层实例')
      return
    }
    if (layer.id === undefined) {
      console.error('缺少图层id')
      return
    }
    const { id } = layer
    const match = this.findLayerById(id)

    if (match) {
      console.error(`图层的id ${id} 不是唯一标识，请更换`)
      return
    }
    this._list.push(layer)
  }

  /**
   * @description 通过id查找图层信息
   * @param {String} id 图层id
   * @returns {*} 返回匹配的第一个图层
   */
  findLayerById (id) {
    const match = this._list.find(item => item.id === id)
    return match
  }

  /**
   * 将指定图层从管理器中移除
   * @params {String, Array} 图层id，或图层id数组
   * @return {Array} 剩余图层数组
   */
  remove (ids) {
    if (!(ids instanceof Array)) {
      ids = [ids]
    }
    const arr = this._list.filter(v => {
      return ids.includes(v.id) == false
    })
    this._list = arr
    return arr
  }

  /**
   * @description 销毁指定id的图层
   * @param id
   */
  destroyLayerById (id) {
    const layer = this.findLayerById(id)
    if (layer) {
      if (layer.destroy) {
        layer.destroy()
      }
      this.remove(id)
    }
  }

  /**
   * @description 清空当前的图层管理器
   */
  clear () {
    this._list.forEach((layer) => {
      if (layer.destroy) {
        layer.destroy()
      }
      console.log(`销毁layer ${layer.id}`)
    })
    this._list = []
  }

  /**
   * @description 显示下属所有图层
   */
  show () {
    this._list.forEach((layer) => {
      layer.show()
    })
  }

  /**
   * @description 隐藏下属所有图层
   */
  hide () {
    this._list.forEach((layer) => {
      layer.hide()
    })
  }
}

export default Manager
