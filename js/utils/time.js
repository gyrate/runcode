/**
 *
 * @description 计算具体的年月日信息
 * @param {Date} time
 * @returns
 */
export const getTimeDetial = time => {
    const year = time.getFullYear();
    const month = time.getMonth() + 1;
    // 获取日期
    const day = time.getDate(); // 返回两位数字表示的日期（如31表示三十一号）

    // 获取小时
    const hour = time.getHours(); // 返回两位数字表示的小时（如15表示下午三点）

    // 获取分钟
    const minute = time.getMinutes(); // 返回两位数字表示的分钟（如45表示四十五分钟）

    // 获取秒数
    const second = time.getSeconds() + 1; // 返回两位数字表示的秒数（如30表示三十秒）

    // 获取星期（注意星期天为0,星期六为6）
    const weekday = time.getDay(); // 返回一个数字表示的星期几（如0表示星期天,1表示星期一,以此类推）

    const weekdayMap = ['星期天', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    const res = {
        year,
        month,
        day,
        hour,
        minute,
        second,
        weekday: weekdayMap[weekday]
    };
    Object.keys(res).forEach(key => {
        if (res[key] < 10) {
            res[key] = `0${res[key]}`;
        }
    });

    return res;
};

/**
 *
 * @description 进程睡眠ms毫秒
 * @param {number} ms
 * @returns
 */
export const sleep = ms => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};


/**
 * 获取当前星期
 * @returns {string}
 */
export function getCurrentDayOfWeek() {
    const daysOfWeek = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const date = new Date();
    const dayIndex = date.getDay();
    return daysOfWeek[dayIndex];
}


/**
 * 获取当前年月日
 * @returns {string}
 */
export function getCurrentDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


/**
 * 将字符串时间转换为北京时间,比如"202407260900"转化为"2024/07/26 17:00"
 * @param gmtTimeStr
 * @returns {string}
 */
export function convertGMTToBeijingTime(gmtTimeStr, fhour = 0) {
    const date = new Date(gmtTimeStr.slice(0, 4), gmtTimeStr.slice(4, 6), gmtTimeStr.slice(6, 8), gmtTimeStr.slice(8, 10), gmtTimeStr.slice(10));
    const offsetInMillis = (fhour + 8) * 60 * 60 * 1000;
    const beijingDate = new Date(date.getTime() + offsetInMillis);

    const year = beijingDate.getFullYear();
    const month = beijingDate.getMonth().toString().padStart(2, '0');
    const day = beijingDate.getDate().toString().padStart(2, '0');
    const hours = beijingDate.getHours().toString().padStart(2, '0');
    const minutes = beijingDate.getMinutes().toString().padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * 获取当前时刻 hh:mm:ss
 * @returns {string}
 */
export function getCurrentMonent() {
    const {hour, minute, second} = getTimeDetial(new Date());
    return `${hour}:${minute}:${second}`;
}
