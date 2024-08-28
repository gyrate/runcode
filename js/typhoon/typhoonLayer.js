// 用于展示台风路径
import BaseUtils from './BaseUtils.js';
import {TyphoonConf} from './config.js';
import {convertDecimalToDMS, throttle} from '../utils/tools.js';
import {convertGMTToBeijingTime} from '../utils/time.js';
import TyphoonMarker from './TyphoonMarker.js';

class TyphoonLayer extends BaseUtils {
    data = [];
    // 缓存路径polyline
    geometries = [];
    // 缓存节点
    markers = [];
    // 信息悬浮层
    infoTip = null;
    // 当前台风的基础信息
    detail = null;
    // 高性能缓存点标注
    markerLayer = null;
    // 台风圈图标
    focusMarker = null;

    constructor(config) {
        super(config);

        this.map = config.map;
        this.zooms = config.zooms || [4, 22];
        this.setData(config.data);
        this.init();
    }

    setData(data) {
        if (data === undefined) {
            return;
        }
        const isInValid = ['name', 'id', 'paths'].some(key => {
            if (data[key] === undefined) {
                console.error(`setData,property ${key} invalid`);
            }
        });
        if (isInValid) {
            return;
        }

        this.data = data;
        this.paths = this.groupAndSortData(data.paths);
    }

    update(data) {
        const {id, name, paths} = data;
        this.clear();
        this.setData(data);
        this.render();
        // 定位到台风位置
        this.map.setFitView(this.geometries);
    }

    async init() {
        this.initInfoTip();
        this.initMarkerLayer();
        this.render();
    }

    // 用于储存节点的高性能图层
    initMarkerLayer() {
        const {zooms, map, infoTip, visible} = this;

        const layer = new AMap.LabelsLayer({
            collision: false,
            allowCollision: true,
            opacity: 1,
            zIndex: 999,
            visible,
            zooms
        });

        map.add(layer);
        this.markerLayer = layer;
    }

    /**
     * 初始化悬浮层
     */
    initInfoTip() {
        this.infoTip = new AMap.Marker({
            anchor: 'middle-left',
            offset: [0, 0],
            zIndex: 100,
            cursor: 'default',
        });
    }

    /**
     * 按时间点整理路径数据
     * @param data
     * @returns {*}
     */
    groupAndSortData(data) {
        return data.reduce((result, item) => {
            const time = item.time;
            if (!result[time]) {
                result[time] = [];
            }
            // 格式化时间
            item.formatTime = convertGMTToBeijingTime(time, parseInt(item.fhour || 0));
            result[time].push(item);
            result[time].sort((a, b) => {
                return parseInt(a.fhour || 0) - parseInt(b.fhour || 0);
            });
            return result;
        }, {});
    }

    /**
     * 通过时间戳找到路径节点数据
     * @param val
     * @returns {*}
     */
    getDataByTime(val) {
        const match = this.paths[val];
        let res = null;
        if (match) {
            res = match[0];
        }
        return res;
    }

    /**
     * 渲染台风路径
     */
    render() {
        const {map, paths, markers, geometries, visible} = this;

        const dataArr = Object.values(paths || []);
        // 上一节点的状态
        let currLevel = null;
        let path = [];
        const nodes = [];

        dataArr.forEach((arr, index) => {
            const {lon, lat, grade} = arr[0];
            if (path.length <= 1) {
                currLevel = TyphoonConf.getLevel(grade);
            }
            path.push([parseFloat(lon), parseFloat(lat)]);

            if (index === 0) {
                // 第一个节点
            } else if (index === dataArr.length - 1) {
                // 最后一个节点,绘制线
                const polyline = this.generatePolyLine(path, currLevel, {forecast: false});
                geometries.push(polyline);
                map.add(polyline);

                // 渲染最后节点的预测路径
                this.renderForecast(arr);
                // 添加台风动画
                this.updateMarker(arr[0]);
            } else {
                const nextNode = dataArr[index + 1][0];
                const nextNodeLevel = TyphoonConf.getLevel(nextNode.grade);
                if (nextNodeLevel.name !== currLevel.name) {
                    // 级别切换了,绘制线
                    const polyline = this.generatePolyLine(path, currLevel, {forecast: false});
                    geometries.push(polyline);
                    map.add(polyline);
                    path = [[lon, lat]];
                }
            }
            // 增加dom节点
            const node = this.generateNode(arr[0], {forecast: false});
            nodes.push(node);
        });

        // 添加路径线
        // map.add(geometries);
        // 添加路径节点
        this.markerLayer.add(nodes);
    }

    /**
     * 渲染台风预测路径
     */
    renderForecast(arr) {
        const {map, geometries, markerLayer} = this;
        // 添加预测路线
        const path_forecast = arr.map(v => {
            return [parseFloat(v.lon), parseFloat(v.lat)];
        });
        // 预测路径添加到缓存
        const polyline_forecast = this.generatePolyLine(path_forecast, {color: '#ffc800', strokeStyle: 'dashed'}, {forecast: true});
        geometries.push(polyline_forecast);
        map.add(polyline_forecast);
        // 添加预测点
        const nodes_forecast = [];
        arr.slice(1).forEach(item => {
            const node = this.generateNode(item, {forecast: true});
            nodes_forecast.push(node);
        });
        markerLayer.add(nodes_forecast);
    }

    /**
     * 将预测路径内容清除
     */
    clearForecast() {
        const {geometries, markerLayer} = this;
        // 清除预测路径
        const index = geometries.findIndex(v => {
            const {forecast} = v.getExtData();
            return forecast === true;
        });
        geometries[index].setMap(null);
        geometries[index].destroy();
        geometries.splice(index, 1);

        // 清除预测路径节点
        const markers = markerLayer.getAllOverlays();
        const matchMarkers = markers.filter(v => {
            const {forecast} = v.getExtData();
            return forecast === true;
        });
        markerLayer.remove(matchMarkers);
    }

    /**
     * 创建节点
     * @param item
     * @returns {AMap.Marker}
     */
    generateNode(item, extData) {
        const {lat, lon, time, formatTime, radius7_s, radius10_s, radius12_s} = item;
        const {map, infoTip, visible} = this;
        const size = 14;

        const node = new AMap.LabelMarker({
            position: [parseFloat(lon), parseFloat(lat)],
            opacity: 1,
            icon: {
                image: `../static/image/map/icon/dot0.svg`,
                size: [size, size],
                anchor: 'center'
            },
            extData: {...extData, radius7_s, radius10_s, radius12_s, time},
            text: {
                content: formatTime,
                direction: 'right',
                zooms: [8, 22],
                offset: [8, -5],
                style: {
                    fontSize: 14,
                    fillColor: '#fff',
                    strokeColor: 'rgb(18,53,103)',
                    strokeWidth: 2,
                }
            }
        });
        node.on('mouseover', event => {
            const {target} = event;
            const {time} = target.getExtData();
            const detail = this.getDataByTime(time);
            infoTip.setPosition(target.getPosition());
            infoTip.setContent(this.getInfoTipContent(detail));
            map.add(infoTip);
        });
        node.on('mouseout', throttle(e => {
            map.remove(infoTip);
        }, 1000));
        node.on('click', event => {
            const extData = event.target.getExtData();
            const {lng, lat} = event.target.getPosition();
            // 渲染预测路径
            const arr = this.paths[extData.time];
            this.clearForecast();
            this.renderForecast(arr);
            this.updateMarker({...extData, lon: lng, lat});
        });
        return node;
    }

    updateMarker(item) {
        const {lat, lon, forecast} = item;
        const {visible, zooms, map} = this;

        if (forecast === true) {
            // 不处理预测点
            return;
        }

        const data = [];
        const arr = [7, 10, 12];
        arr.forEach(k => {
            const name = `radius${k}_s`;
            const radius = item[name].split(',');
            if (radius.length >= 4) {
                data.push({
                    grade: k,
                    radius: radius.map(v => {
                        return parseFloat(v);
                    })
                });
            }
        });

        if (!this.focusMarker) {
            this.focusMarker = new TyphoonMarker({
                position: [parseFloat(lon), parseFloat(lat)],
                size: 200,
                map,
                visible,
                zooms,
                data
            });
        } else {
            this.focusMarker.setPosition([parseFloat(lon), parseFloat(lat)]);
            this.focusMarker.setData(data);
        }

    }

    // 获取悬浮面板内容
    getInfoTipContent(data) {
        const {radius7, radius10, lon, lat, time} = data;
        const {name} = this.data;
        const [newLon, newLat] = convertDecimalToDMS(parseFloat(lon), parseFloat(lat));
        const content = `
              <div class="typhoon-node-tip">
                <h3>${name}</h3>
                <ul>
                  <li><span>时间：</span><span>${convertGMTToBeijingTime(time)}</span></li>
                  <li><span>纬度：</span><span>${newLat}</span></li>
                  <li><span>经度：</span><span>${newLon}</span></li>
                  <li><span>风速：</span><span>${data.mspeed}米/秒</span></li>
                  <li><span>风力：</span><span>${data.grade}级</span></li>
                  <li><span>气压：</span><span>${data.pressure}百帕</span></li>
                  <li><span>移向：</span><span>${TyphoonConf.directionMap[data.direction]}</span></li>
                  <li><span>移速：</span><span>${data.kspeed}千米/时</span></li>
                  <li><span>七级半径：</span><span>${radius7 <= 0 ? '--' : radius7 + '千米'}</span></li>
                  <li><span>十级半径：</span><span>${radius10 <= 0 ? '--' : radius10 + '千米'}</span></li>
                </ul>
            </div>
            `;
        return content;
    }

    // 创建路径折线
    generatePolyLine(path, conf, extData) {
        const {color, strokeStyle} = conf;
        const {zooms, visible} = this;
        const polyline = new AMap.Polyline({
            path,
            strokeOpacity: 1,
            strokeColor: color,
            strokeWeight: 4,
            strokeStyle: strokeStyle || 'solid',
            strokeDasharray: [6, 6],
            zooms,
            zIndex: 10,
            extData
        });
        if (visible) {
            polyline.show();
        } else {
            polyline.hide();
        }
        return polyline;
    }

    /**
     * 处理具体的图层显示逻辑
     * @param val
     */
    _handleVisible(val) {
        const {geometries, markers, markerLayer, focusMarker, infoTip} = this;
        const fn = val ? 'show' : 'hide';

        geometries.forEach(item => {
            item[fn]();
        });
        markers.forEach(item => {
            item[fn]();
        });
        // 信息浮层
        infoTip[fn]();
        // 路径节点
        markerLayer[fn]();
        // 风圈图层
        focusMarker[fn]();

        if (val === true) {
            // 调整地图视角到路径位置
            this.map.setFitView(geometries);
        }
    }

    /**
     * 清空元素
     */
    clear() {
        for (let i = 0; i < this.geometries.length; i++) {
            this.geometries[i].setMap(null);
        }
        this.geometries = [];

        for (let i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = [];
        if (this.focusMarker) {
            this.focusMarker.destroy()
            this.focusMarker = null;
        }

        this.markerLayer.clear();
    }

    destroy() {
        this.clear();
    }
}
export default TyphoonLayer;
