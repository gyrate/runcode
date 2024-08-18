// import axios from '../axios.min.js'

/**
 * 通用的获取MOCK数据方法
 * @param src {String} 资源路径
 * @param options {object} 配置参数
 * @returns {Promise<unknown>}
 */
export function fetchData (src, options) {
  if (!src) {
    console.error('缺少模拟数据JOSN文件名')
    return
  }
  return new Promise((resolve) => {
    axios.get(src).then(res => {
      resolve(res.data)
    })
  })
}
