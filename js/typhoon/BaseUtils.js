class BaseUtil {
    // 事件监听字典
    eventMap = {};

    _visible = false;

    _zIndex = null;

    constructor(config) {
        this._zIndex = isNaN(config.zIndex) ? 1 : config.zIndex;
    }

    get visible() {
        return this._visible;
    }

    set visible(val) {
        this._visible = !!val;
        this._handleVisible(this._visible);
    }

    // 提供该方法以保证与高德的图层一致
    getVisible() {
        return this.visible;
    }

    /**
     * 显示图层
     */
    show() {
        this.visible = true;
    }

    /**
     * 隐藏图层
     */
    hide() {
        this.visible = false;
    }

    /**
     * 处理具体的显示逻辑
     * @protected
     */
    _handleVisible() {
        // 子类覆盖
    }

    // constructor (config) {
    // }

    /**
   * @public
   * @description 添加监听器
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
    addEventListener(eventType, fn) {
        if (!this.eventMap[eventType]) {
            this.eventMap[eventType] = [];
        }
        this.eventMap[eventType].push(fn);
        return this;
    }

    /**
   * @public
   * @description 添加监听器,addEventListener的别名
   * @param {String} eventType 事件名称
   * @param {Function} fn 回调函数
   */
    on(eventType, fn) {
        this.addEventListener(eventType, fn);
        return this;
    }

    /**
   * @public
   * @description 清除监听器
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
    removeEventListener(eventType, fn) {
        if (!this.eventMap[eventType]) {
            return this;
        }
        const index = this.eventMap[eventType].findIndex(f => f === fn);
        if (index > -1) {
            this.eventMap[eventType].splice(index, 1);
        }
        return this;
    }

    /**
   * @public
   * @description 清除监听器,removeEventListener的别名
   * @param {String} eventType 事件类型
   * @param {Function} fn 回调函数
   */
    off(eventType, fn) {
        this.removeEventListener(eventType, fn);
        return this;
    }

    /**
   * 派发事件
   * @param {String} eventType 事件类型
   * @param {Object} eventData 事件内容
   */
    dispatchEvent(eventType, eventData) {
        const fns = this.eventMap[eventType] || [];
        for (let i = 0; i < fns.length; i++) {
            if (typeof fns[i] === 'function') {
                fns[i].apply(fns[i], [eventData, this]);
            }
        }
        return this;
    }
}

export default BaseUtil;
