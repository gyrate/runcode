class BaseUtil {
  // 事件监听字典
  eventMap = {}

  // constructor (config) {
  // }

  /**
   * @public
   * @description 添加监听器
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
  addEventListener (eventType, fn) {
    if (!this.eventMap[eventType]) {
      this.eventMap[eventType] = []
    }
    this.eventMap[eventType].push(fn)
    return this
  }

  /**
   * @public
   * @description 添加监听器,addEventListener的别名
   * @param {String} eventType 事件名称
   * @param {Function} fn 回调函数
   */
  on (eventType, fn) {
    this.addEventListener(eventType, fn)
    return this
  }

  /**
   * @public
   * @description 清除监听器
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
  removeEventListener (eventType, fn) {
    if (!this.eventMap[eventType]) {
      return this
    }
    const index = this.eventMap[eventType].findIndex(f => f === fn)
    if (index > -1) {
      this.eventMap[eventType].splice(index, 1)
    }
    return this
  }

  /**
   * @public
   * @description 清除监听器,removeEventListener的别名
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
  off (eventType, fn) {
    this.removeEventListener(eventType, fn)
    return this
  }

  /**
   * 模型拾取事件
   * @event  ModelLayer#pick
   * @type {object}
   * @property {Number} screenX 图层场景
   * @property {Number} screenY 图层相机
   * @property {Object} attrs 模型属性
   */
  handleEvent (eventType, attrs) {
    const fns = this.eventMap[eventType] || []
    for (let i = 0; i < fns.length; i++) {
      if (typeof fns[i] === 'function') {
        fns[i].apply(fns[i], [attrs, this])
      }
    }
    return this
  }
}

export default BaseUtil
