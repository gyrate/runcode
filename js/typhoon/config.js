export const TyphoonConf = {
    levelMap: {
        TD: {name: '热带低压', color: '#076deb', en: 'Tropical Depression', range: '6-7'},
        TS: {name: '热带风暴', color: '#fef301', en: 'Tropical Storm', range: '8-9'},
        STS: {name: '强热带风暴', color: '#fc8f2b', en: 'Severe Tropical Storm', range: '10-11'},
        T: {name: '台风', color: '#fe0405', en: 'Typhoon', range: '12-13'},
        ST: {name: '强台风', color: '#fe3ba3', en: 'Strong Typhoon', range: '14-15'},
        SST: {name: '超强台风', color: '#ad00d8', en: 'Super Typhoon', range: '>=16'},
    },
    directionMap: {
        E: '东',
        S: '南',
        W: '西',
        N: '北',
        WNW: '西北偏西',
        WSW: '西南偏西',
        SW: '西南',
        SSW: '南西南',
        SSE: '南东南',
        SE: '东南',
        ESE: '东南偏东',
        ENE: '东北偏东',
        NE: '东北',
        NNE: '北东北',
        NNW: '北西北'
    },
    getLevel(grade) {
        if (grade <= 7) {
            return TyphoonConf.levelMap.TD;
        } else if (grade <= 9) {
            return TyphoonConf.levelMap.TS;
        } else if (grade <= 11) {
            return TyphoonConf.levelMap.STS;
        } else if (grade <= 13) {
            return TyphoonConf.levelMap.T;
        } else if (grade <= 15) {
            return TyphoonConf.levelMap.ST;
        } else {
            return TyphoonConf.levelMap.SST;
        }
    },
    windCircle: {
        7: {names: '7级风圈', color: '#fef301'},
        10: {names: '10级风圈', color: '#fc8f2b'},
        12: {names: '12级风圈', color: '#fe3ba3'},
    },
};
