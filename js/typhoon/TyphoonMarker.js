import {TyphoonConf} from './config.js';
import {hexToRGBA} from '../utils/tools.js';
import BaseUtils from './BaseUtils.js';

class TyphoonMarker extends BaseUtils {
    data = [];
    canvasLayer = null;
    // 范围
    _bounds = [];
    // 画布
    _canvas = null;
    // 中心图片
    _img = null;
    // 画布内容的范围/2
    _range = 1;

    // 内容中心坐标
    centerX = 0;
    centerY = 0;

    _visible = true;

    constructor(config) {
        super(config);

        const {map, position, data, visible} = config;
        if (map) {
            this.map = map;
        }
        this.data = data;
        this._visible = visible ?? true;
        if (position) {
            const [lng, lat] = position;
            const {_range} = this;
            this._bounds = [
                [lng - _range * 1.2, lat - _range],
                [lng + _range * 1.2, lat + _range]
            ];
        }
        this.init();
    }

    async init() {
        const {_bounds, _visible, map} = this;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1000;
        this._canvas = canvas;
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height / 2;

        const canvasLayer = new AMap.CanvasLayer({
            visible: _visible,
            canvas,
            bounds: new AMap.Bounds(_bounds[0], _bounds[1]),
            zIndex: 90, // 没有生效
            zooms: [3, 22],
        });
        this.canvasLayer = canvasLayer;
        map.addLayer(canvasLayer);

        if (this.data.length) {
            await this.render();
        }
    }

    async render() {
        const {_canvas, canvasLayer, data} = this;
        const ctx = _canvas.getContext('2d');
        const {width, height} = _canvas;
        const {windCircle} = TyphoonConf;
        let rotationAngle = 0;

        this._img = await this.getImage();

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            
            this.data.forEach(item => {
                const {radius, grade} = item;
                this.drawWindCircles(ctx, {radius, color: windCircle[grade].color});
                this.drawWindCircles(ctx, {radius, color: windCircle[grade].color});
            });
            this.drawImg(ctx, rotationAngle);

            rotationAngle -= 0.02;
            // 刷新渲染图层
            canvasLayer.reFresh();
            window.requestAnimationFrame(draw);
        };
        draw();
    }

    setPosition([lng, lat]) {
        const {_range} = this;
        this._bounds = [
            [lng - _range * 1.2, lat - _range],
            [lng + _range * 1.2, lat + _range]
        ];
        const [sw, en] = this._bounds;

        if (this.canvasLayer) {
            this.canvasLayer.setBounds(new AMap.Bounds(sw, en));
        }
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    show() {
        this.canvasLayer.show();
    }
    hide() {
        this.canvasLayer.hide();
    }
    destroy() {
        this.canvasLayer.setMap(null);
        this.canvasLayer.destroy;
        this.data = [];
    }

    // 获取中心图片
    getImage() {
        return new Promise(resolve => {
            if (this._img) {
                resolve(this._img);
            } else {
                const image = new Image();
                image.src = `../static/image/map/icon/typhoon-move.gif`;
                image.onload = () => {
                    resolve(image);
                };
            }
        });
    }

    // 绘制中心图片
    drawImg(ctx, rotationAngle) {
        const {centerX, centerY, _img} = this;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.drawImage(_img, -_img.width / 2, -_img.height / 2);
        ctx.restore();
    }

    /**
     * 绘制风圈
     * @param ctx
     * @param radius [radius_EN, radius_ES, radius_WS, radius_WN]
     * @param color
     */
    drawWindCircles(ctx, {radius, color = '#ffffff'}) {

        const {centerX, centerY} = this;
        const fillColor = hexToRGBA(color, 0.2);
        const [radius_EN, radius_ES, radius_WS, radius_WN] = radius;

        // 初始角度重置到时钟12点
        const initRotate = -Math.PI / 2;
        // ctx.clearRect(0, 0, width, height);

        ctx.beginPath();
        // 东北
        ctx.moveTo(centerX, centerY - radius_EN);
        ctx.arc(centerX, centerY, radius_EN, initRotate + 0, initRotate + Math.PI / 2);
        // 东南
        ctx.lineTo(centerX + radius_ES, centerY);
        ctx.arc(centerX, centerY, radius_ES, initRotate + Math.PI / 2, initRotate + Math.PI);
        // 西南
        ctx.lineTo(centerX, centerY + radius_WS);
        ctx.arc(centerX, centerY, radius_WS, initRotate + Math.PI, initRotate + Math.PI * 1.5);
        // 西北
        ctx.lineTo(centerX - radius_WN, centerY);
        ctx.arc(centerX, centerY, radius_WN, initRotate + Math.PI * 1.5, initRotate + Math.PI * 2);
        // 回到原点
        ctx.lineTo(centerX, centerY - radius_EN);

        ctx.fillStyle = fillColor;
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    update() {

    }
}
export default TyphoonMarker;
