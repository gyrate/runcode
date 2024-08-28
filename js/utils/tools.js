/**
 * 将参数转为数据格式
 * @param argument
 * @returns {*|*[]}
 */
export const toArray = argument => {
    const res = getType(argument) === 'array' ? argument : [argument];
    return res;
};

/**
 * 获取变量的类型
 * @param {*} type
 * @returns {string}
 */
export const getType = type => {
    return Object.prototype.toString
        .call(type)
        .split(' ')[1]
        .split(']')[0]
        .toLocaleLowerCase();
};

/**
 * 将十六进制的颜色值转成rgba
 * @param {String} hex
 * @param {number} opacity
 * @returns {string}
 */
export const hexToRGBA = (hex, opacity = 1) => {
    return 'rgba(' + parseInt('0x' + hex.slice(1, 3)) + ',' + parseInt('0x' + hex.slice(3, 5)) + ','
    + parseInt('0x' + hex.slice(5, 7)) + ',' + opacity + ')';
};

/**
 * 将十六进制的颜色值转成数组
 * @param {String} hex
 * @returns {[number,number,number]}
 */
export const hexToArray = hex => {
    return [
        parseInt('0x' + hex.slice(1, 3)),
        parseInt('0x' + hex.slice(3, 5)),
        parseInt('0x' + hex.slice(5, 7))
    ];
};

/**
 * 将数组中的数值限制在某个范围内
 * @param {Array} arr
 * @param {Number} min
 * @param {Number} max
 * @returns {Array}
 */
export const clampArray = (arr, {min, max}) => {
    return arr.map(item => {
        return min !== undefined ? Math.max(min, (max !== undefined ? Math.min(max, item) : item)) : item;
    });
};

/**
 * 动态引入js文件
 * @param {String} src 源文件路径
 * @returns Promise
 */
export function loadScript(src) {
    return new Promise(resolve => {
        if (!src) {throw new Error('js地址为必填');}
        const myScript = document.createElement('script');
        myScript.setAttribute('src', src);
        myScript.onload = resolve;
        document.body.appendChild(myScript);
    });
}

/**
 * 动态引入css文件
 * @param {String} src 源文件路径
 * @returns Promise
 */
export function loadStyle(src) {
    return new Promise(resolve => {
        if (!src) {throw new Error('css地址为必填');}
        const style = document.createElement('link');
        style.setAttribute('href', src);
        style.setAttribute('rel', 'stylesheet');
        document.body.appendChild(style);
        resolve();
    });
}

/**
 * 判断当前是否开发模式
 * @returns {boolean}
 */
export function isDev() {
    return import.meta.env.MODE === 'development' || location.search.includes('dev');
}

/**
 * 判断当前是否宽屏
 * @return {boolean}
 */
export function isWideScreen() {
    return document.body.clientWidth > 2800;
}

/**
 * 获取当前主题
 * @returns {string}
 */
export function getTheme() {
    // const t = import.meta.env.VITE_APP_THEME
    return localStorage.getItem('__sirens_theme') || 'dark';
}

/**
 * 经纬度转墨卡托
 * @param poi 经纬度 {lng,lat}
 * @returns {{}} {x,y}
 * @private
 */
export function toMercator(poi) {
    const mercator = {};
    const earthRad = 6378137.0;
    mercator.x = poi.lng * Math.PI / 180 * earthRad;
    const a = poi.lat * Math.PI / 180;
    mercator.y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
    return mercator;
}

/**
 * 墨卡托转经纬度
 * @param poi 墨卡托 {x,y}
 * @returns {{}} {lng,lat}
 * @private
 */
export function toLngLat(poi) {
    const lnglat = {};
    lnglat.lng = poi.x / 20037508.34 * 180;
    const mmy = poi.y / 20037508.34 * 180;
    lnglat.lat = 180 / Math.PI * (2 * Math.atan(Math.exp(mmy * Math.PI / 180)) - Math.PI / 2);
    return lnglat;
}

/**
 * 请求模拟数据
 */
export async function mock() {
    const res = await axios.get(`${import.meta.env.VITE_APP_BASEURL}mock/getAreaShip.json`);
    return res;
}


/**
 * 获取当前时间
 */

/**
 * 获取屏幕宽高比
 * @returns {string}
 */
export function getScreenRatio() {
    const width = window.screen.width;
    const height = window.screen.height;

    // 计算最大公约数
    function gcd(a, b) {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    const divisor = gcd(width, height);
    const ratioWidth = width / divisor;
    const ratioHeight = height / divisor;

    return `${ratioWidth}:${ratioHeight}`;
}

/**
 * 将时间戳转为YYYY-MM-DD hh:mm:ss格式
 * @param timestamp
 * @returns {string}
 */
export function formatDateTime(timestamp) {
    // 创建一个新的Date对象
    const date = new Date(timestamp * 1000); // Unix时间戳通常是以秒为单位，而Date期望毫秒，所以乘以1000

    // 提取日期的各个部分
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // getMonth()返回0-11，所以加1，并在前面补零
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);

    // 使用模板字符串构造最终的日期格式
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 将经纬度数据格式转换  25878283 -> 25-87.8283N
 * @param num
 * @returns {string}
 */
export function convertCoordinate(num) {
    let degrees = Math.floor(num / 1000000);
    const minutesAndSeconds = (num % 1000000) / 10000;

    const direction = degrees >= 0 ? 'N' : 'S';
    degrees = Math.abs(degrees);

    return `${degrees}-${minutesAndSeconds}${direction}`;
}


/**
 * 获取URL地址参数
 * @param name
 * @returns {string}
 */
export function getURLParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

/**
 * 将十进制的经纬度转换为分秒制
 * @param longitude
 * @param latitude
 * @returns {{newLon: string, newLat: string}}
 */
export function convertDecimalToDMS(longitude, latitude) {
    function convert(decimalDegree0, isLatitude) {
        const decimalDegree = Math.abs(decimalDegree0);
        const degree = Math.floor(decimalDegree);
        const minute = Math.round((decimalDegree - degree) * 60);
        const direction = isLatitude ? (decimalDegree >= 0 ? 'N' : 'S') : (decimalDegree >= 0 ? 'E' : 'W');
        return `${Math.abs(degree)}°${minute} ${direction}`;
    }

    return [
        convert(longitude, false),
        convert(latitude, true)
    ];
}

/**
 * 节流方法
 * @param func 具体函数
 * @param limit 限定时间
 * @returns {(function(): void)|*}
 */
export const throttle = function (func, limit) {
    let lastFunc;
    let lastRan;
    return function () {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};
