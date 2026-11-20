"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedSectionFactories = exports.waterFocusItems = void 0;
exports.paintSection = paintSection;
exports.groupAccidentSection = groupAccidentSection;
exports.nationalAccidentSection = nationalAccidentSection;
exports.waterSection = waterSection;
exports.fireSection = fireSection;
exports.glassSection = glassSection;
exports.interiorSection = interiorSection;
exports.obdSection = obdSection;
exports.mileageSection = mileageSection;
exports.powertrainSection = powertrainSection;
exports.chassisSection = chassisSection;
exports.newCarFunctionSection = newCarFunctionSection;
const options = (values, tone) => values.map((value) => ({ value, label: value, ...(tone ? { tone } : {}) }));
const structureOptions = ['正常', '变形', '扭曲', '烧焊', '切割', '更换', '褶皱', '开裂'];
const curtainOptions = ['正常', '更换', '召回更换', '缺失', '故障', '维修拆装', '受限不可检', '客户未同意拆检', '未配备'];
const airbagOptions = curtainOptions.filter((value) => value !== '未配备');
function makeItems(section, names, getOptions, configure) {
    return names.map((title, index) => ({
        key: `${section}-${String(index + 1).padStart(2, '0')}`,
        title,
        answerType: 'SINGLE_CHOICE',
        options: options(getOptions(title)),
        required: true,
        ...configure?.(title),
    }));
}
function paintSection() {
    const plastic = ['前保险杠', '右前大灯', '右前外后视镜', '右后尾灯', '后保险杠', '左后尾灯', '左前外后视镜', '左前大灯'];
    const metal = ['前机盖', '右前翼子板', '右前车门', '右后车门', '右后翼子板', '后备箱盖', '左后翼子板', '左后车门', '左前车门', '左前翼子板', '车顶'];
    const plasticOptions = ['拆装', '更换', '破损', '改装', '修复', '正常', '自定义'];
    const metalOptions = ['拆装', '更换', '补漆', '钣金', '贴膜', '正常', '自定义'];
    return {
        key: 'paint',
        title: '漆面覆盖',
        items: [
            ...makeItems('paint', plastic, () => plasticOptions).map((item) => ({
                ...item,
                material: 'PLASTIC',
                options: options(plasticOptions, 'dark'),
            })),
            ...makeItems('paint', metal, () => metalOptions).map((item, index) => ({
                ...item,
                key: `paint-${String(index + plastic.length + 1).padStart(2, '0')}`,
                material: 'METAL',
                options: options(metalOptions, 'green'),
            })),
        ],
    };
}
const groupNonCritical = [
    '右前轮旋', '右前车灯框架', '可拆水箱框架', '左前车灯框架', '左前轮旋', '左A柱内侧', '左前侧气帘', '主驾驶气囊',
    '左底边梁外侧', '左C柱内侧', '左后侧气帘', '左D柱外侧', '左后轮旋', '左后灯框架', '左侧背箱流水槽', '后备箱底板',
    '右侧背箱流水槽', '右后灯框架', '右后轮旋', '右D柱外侧', '右C柱内侧', '右后侧气帘', '右A柱内侧', '右前侧气帘',
    '右底边梁外侧', '副驾驶气囊', '左前纵梁（下）', '右前纵梁（下）', '左底边梁内侧（下）', '右底边梁内侧（下）', '更换车身（车架）',
];
const groupCritical = [
    '右前翼子板内骨架', '右前减振器座', '右前纵梁(上)', '不可拆水箱框架', '前围板', '左前纵梁（上）', '左前翼子板内骨架',
    '左前减振器座', '左A柱外侧', '左B柱内侧', '左底边梁内侧', '左C柱外侧', '左D柱内侧', '左后翼子板内骨架', '左后减振器座',
    '后围板', '右后减振器座', '右后翼子板内骨架', '右D柱内侧', '右C柱外侧', '右B柱内侧', '右A柱外侧', '车顶框架',
    '右底边梁内侧', '车体外缘左右对称', '车身底板（底盘）', '左后纵梁', '右后纵梁',
];
function groupAccidentOptions(name) {
    if (name.includes('侧气帘'))
        return curtainOptions;
    if (name === '主驾驶气囊' || name === '副驾驶气囊')
        return airbagOptions;
    if (name === '车体外缘左右对称')
        return ['正常', '异常'];
    if (name === '车身底板（底盘）')
        return ['正常', '变形', '扭曲', '烧焊', '切割', '划伤', '褶皱', '开裂', '生锈'];
    const result = [...structureOptions];
    if (['不可拆水箱框架', '左D柱内侧', '右D柱内侧', '左D柱外侧', '右D柱外侧'].includes(name))
        result.push('未配备');
    if (name === '车顶框架')
        result.push('敞篷正常');
    return result;
}
function groupAccidentSection() {
    return {
        key: 'accident',
        title: '重大事故检测',
        items: [
            ...makeItems('accident', groupNonCritical, groupAccidentOptions, () => ({ critical: false })),
            ...makeItems('accident', groupCritical, groupAccidentOptions, () => ({ critical: true, requiresSizeWhenAbnormal: true }))
                .map((item, index) => ({ ...item, key: `accident-${String(index + groupNonCritical.length + 1).padStart(2, '0')}` })),
        ],
    };
}
const nationalOrder = [
    '可拆水箱框架', '左前纵梁', '左前车灯框架', '不可拆水箱框架', '前围板', '右前车灯框架', '右前纵梁', '左前减振器座',
    '左A柱', '左前侧气帘', '主驾驶气囊', '左B柱', '左底边梁内侧', '左底边梁外侧', '左C柱', '左后侧气帘', '左D柱',
    '左后减振器座', '左侧背箱流水槽', '后围板', '后备箱底板', '右侧背箱流水槽', '右后减振器座', '右D柱', '右C柱',
    '右后侧气帘', '右B柱', '右A柱', '右前侧气帘', '车顶框架', '右底边梁内侧', '右底边梁外侧', '副驾驶气囊',
    '车体外缘左右对称', '车身底板（底盘）', '左底边梁内侧（下）', '右底边梁内侧（下）', '左后纵梁', '右后纵梁',
];
const nationalNonCritical = new Set([
    '可拆水箱框架', '左前车灯框架', '不可拆水箱框架', '右前车灯框架', '左前侧气帘', '主驾驶气囊', '左后侧气帘',
    '左侧背箱流水槽', '后围板', '后备箱底板', '右侧背箱流水槽', '右后侧气帘', '右前侧气帘', '副驾驶气囊',
    '车身底板（底盘）', '左底边梁内侧（下）', '右底边梁内侧（下）',
]);
function nationalAccidentOptions(name) {
    if (name.includes('侧气帘'))
        return curtainOptions;
    if (name === '主驾驶气囊' || name === '副驾驶气囊')
        return airbagOptions;
    if (name === '车体外缘左右对称')
        return ['正常', '异常'];
    if (name === '车身底板（底盘）')
        return ['正常', '刮擦', '锈蚀', '焊接', '变形', '改装'];
    const result = [...structureOptions];
    if (['不可拆水箱框架', '左D柱', '右D柱'].includes(name))
        result.push('未配备');
    return result;
}
function nationalAccidentSection() {
    return {
        key: 'accident',
        title: '重大事故检测',
        items: makeItems('accident', nationalOrder, nationalAccidentOptions, (name) => {
            const critical = !nationalNonCritical.has(name);
            return { critical, ...(critical ? { requiresSizeWhenAbnormal: true } : {}) };
        }),
    };
}
const waterNames = [
    '机舱保险丝盒', '左前地毯', '左A柱夹层及周边', '主驾线束及插头', '驾驶室内保险丝盒', '主驾座椅骨架及滑轨',
    '主驾驶座椅线束', '左侧门槛线束', '转向柱及踏板支架', '仪表台骨架', '室内中央扶手区', '点烟器底座', '车内棚顶',
    '左B柱夹层及周边', '左B柱安全带及锁止机构', '后排座椅骨架及海绵', '左C柱夹层及周边', '行李箱底板',
    '行李箱保险丝盒及线束', '右C柱夹层及周边', '右B柱夹层及周边', '右B柱安全带及锁止机构', '副驾座椅骨架及滑轨',
    '副驾驶座椅线束', '右侧门槛线束', '右前地毯', '底板横梁空腔内部', '右A柱夹层及周边', '副驾线束及插头',
];
const waterNotEquipped = new Set(['机舱保险丝盒', '驾驶室内保险丝盒', '主驾驶座椅线束', '左侧门槛线束', '点烟器底座', '行李箱保险丝盒及线束', '副驾驶座椅线束', '右侧门槛线束', '副驾线束及插头']);
exports.waterFocusItems = new Set(['左前地毯', '主驾座椅骨架及滑轨', '行李箱底板', '副驾座椅骨架及滑轨', '右前地毯']);
function waterSection() {
    return {
        key: 'water',
        title: '泡水检测',
        items: makeItems('water', waterNames, (name) => [
            '正常', '拆装', '更换', '积水', '水渍泥沙', '脏污', '霉变', '故障', '锈蚀', waterNotEquipped.has(name) ? '未配备' : '自定义',
        ], (name) => exports.waterFocusItems.has(name) ? { requiresNoteWhen: ['水渍泥沙'], noteLabel: '水渍泥沙情况说明' } : {}),
    };
}
function fireSection() {
    const names = ['防火墙隔音棉', '机舱内管路', '机舱内线束', '机舱盖隔音棉', '仪表台及附件', '行李箱底板涂层', '后备箱线束/保险盒', '车身底板涂层'];
    return {
        key: 'fire',
        title: '火烧检测',
        items: makeItems('fire', names, (name) => [
            '正常', '拆装', '更换', '烧蚀', '熏黑碳化', '炙烤融化',
            ...(['机舱盖隔音棉', '后备箱线束/保险盒'].includes(name) ? ['未配备'] : []),
        ]),
    };
}
function glassSection() {
    const names = ['前挡风玻璃', '左前角玻璃', '左前门玻璃', '左后门玻璃', '左后角玻璃', '后挡风玻璃', '右后角玻璃', '右后门玻璃', '右前门玻璃', '右前角玻璃', '天窗玻璃', '其他玻璃'];
    return {
        key: 'glass',
        title: '全车玻璃',
        items: makeItems('glass', names, (name) => [
            '正常', '碎裂', '裂痕', '更换',
            ...(['左前角玻璃', '左后角玻璃', '右后角玻璃', '右前角玻璃', '天窗玻璃', '其他玻璃'].includes(name) ? ['未配备'] : []),
        ]),
    };
}
const panelOptions = ['正常', '破损', '划伤', '更换', '改装', '修复'];
const seatOptions = ['正常', '磨损', '划伤', '更换', '拆卸', '修复', '改装'];
const beltOptions = ['正常', '破损', '霉变', '更换', '缺失', '水渍', '改装'];
const interiorEntries = [
    ['左前门内饰板', panelOptions],
    ['主驾座椅、方向盘、档杆部件', seatOptions],
    ['左A柱内饰板', panelOptions], ['仪表台', panelOptions], ['左B柱内饰板', panelOptions],
    ['左后（中）门内饰板', panelOptions], ['左C柱内饰板', panelOptions], ['行李箱盖内饰板', panelOptions],
    ['右后（中）门内饰板', panelOptions], ['右B柱内饰板', panelOptions], ['右前门内饰板', panelOptions], ['右A柱内饰板', panelOptions],
    ['内后视镜', ['正常', '破损', '划伤', '更换', '缺失', '修复']],
    ['遮阳板/化妆镜', ['正常', '破损', '划伤', '更换', '缺失', '修复', '未配备']],
    ['主驾驶安全带', beltOptions], ['副驾驶安全带', beltOptions],
    ['中排座椅', [...seatOptions, '未配备']], ['后排座椅', seatOptions], ['副驾座椅', seatOptions],
    ['左D柱内饰板', [...panelOptions, '未配备']], ['右D柱内饰板', [...panelOptions, '未配备']], ['右C柱内饰板', [...panelOptions, '未配备']],
    ['左后安全带', beltOptions, true], ['右后安全带', beltOptions, true],
];
function interiorSection() {
    return {
        key: 'interior',
        title: '内饰检测',
        guidance: '左后安全带、右后安全带为补齐原型项目数的示范项，生产发布前须由专业人员确认。',
        items: makeItems('interior', interiorEntries.map(([name]) => name), (name) => interiorEntries.find(([title]) => title === name)[1], (name) => {
            const entry = interiorEntries.find(([title]) => title === name);
            return entry?.[2] ? { professionalReviewRequired: true } : {};
        }),
    };
}
function obdSection() {
    return {
        key: 'obd',
        title: 'OBD系统诊断',
        items: makeItems('obd', ['气囊故障码', '车身稳定系统', '其他', '刹车系统故障码', '娱乐系统故障码'], () => ['无故障码', '有故障码']),
    };
}
function mileageSection() {
    const names = ['机/电模块里程数据', '变速箱模块里程数据', '车身模块里程数据', '历史云端里程数据', '其他里程数据', '维保记录里程数据'];
    return {
        key: 'mileage',
        title: '车辆里程数读取',
        items: makeItems('mileage', names, (name) => ['数据正常', '异常数据', ...(['历史云端里程数据', '其他里程数据', '维保记录里程数据'].includes(name) ? ['此项检测无此服务'] : [])]),
    };
}
function powertrainSection() {
    const entries = [
        ['发动机机爪胶', ['正常', '老化', '更换', '破损', '自定义']],
        ['发动机主体有无拆装', ['正常', '拆装', '更换', '破损', '渗漏']],
        ['涡轮增压机', ['正常', '拆装', '更换', '破损', '渗漏']],
        ['发动机有无渗漏油', ['正常', '渗油', '漏油']],
        ['机油尺液位', ['正常', '高于', '低于机油标尺']],
        ['水箱冷凝器', ['正常', '拆装', '更换', '渗漏']],
        ['空调冷凝器', ['正常', '拆装', '更换', '渗漏']],
        ['三元催化器', ['正常', '拆装', '未配备']],
    ];
    return { key: 'powertrain', title: '发动机及变速箱检测', items: makeItems('powertrain', entries.map(([name]) => name), (name) => entries.find(([title]) => title === name)[1]) };
}
function chassisSection() {
    const brake = ['正常', '破损', '建议更换', '改装', '变形'];
    const shock = ['正常', '变形', '渗油', '改装'];
    const entries = [
        ['左前刹车盘（刹车片）', brake], ['左前减震器', shock], ['右前刹车盘（刹车片）', brake], ['右前减震器', shock],
        ['左后刹车盘（刹车片）', brake], ['左后减震器', shock], ['右后刹车盘（刹车片）', brake], ['右后减震器', shock],
        ['备用轮胎', ['正常', '建议更换', '未配备']], ['轮胎轮毂外侧', brake],
    ];
    return { key: 'chassis', title: '底盘检查', items: makeItems('chassis', entries.map(([name]) => name), (name) => entries.find(([title]) => title === name)[1]) };
}
function newCarFunctionSection() {
    const common = ['正常', '故障', '自定义', '未配备'];
    const entries = [
        ['款型年份核对', ['正常', '异常']], ['展车/试驾车检测', ['正常', '库存', '试驾车']], ['蓄电池检测', ['正常', '故障', '更换']],
        ['机油量检测', ['正常', '低于警戒线', '建议更换', '高于最高线', '自定义']],
        ['刹车油/冷却液检测', ['正常', '低于警戒线', '建议更换', '高于最高线', '自定义']],
        ['空调功能', ['正常', '故障', '自定义']], ['多媒体功能', common], ['主驾仪表检测', ['正常', '故障', '自定义']],
        ['方向盘按键功能', common], ['主驾仪表台功能', common], ['主驾门板功能', common], ['主驾座椅功能', common],
        ['副仪表台功能', common], ['副驾座椅功能', common], ['副驾门板功能', common], ['车载USB接口', common],
        ['后排座椅功能', common], ['右后门板功能', common], ['左后门板功能', common], ['后尾门功能', common],
        ['后备箱功能', common], ['底盘升降功能', common], ['迎宾踏板功能', common], ['前照灯功能', common],
        ['主动格栅功能', common], ['电动电吸门功能', common], ['车内灯光功能', common], ['尾部灯光功能', common],
        ['新车工具包', ['正常', '缺失', '未配备']],
    ];
    return {
        key: 'function',
        title: '车况功能性检测',
        items: makeItems('function', entries.map(([name]) => name), (name) => entries.find(([title]) => title === name)[1], (name) => name === '款型年份核对' ? { requiresNoteWhen: ['异常'], noteLabel: '差异款型' } : {}),
    };
}
exports.sharedSectionFactories = {
    paint: paintSection,
    water: waterSection,
    fire: fireSection,
    glass: glassSection,
    interior: interiorSection,
    obd: obdSection,
    mileage: mileageSection,
    powertrain: powertrainSection,
    chassis: chassisSection,
    function: newCarFunctionSection,
};
//# sourceMappingURL=modules.js.map